#!/usr/bin/env node
const { spawnSync } = require("child_process");

function run(tool, payload) {
  const p = spawnSync("node", [`server/mcp-support/tools/${tool}.js`], {
    input: JSON.stringify(payload),
    encoding: "utf8"
  });
  if (p.error) {
    console.error(tool, "error:", p.error);
    return;
  }
  console.log(`\n=== ${tool} ===`);
  console.log(p.stdout || p.stderr);
}

run("pipelines.js", { question: "How do I create a pipeline?" });
run("messaging_email.js", { question: "Why can't I send Gmail emails?" });
run("sniper.js", { question: "Sniper is stuck on my account" });
run("deals_billing.js", { question: "How do I attach a Job REQ to an Opportunity?" });
run("chrome_extension.js", { question: "How do I enable the Chrome extension?" });
run("deals_billing.js", { question: "How does the deals billing modal work?" });


