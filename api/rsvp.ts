import type { VercelRequest, VercelResponse } from "@vercel/node";
import { appendRsvpRow } from "../lib/google-sheets-append.js";

type RsvpBody = {
  name: string;
  email: string;
  attending: boolean;
  guestCount?: number | null;
  dietaryRestrictions?: string | null;
  message?: string | null;
};

function optionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  return null;
}

function optionalString(value: unknown): string | null {
  if (value == null || value === "") return null;
  return typeof value === "string" ? value : null;
}

function parseBody(body: unknown): RsvpBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.trim() === "") return null;
  if (typeof b.email !== "string" || !b.email.includes("@")) return null;
  if (typeof b.attending !== "boolean") return null;
  return {
    name: b.name.trim(),
    email: b.email.trim(),
    attending: b.attending,
    guestCount: optionalNumber(b.guestCount),
    dietaryRestrictions: optionalString(b.dietaryRestrictions),
    message: optionalString(b.message),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
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
    return res
      .status(500)
      .json({ error: "Failed to save your RSVP. Please try again." });
  }
}
