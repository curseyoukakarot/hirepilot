import { Router } from "express";
import jwt from "jsonwebtoken";

const router = Router();

const SERVICE_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGENT_MCP_SECRET;

if (!SERVICE_SECRET) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or AGENT_MCP_SECRET");
}

router.post("/agent-token", async (_req, res) => {
  try {
    const token = jwt.sign(
      {
        iss: "agent-builder",
        aud: "hirepilot-mcp",
        scope: "support_tools"
      },
      SERVICE_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ token });
  } catch (e: any) {
    res.status(500).json({ error: "Failed to create token", detail: e?.message });
  }
});

export default router;


