/** @typedef {{ name: string; email: string; attending: boolean; guestCount?: number | null; dietaryRestrictions?: string | null; message?: string | null }} RsvpBody */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function base64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function normalizePrivateKey(raw) {
  if (!raw) return "";
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

function missingEnvVars() {
  const required = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
  ];
  return required.filter((name) => !process.env[name]?.trim());
}

async function importPrivateKey(pem) {
  if (!pem.includes("BEGIN PRIVATE KEY")) {
    throw new Error(
      "private key must be PKCS#8 (-----BEGIN PRIVATE KEY-----). Use the key from your Google service account JSON.",
    );
  }
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Buffer.from(pemContents, "base64");
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new Error("Unable to import private key — check GOOGLE_PRIVATE_KEY formatting");
  }
}

async function getAccessToken() {
  const missing = missingEnvVars();
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim();
  const rawKey = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(claim)))}`;
  const key = await importPrivateKey(rawKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64url(Buffer.from(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to get access token: ${await tokenRes.text()}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

/** @param {RsvpBody} data */
async function appendRsvpRow(data) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID is not set");

  const tab = process.env.GOOGLE_SHEET_TAB || "Sheet1";
  const token = await getAccessToken();
  const timestamp = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });

  const values = [
    [
      timestamp,
      data.name,
      data.email,
      data.attending ? "Yes" : "No",
      data.attending && data.guestCount != null ? String(data.guestCount) : "",
      data.attending && data.dietaryRestrictions ? data.dietaryRestrictions : "",
      data.message ?? "",
    ],
  ];

  const range = encodeURIComponent(`${tab}!A:G`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    throw new Error(`Failed to append row: ${res.status} ${await res.text()}`);
  }
}

/** @param {unknown} body @returns {RsvpBody | null} */
function parseBody(body) {
  if (!body || typeof body !== "object") return null;
  const b = body;
  if (typeof b.name !== "string" || !b.name.trim()) return null;
  if (typeof b.email !== "string" || !b.email.includes("@")) return null;
  if (typeof b.attending !== "boolean") return null;

  return {
    name: b.name.trim(),
    email: b.email.trim(),
    attending: b.attending,
    guestCount:
      typeof b.guestCount === "number"
        ? b.guestCount
        : typeof b.guestCount === "string" && b.guestCount !== ""
          ? Number(b.guestCount)
          : null,
    dietaryRestrictions:
      typeof b.dietaryRestrictions === "string" ? b.dietaryRestrictions : null,
    message: typeof b.message === "string" ? b.message : null,
  };
}

function clientErrorMessage(err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith("Missing env:")) {
    return "RSVP is not configured on the server. Please contact the hosts.";
  }
  if (msg.includes("Failed to get access token")) {
    return "Google sign-in failed. Check the service account key in Vercel env vars.";
  }
  if (msg.includes("Unable to import") || msg.includes("private key")) {
    return "Invalid Google private key format in server configuration.";
  }
  if (msg.includes("403") || msg.includes("permission")) {
    return "Cannot write to the spreadsheet. Share the sheet with the service account email.";
  }
  if (msg.includes("404") || msg.includes("Unable to parse range")) {
    return "Spreadsheet or tab name not found. Check GOOGLE_SHEET_ID and GOOGLE_SHEET_TAB.";
  }
  return "Failed to save your RSVP. Please try again.";
}

/** @param {import("@vercel/node").VercelRequest} req @param {import("@vercel/node").VercelResponse} res */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const missing = missingEnvVars();
    return res.status(missing.length ? 503 : 200).json({
      ok: missing.length === 0,
      missing,
      sheetTab: process.env.GOOGLE_SHEET_TAB || "Sheet1",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const data = parseBody(req.body);
  if (!data) {
    return res.status(400).json({ error: "Invalid RSVP data" });
  }

  try {
    await appendRsvpRow(data);
    return res.status(200).json({
      success: true,
      message: "RSVP received! We can't wait to celebrate with you.",
    });
  } catch (err) {
    console.error("RSVP append failed:", err);
    const message = clientErrorMessage(err);
    const status = message.includes("not configured") ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
