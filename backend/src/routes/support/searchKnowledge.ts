import { Router } from "express";

const router = Router();

/**
 * Minimal "search" stub. Replace with Supabase Vector later.
 * Body: { query:string, top_k?:number }
 * Return: { results: [{title, snippet, url}] }
 */
router.post("/search-knowledge", async (req, res) => {
  const { query, top_k = 3 } = req.body || {};
  if (!query) return res.status(400).json({ error: "query required" });
  // TODO: wire to real vector search; for now, return placeholders
  res.json({
    results: [
      { title: "Getting Started", snippet: "What HirePilot is and how it works...", url: "/knowledge/overview.md" },
      { title: "Campaign Wizard", snippet: "Create your first campaign by...", url: "/knowledge/campaign-wizard.md" }
    ].slice(0, Math.max(0, Math.min(3, Number(top_k) || 3)))
  });
});

export default router;


