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
    const insertData: any = {
      user_id,
      issue_kind,
      summary
    };

    const { data, error } = await supabaseAdmin
      .from("support_tickets")
      .insert(insertData)
      .select("id")
      .single();

    if (error) throw error;

    return res.json({ ticket_id: data.id });
  } catch (e: any) {
    return res.status(500).json({ error: "ticket create failed", detail: e?.message });
  }
});

export default router;


