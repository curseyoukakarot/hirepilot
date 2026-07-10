#!/usr/bin/env node
// check-hardcoded-secrets.mjs
// TypeScript port of brain/scripts/check_hardcoded_secrets.py.
//
// Requires: npm i -D ts-morph
//
// Flags:
//   1. String-literal initializers assigned to a sensitive-named variable or
//      object property (e.g. `const apiKey = "sk-live-..."`) whose value is NOT
//      an allowed placeholder.
//   2. Any string literal containing a database URL with embedded credentials
//      (e.g. "postgresql://user:pass@host/db").

import { Project, SyntaxKind } from "ts-morph";
import {
  parseArgs,
  collectTsFiles,
  report,
  isSensitiveName,
  isPlaceholderValue,
  DB_URL_CREDENTIAL_REGEX,
  assertRootsExist,
} from "./_lib.mjs";

// Extract a plain string value from a string/no-substitution-template literal.
function getStringLiteralValue(node) {
  if (!node) return null;
  const kind = node.getKind();
  if (kind === SyntaxKind.StringLiteral) return node.getLiteralValue();
  if (kind === SyntaxKind.NoSubstitutionTemplateLiteral) {
    return node.getLiteralValue();
  }
  return null;
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
  const seen = new Set(); // de-dupe (file:line) across the two passes

  const pushViolation = (node, description) => {
    const filePath = node.getSourceFile().getFilePath();
    const line = node.getStartLineNumber();
    const key = `${filePath}:${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    violations.push({
      path: filePath,
      line,
      description,
      code: node.getText().split("\n")[0],
    });
  };

  for (const sourceFile of project.getSourceFiles()) {
    // --- Pass 1: sensitive-named declarations / assignments --------------
    const named = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment),
    ];

    for (const decl of named) {
      const nameNode = decl.getNameNode?.();
      const name = nameNode ? nameNode.getText() : undefined;
      if (!name || !isSensitiveName(name)) continue;

      const init =
        decl.getInitializer?.() ??
        (decl.getKind() === SyntaxKind.PropertyAssignment
          ? decl.getInitializerOrThrow?.()
          : undefined);
      const value = getStringLiteralValue(init);
      if (value === null) continue; // not a string literal — e.g. env read

      if (isPlaceholderValue(value)) {
        pushViolation(
          decl,
          `Insecure placeholder assigned to sensitive '${name}' — use an ` +
            "environment variable with no default, or validate at startup.",
        );
      } else {
        pushViolation(
          decl,
          `Hardcoded secret in '${name}' — secrets must come from environment ` +
            "variables or a secrets manager, not source code.",
        );
      }
    }

    // --- Pass 2: any string literal with embedded DB credentials --------
    const literals = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
    ];
    for (const lit of literals) {
      const value = lit.getLiteralValue();
      if (typeof value === "string" && DB_URL_CREDENTIAL_REGEX.test(value)) {
        pushViolation(
          lit,
          "Database URL contains embedded credentials — use environment " +
            "variables for connection strings.",
        );
      }
    }
  }

  if (opts.verbose) {
    console.log(`Scanned ${project.getSourceFiles().length} files for hardcoded secrets.`);
  }
  process.exit(report(violations, opts, "Hardcoded secrets"));
}

main();
