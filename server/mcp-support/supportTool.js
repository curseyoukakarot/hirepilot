#!/usr/bin/env node
/**
 * Generic Support MCP Tool runner.
 * Reads JSON from stdin: { topic?: string, question?: string, context?: string }
 * Env/group selection: The wrapper passes GROUP=<group_key>
 * Output JSON: { results: [{ filename, headings, excerpt, confidence }] }
 *
 * IMPORTANT: This tool only returns MD excerpts. No generative text.
 */
const groups = require("./lib/groups");
const { loadDocsByFiles, searchKnowledgeBase } = require("./lib/markdown");

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

async function main() {
  const group = process.env.GROUP;
  if (!group || !groups[group]) {
    console.error(JSON.stringify({ error: "invalid_or_missing_group", detail: group || null }));
    process.exit(1);
  }
  let payload = {};
  try {
    const raw = await readStdin();
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    // ignore parse failure; treat as empty payload
  }

  const { topic, question, context } = payload || {};
  const query = [topic, question, context].filter(Boolean).join(" ").trim();
  const files = loadDocsByFiles(groups[group]);
  const results = query ? searchKnowledgeBase(files, query) : [];
  const response = { results, group, query };
  process.stdout.write(JSON.stringify(response, null, 2));
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err));
  process.exit(1);
});


