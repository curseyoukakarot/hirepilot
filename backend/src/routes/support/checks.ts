import { Router } from "express";
const router = Router();

router.post("/checks/integrations", async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  res.json({
    gmail:{connected:true,last_error:null},
    outlook:{connected:false,last_error:"token_expired"},
    sendgrid:{connected:true},
    slack:{connected:true}
  });
});

router.post("/checks/service-health", async (req, res) => {
  const { service } = req.body || {};
  if (!service) return res.status(400).json({ error: "service required" });
  res.json({ status:"ok", since:null, notes:null });
});

router.post("/checks/recent-errors", async (req, res) => {
  const { user_id, window_minutes = 15 } = req.body || {};
  if (!user_id) return res.status(400).json({ error: "user_id required" });
  res.json({ events:[{ ts:new Date().toISOString(), code:"403", endpoint:"/job_requisitions", correlation_id:"abc123"}] });
});

router.post("/checks/probe-endpoint", async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  res.json({ ok:true, latency_ms:87, code:200 });
});

export default router;


