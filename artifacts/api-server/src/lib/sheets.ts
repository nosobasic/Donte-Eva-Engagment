// Google Sheets integration via @replit/connectors-sdk
// Handles creating the RSVP spreadsheet and appending responses

import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SHEET_ID_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.sheet-id"
);

let cachedSheetId: string | null = null;
let creationPromise: Promise<string> | null = null;

function loadSheetId(): string | null {
  if (cachedSheetId) return cachedSheetId;
  try {
    if (fs.existsSync(SHEET_ID_FILE)) {
      const id = fs.readFileSync(SHEET_ID_FILE, "utf-8").trim();
      if (id) {
        cachedSheetId = id;
        return id;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSheetId(id: string) {
  cachedSheetId = id;
  try {
    fs.writeFileSync(SHEET_ID_FILE, id, "utf-8");
  } catch (err) {
    logger.error({ err }, "Failed to save sheet ID to disk");
  }
}

async function createRsvpSheet(): Promise<string> {
  const connectors = new ReplitConnectors();

  const response = await connectors.proxy("google-sheet", "/v4/spreadsheets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: "Engagement Party RSVPs" },
      sheets: [
        {
          properties: { title: "RSVPs", sheetId: 0 },
          data: [
            {
              startRow: 0,
              startColumn: 0,
              rowData: [
                {
                  values: [
                    { userEnteredValue: { stringValue: "Timestamp" } },
                    { userEnteredValue: { stringValue: "Name" } },
                    { userEnteredValue: { stringValue: "Email" } },
                    { userEnteredValue: { stringValue: "Attending" } },
                    { userEnteredValue: { stringValue: "Guest Count" } },
                    { userEnteredValue: { stringValue: "Dietary Restrictions" } },
                    { userEnteredValue: { stringValue: "Message" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create spreadsheet: ${response.status} ${text}`);
  }

  const data = (await response.json()) as { spreadsheetId: string };
  logger.info({ spreadsheetId: data.spreadsheetId }, "Created RSVP spreadsheet");
  saveSheetId(data.spreadsheetId);
  return data.spreadsheetId;
}

export async function getOrCreateSheetId(): Promise<string> {
  const existing = loadSheetId();
  if (existing) return existing;
  if (creationPromise) return creationPromise;
  creationPromise = createRsvpSheet().finally(() => {
    creationPromise = null;
  });
  return creationPromise;
}

export function getSheetUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

export async function appendRsvpRow(data: {
  name: string;
  email: string;
  attending: boolean;
  guestCount?: number | null;
  dietaryRestrictions?: string | null;
  message?: string | null;
}): Promise<void> {
  const sheetId = await getOrCreateSheetId();
  const connectors = new ReplitConnectors();
  const timestamp = new Date().toISOString();

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

  const response = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${sheetId}/values/RSVPs!A1:G1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to append row: ${response.status} ${text}`);
  }

  logger.info({ name: data.name, attending: data.attending }, "RSVP appended to sheet");
}
