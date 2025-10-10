import { Router } from "express";
import { randomUUID } from "crypto";
const router = Router();

router.post("/feedback/log", async (req, res) => {
  const { user_id, text, category } = req.body || {};
  if (!text) return res.status(400).json({ error: "text required" });
  res.json({ feedback_id: randomUUID() });
});

export default router;


