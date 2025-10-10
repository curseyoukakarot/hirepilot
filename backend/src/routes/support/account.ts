import { Router } from "express";
const router = Router();

router.post("/account/fetch-plan", async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  res.json({ plan:"pro", seats:5, credits:12000, renews_on:"2026-01-01" });
});

router.post("/account/fetch-quota", async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  res.json({ daily_requests: 500, used_today: 123, limits:{ linkedin:200, email:500 } });
});

router.post("/account/fetch-usage", async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  res.json({ last_7d:{ emails_sent: 134, linkedin_requests: 87, campaigns_launched: 4 } });
});

export default router;


