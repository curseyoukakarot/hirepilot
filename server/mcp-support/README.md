# HirePilot Support MCP Tools

These tools expose the Support Knowledge Base (60+ Markdown files under `knowledge/`) to Agent Builder via simple command-line tools that return exact Markdown excerpts. No generative text is produced by the tools; they only search, select, and return relevant sections.

## Design

- One tool per functional group (e.g., campaigns, sniper, candidates).
- Shared loader and fuzzy section extractor.
- Tools read JSON from stdin and return JSON to stdout.
- Schema (input):
  - `topic?: string`
  - `question?: string`
  - `context?: string`
- Return shape:
  ```json
  {
    "group": "support.group_key",
    "query": "joined string",
    "results": [
      { "filename": "file.md", "headings": ["..."], "excerpt": "...", "confidence": 0.87 }
    ]
  }
  ```

## Files

- `lib/groups.js` — Maps tool groups to `knowledge/*.md` files.
- `lib/markdown.js` — Markdown loader, section splitter, fuzzy matcher, and search.
- `supportTool.js` — Generic runner used by all group wrappers.
- `tools/*.js` — Small wrappers that select a `GROUP` and execute the runner.
- `mcp.json` — Registry for Agent Builder, mapping tool names to commands.
- `test/test.js` — Example invocations for quick validation.

## Usage

Example:
```bash
echo '{"question":"How do I create a pipeline?"}' | node server/mcp-support/tools/pipelines.js | jq
```

## mcp.json

Import or reference `server/mcp-support/mcp.json` in your MCP configuration. Example entry:
```json
{
  "support.pipelines": {
    "cmd": "node server/mcp-support/tools/pipelines.js",
    "args": {}
  }
}
```

## Contract

- Tools must never generate new content.
- Tools only return excerpts from Markdown docs.
- Consumers (REX/Agent) are responsible for summarization and conversational responses using the returned excerpts.

## Adding Docs

1. Drop new `.md` files into `knowledge/`.
2. Update `lib/groups.js` to include the new file in the relevant group(s).
3. (Optional) Add new group and wrapper tool if it defines a new capability.


