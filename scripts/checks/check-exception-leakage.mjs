#!/usr/bin/env node
// check-exception-leakage.mjs
// TypeScript port of brain/scripts/check_exception_detail_leakage.py.
//
// Requires: npm i -D ts-morph
//
// Flags error responses inside `catch` blocks that interpolate the caught error
// (err.message / err.stack / String(err) / `${err}`) into a response body such
// as `res.json(...)` or `NextResponse.json(...)`. Leaking raw error detail to
// API consumers exposes stack traces, file paths, and DB internals — high value
// for Next.js route handlers.

import { Project, SyntaxKind } from "ts-morph";
import { parseArgs, collectTsFiles, report, assertRootsExist } from "./_lib.mjs";

// Response-producing calls whose argument is client-facing.
const RESPONSE_METHODS = new Set(["json", "send", "end", "write"]);
const RESPONSE_OBJECTS = new Set(["res", "response", "NextResponse", "Response"]);

// Members of an Error that leak internals when surfaced to the client.
const LEAKY_ERROR_MEMBERS = new Set(["message", "stack", "cause", "name"]);

function getCatchParamName(catchClause) {
  const decl = catchClause.getVariableDeclaration();
  if (!decl) return null;
  const nameNode = decl.getNameNode();
  // Only simple identifier bindings (skip destructured catch params).
  return nameNode && nameNode.getKind() === SyntaxKind.Identifier
    ? nameNode.getText()
    : null;
}

// Does this expression reference the caught error in a leaky way?
function referencesError(node, errName) {
  // String(err) / err.toString()
  if (node.getKind() === SyntaxKind.CallExpression) {
    const expr = node.getExpression();
    if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === "String") {
      const args = node.getArguments();
      if (args.length && args[0].getText() === errName) return true;
    }
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      if (
        expr.getExpression().getText() === errName &&
        expr.getName() === "toString"
      ) {
        return true;
      }
    }
  }

  // err.message / err.stack / err.cause ...
  if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
    if (
      node.getExpression().getText() === errName &&
      LEAKY_ERROR_MEMBERS.has(node.getName())
    ) {
      return true;
    }
  }

  // bare `err` reference
  if (node.getKind() === SyntaxKind.Identifier && node.getText() === errName) {
    return true;
  }

  return false;
}

// Walk an expression tree looking for any leaky reference to the error var.
function containsErrorLeak(node, errName) {
  if (referencesError(node, errName)) return true;
  for (const child of node.getChildren()) {
    if (containsErrorLeak(child, errName)) return true;
  }
  return false;
}

function isResponseCall(callExpr) {
  const expr = callExpr.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  const method = expr.getName();
  if (!RESPONSE_METHODS.has(method)) return false;
  const objText = expr.getExpression().getText();
  // Match `res`, `response`, `NextResponse.json`, `Response.json`, or any
  // identifier ending in `res`/`response` (e.g. `nextRes`).
  if (RESPONSE_OBJECTS.has(objText)) return true;
  const lower = objText.toLowerCase();
  return lower.endsWith("res") || lower.endsWith("response");
}

function main() {
  const opts = parseArgs();
  if (opts.roots.length) assertRootsExist(opts.roots);
  const roots = opts.roots.length ? opts.roots : ["src"];
  const files = collectTsFiles(roots);

  const project = new Project({
    useInMemoryFileSystem: false,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false },
  });
  for (const f of files) project.addSourceFileAtPathIfExists(f);

  const violations = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const catchClause of sourceFile.getDescendantsOfKind(SyntaxKind.CatchClause)) {
      const errName = getCatchParamName(catchClause);
      if (!errName) continue;

      const block = catchClause.getBlock();
      if (!block) continue;

      for (const call of block.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        if (!isResponseCall(call)) continue;
        for (const arg of call.getArguments()) {
          if (containsErrorLeak(arg, errName)) {
            violations.push({
              path: filePath,
              line: call.getStartLineNumber(),
              description:
                `Response body in catch block leaks the caught error '${errName}' ` +
                "(err.message / err.stack / String(err) / template literal). " +
                "Return a generic message and log the error instead.",
              code: call.getText().split("\n")[0],
            });
            break;
          }
        }
      }
    }
  }

  if (opts.verbose) {
    console.log(`Scanned ${project.getSourceFiles().length} files for exception leakage.`);
  }
  process.exit(report(violations, opts, "Exception detail leakage"));
}

main();
