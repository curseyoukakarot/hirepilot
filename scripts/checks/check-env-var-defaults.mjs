#!/usr/bin/env node
// check-env-var-defaults.mjs
// TypeScript port of brain/scripts/check_env_var_defaults.py.
//
// Requires: npm i -D ts-morph
//
// Flags non-empty fallback defaults for sensitively-named environment variables:
//   1. `process.env.SECRET ?? "fallback"` / `process.env.SECRET || "fallback"`
//      (BinaryExpression with ?? or || and a string-literal right-hand side).
//   2. zod schema defaults on secret-named keys: `z.string().default("fallback")`
//      where the property key is sensitive.
//
// Empty-string and placeholder defaults are allowed (fail-fast / clearly fake).
// Suppress a single line with a trailing  // noqa: env-var-default

import { Project, SyntaxKind } from "ts-morph";
import {
  parseArgs,
  collectTsFiles,
  report,
  isSensitiveName,
  isPlaceholderValue,
  assertRootsExist,
} from "./_lib.mjs";

const NOQA = "noqa: env-var-default";

function getStringLiteral(node) {
  if (!node) return null;
  const kind = node.getKind();
  if (
    kind === SyntaxKind.StringLiteral ||
    kind === SyntaxKind.NoSubstitutionTemplateLiteral
  ) {
    return node.getLiteralValue();
  }
  return null;
}

// `process.env.X` or `process.env["X"]` → returns the env-var name, else null.
function processEnvName(node) {
  if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
    // process.env.X
    const obj = node.getExpression();
    if (obj.getText() === "process.env") return node.getName();
  }
  if (node.getKind() === SyntaxKind.ElementAccessExpression) {
    // process.env["X"]
    const obj = node.getExpression();
    if (obj.getText() === "process.env") {
      const arg = node.getArgumentExpression?.();
      return getStringLiteral(arg);
    }
  }
  return null;
}

function hasNoqa(node) {
  const line = node.getSourceFile().getFullText().split("\n")[node.getStartLineNumber() - 1] ?? "";
  return line.includes(NOQA);
}

function main() {
  const opts = parseArgs();
  if (opts.roots.length) assertRootsExist(opts.roots);
  const files = collectTsFiles(opts.roots.length ? opts.roots : ["src"]);

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: false },
  });
  for (const f of files) project.addSourceFileAtPathIfExists(f);

  const violations = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // --- Pattern 1: process.env.X ?? "default" / process.env.X || "default"
    for (const bin of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      const opKind = bin.getOperatorToken().getKind();
      if (
        opKind !== SyntaxKind.QuestionQuestionToken &&
        opKind !== SyntaxKind.BarBarToken
      ) {
        continue;
      }
      const envName = processEnvName(bin.getLeft());
      if (!envName || !isSensitiveName(envName)) continue;

      const def = getStringLiteral(bin.getRight());
      if (def === null) continue; // non-string fallback
      if (isPlaceholderValue(def)) continue; // empty / placeholder is fine
      if (hasNoqa(bin)) continue;

      violations.push({
        path: filePath,
        line: bin.getStartLineNumber(),
        description:
          `Sensitive env var '${envName}' has a non-empty fallback default ` +
          `"${def}". This default can leak to production if the env var is unset. ` +
          "Fail fast instead (throw if missing).",
        code: bin.getText().split("\n")[0],
      });
    }

    // --- Pattern 2: zod  .default("...") on a secret-named schema key
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue;
      if (expr.getName() !== "default") continue;

      const def = getStringLiteral(call.getArguments()[0]);
      if (def === null) continue;
      if (isPlaceholderValue(def)) continue;

      // The schema key is the enclosing property assignment's name.
      const prop = call.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
      const key = prop?.getNameNode().getText();
      if (!key || !isSensitiveName(key)) continue;
      if (hasNoqa(call)) continue;

      violations.push({
        path: filePath,
        line: call.getStartLineNumber(),
        description:
          `Zod schema key '${key}' has a non-empty .default("${def}") for a ` +
          "sensitive env var. Make it required (no default) or default to \"\".",
        code: call.getText().split("\n")[0],
      });
    }
  }

  if (opts.verbose) {
    console.log(`Scanned ${project.getSourceFiles().length} files for env var defaults.`);
  }
  process.exit(report(violations, opts, "Dangerous env var defaults"));
}

main();
