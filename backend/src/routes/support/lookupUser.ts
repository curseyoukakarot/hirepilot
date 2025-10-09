import { Router } from "express";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router = Router();

router.post("/lookup-user", async (req, res) => {
  const { email, session_token } = req.body || {};

  try {
    let userRow: any = null;

    if (email) {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, first_name, last_name, email, plan")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      userRow = data;
    }

    if (!userRow && session_token) {
      const { data, error } = await supabaseAdmin
        .from("sessions")
        .select("user_id")
        .eq("token", session_token)
        .maybeSingle();
      if (error) throw error;
      if (data?.user_id) {
        const { data: user, error: uerr } = await supabaseAdmin
          .from("users")
          .select("id, first_name, last_name, email, plan")
          .eq("id", data.user_id)
          .maybeSingle();
        if (uerr) throw uerr;
        userRow = user;
      }
    }

    if (!userRow) return res.json({ not_found: true });

    return res.json({
      user_id: userRow.id,
      name: [userRow.first_name, userRow.last_name].filter(Boolean).join(" ") || userRow.email,
      email: userRow.email,
      plan: userRow.plan,
      status: null
    });
  } catch (e: any) {
    return res.status(500).json({ error: "lookup failed", detail: e?.message });
  }
});

export default router;


