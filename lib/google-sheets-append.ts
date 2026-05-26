// Server-side Google Sheets append (service account JWT).
// Env: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID
// Optional: GOOGLE_SHEET_TAB (default Sheet1)

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Buffer.from(pemContents, "base64");
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedClaim = base64url(Buffer.from(JSON.stringify(claim)));
  const signingInput = `${encodedHeader}.${encodedClaim}`;

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
    const text = await tokenRes.text();
    throw new Error(`Failed to get access token: ${text}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return access_token;
}

export type RsvpRowInput = {
  name: string;
  email: string;
  attending: boolean;
  guestCount?: number | null;
  dietaryRestrictions?: string | null;
  message?: string | null;
};

export async function appendRsvpRow(data: RsvpRowInput): Promise<void> {
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
      data.attending && data.dietaryRestrictions
        ? data.dietaryRestrictions
        : "",
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
    const text = await res.text();
    throw new Error(`Failed to append row: ${res.status} ${text}`);
  }
}
