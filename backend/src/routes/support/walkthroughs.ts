import { Router } from "express";
import { randomUUID } from "crypto";
const router = Router();

const sessions = new Map<string, { slug:string; step:number }>();

const procedures: Record<string, string[]> = {
  connect_gmail: [
    "Open HirePilot → Settings → Integrations.",
    "Click 'Connect Gmail'.",
    "Authorize Google in the popup.",
    "Back in HirePilot, confirm status shows 'Connected'."
  ],
  setup_chrome_extension: [
    "Open Chrome Web Store and install 'HirePilot Extension'.",
    "Pin the extension and sign in.",
    "Open LinkedIn and try the 'Capture' button."
  ]
};

router.post("/walkthroughs/start", async (req, res) => {
  const { user_id, procedure_slug } = req.body || {};
  if (!user_id || !procedure_slug) return res.status(400).json({ error: "user_id & procedure_slug required" });
  const steps = procedures[procedure_slug];
  if (!steps) return res.status(404).json({ error: "unknown procedure_slug" });

  const session_id = randomUUID();
  sessions.set(session_id, { slug: procedure_slug, step: 0 });
  res.json({ session_id, step: 1, instructions: steps[0], branch_options: [] });
});

router.post("/walkthroughs/advance", async (req, res) => {
  const { session_id, user_reply } = req.body || {};
  if (!session_id || !user_reply) return res.status(400).json({ error: "session_id & user_reply required" });

  const s = sessions.get(session_id);
  if (!s) return res.status(404).json({ error: "session not found" });

  const steps = procedures[s.slug] || [];
  let next = s.step + 1;
  if (next >= steps.length) {
    sessions.delete(session_id);
    return res.json({ step: steps.length, instructions: "All done 🎉", done: true });
  }
  s.step = next;
  res.json({ step: next + 1, instructions: steps[next], branch_options: [] });
});

export default router;


