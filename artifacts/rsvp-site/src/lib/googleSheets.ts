// Google Sheets API — direct browser call via Service Account JWT
// Env vars required (set in Vercel dashboard with VITE_ prefix):
//   VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL
//   VITE_GOOGLE_PRIVATE_KEY   (full PEM key, newlines as \n)
//   VITE_GOOGLE_SHEET_ID      (the spreadsheet ID from the sheet URL)

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

function base64url(data: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(data)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function strToUint8(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(): Promise<string> {
  const email = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL as string;
  const rawKey = (import.meta.env.VITE_GOOGLE_PRIVATE_KEY as string).replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const headerBytes = strToUint8(JSON.stringify(header));
  const claimBytes = strToUint8(JSON.stringify(claim));
  const encodedHeader = base64url(headerBytes.buffer as ArrayBuffer);
  const encodedClaim = base64url(claimBytes.buffer as ArrayBuffer);
  const signingInput = `${encodedHeader}.${encodedClaim}`;

  const key = await importPrivateKey(rawKey);
  const signingBytes = strToUint8(signingInput);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    signingBytes.buffer as ArrayBuffer
  );

  const jwt = `${signingInput}.${base64url(signature as ArrayBuffer)}`;

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

  const { access_token } = await tokenRes.json() as { access_token: string };
  return access_token;
}

export async function appendRsvpRow(data: {
  name: string;
  email: string;
  attending: boolean;
  guestCount?: number | null;
  dietaryRestrictions?: string | null;
  message?: string | null;
}): Promise<void> {
  const sheetId = import.meta.env.VITE_GOOGLE_SHEET_ID as string;
  if (!sheetId) throw new Error("VITE_GOOGLE_SHEET_ID is not set");

  const token = await getAccessToken();
  const timestamp = new Date().toLocaleString();

  const values = [[
    timestamp,
    data.name,
    data.email,
    data.attending ? "Yes" : "No",
    data.attending && data.guestCount != null ? String(data.guestCount) : "",
    data.attending && data.dietaryRestrictions ? data.dietaryRestrictions : "",
    data.message ?? "",
  ]];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

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
