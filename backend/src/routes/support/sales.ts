import { Router } from "express";
import { randomUUID } from "crypto";
const router = Router();

router.post("/sales/create-lead", async (req, res) => {
  const { name, email, notes, source } = req.body || {};
  if (!source) return res.status(400).json({ error: "source required" });
  res.json({ crm_id: randomUUID() });
});

router.post("/sales/schedule-demo", async (req, res) => {
  const { email, timeslot_pref } = req.body || {};
  if (!email) return res.status(400).json({ error: "email required" });
  res.json({ calendar_event_id: randomUUID(), invite_url: "https://calendar.example.com/demo/abc" });
});

export default router;


