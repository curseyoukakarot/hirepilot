import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router = Router();

router.post("/tickets/create", async (req, res) => {
  const {
    user_id,
    issue_kind,
    summary,
    signals,
    repro_steps,
    attempted_fixes,
    customer_impact
  } = req.body || {};

  if (!user_id || !issue_kind || !summary) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id,
        issue_kind,
        summary,
        signals: signals || {},
        repro_steps: repro_steps || null,
        attempted_fixes: attempted_fixes || [],
        customer_impact: customer_impact || null,
        status: "open",
        priority: "p2"
      })
      .select("id")
      .single();

    if (error) throw error;

    return res.json({ ticket_id: data.id });
  } catch (e: any) {
    return res.status(500).json({ error: "ticket create failed", detail: e?.message });
  }
});

export default router;


