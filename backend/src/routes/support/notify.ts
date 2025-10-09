import { Router } from "express";
import { startSupportEmailThread } from "../../lib/email";

const router = Router();

router.post("/notify/email-thread", async (req, res) => {
  const { to, subject, body, cc } = req.body || {};

  if (!to || !subject || !body) {
    return res.status(400).json({ error: "Missing to|subject|body" });
  }

  try {
    const result = await startSupportEmailThread({ to, subject, body, cc });
    return res.json({ thread_id: result.thread_id });
  } catch (e: any) {
    return res.status(500).json({ error: "email failed", detail: e?.message });
  }
});

export default router;


