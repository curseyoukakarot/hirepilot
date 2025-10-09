import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SERVICE_SECRET =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.AGENT_MCP_SECRET;

if (!SERVICE_SECRET) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or AGENT_MCP_SECRET");
}

export function verifyAgentToken(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = auth.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, SERVICE_SECRET) as any;

    if (payload?.aud !== "hirepilot-mcp") {
      return res.status(403).json({ error: "Invalid token audience" });
    }
    if (payload?.iss && payload.iss !== "agent-builder") {
      return res.status(403).json({ error: "Invalid token issuer" });
    }
    if (payload?.scope && payload.scope !== "support_tools") {
      return res.status(403).json({ error: "Invalid scope" });
    }

    (req as any).agentClaims = payload;
    return next();
  } catch (err: any) {
    return res.status(403).json({ error: "Invalid or expired token", detail: err?.message });
  }
}


