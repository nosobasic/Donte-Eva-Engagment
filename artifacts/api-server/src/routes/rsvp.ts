import { Router, type IRouter } from "express";
import { SubmitRsvpBody } from "@workspace/api-zod";
import { appendRsvpRow, getOrCreateSheetId, getSheetUrl } from "../lib/sheets";

const router: IRouter = Router();

router.post("/rsvp", async (req, res) => {
  const parsed = SubmitRsvpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, attending, guestCount, dietaryRestrictions, message } = parsed.data;

  try {
    await appendRsvpRow({ name, email, attending, guestCount, dietaryRestrictions, message });
    res.json({ success: true, message: "RSVP received! We can't wait to celebrate with you." });
  } catch (err) {
    req.log.error({ err }, "Failed to append RSVP to Google Sheets");
    res.status(500).json({ error: "Failed to save your RSVP. Please try again." });
  }
});

router.get("/rsvp/sheet-url", async (req, res) => {
  try {
    const sheetId = await getOrCreateSheetId();
    res.json({ url: getSheetUrl(sheetId) });
  } catch (err) {
    req.log.error({ err }, "Failed to get sheet URL");
    res.status(500).json({ error: "Unable to retrieve sheet URL." });
  }
});

export default router;
