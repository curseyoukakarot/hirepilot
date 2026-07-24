#!/usr/bin/env node
// check-sensitive-field-logging.mjs
// TypeScript port of brain/scripts/check_sensitive_field_logging.py.
//
// Requires: npm i -D ts-morph
//
// Flags logger/console calls that surface sensitive data:
//   1. Object-argument property keys matching a sensitive name, e.g.
//        logger.info("login", { password })
//        console.log({ access_token: t })
//   2. Template-literal identifiers/properties matching a sensitive name, e.g.
//        logger.info(`token issued: ${accessToken}`)
//
// Sensitive names are the shared SENSITIVE_NAME_PATTERNS lifted from the Python
// checks (passwords, tokens, secrets, request bodies, ...).

import { Project, SyntaxKind } from "ts-morph";
import {
  parseArgs,
  collectTsFiles,
  report,
  isSensitiveName,
  assertRootsExist,
} from "./_lib.mjs";

const LOG_OBJECTS = new Set(["logger", "log", "logging", "console"]);
const LOG_METHODS = new Set([
  "debug",
  "info",
  "warn",
  "warning",
  "error",
  "exception",
  "critical",
  "log",
  "trace",
  "fatal",
]);

// Is this a `logger.info(...)` / `console.log(...)` / `this.logger.warn(...)` call?
function isLogCall(callExpr) {
  const expr = callExpr.getExpression();
  if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  if (!LOG_METHODS.has(expr.getName())) return false;

  const obj = expr.getExpression();
  const objText = obj.getText();
  if (LOG_OBJECTS.has(objText)) return true;
  // this.logger.* / app.log.*
  if (obj.getKind() === SyntaxKind.PropertyAccessExpression) {
    return LOG_OBJECTS.has(obj.getName());
  }
  return false;
}

// Collect sensitive object-property keys from an object literal argument.
function checkObjectArg(objLiteral, found) {
  for (const prop of objLiteral.getProperties()) {
    let key = null;
    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
      key = prop.getNameNode().getText().replace(/['"]/g, "");
    } else if (prop.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
      key = prop.getName();
    }
    if (key && isSensitiveName(key)) found.add(key);
  }
}

// Collect sensitive identifiers interpolated in a template literal argument.
function checkTemplateArg(template, found) {
  for (const span of template.getDescendantsOfKind(SyntaxKind.TemplateSpan)) {
    const expr = span.getExpression();
    // ${accessToken}
    if (expr.getKind() === SyntaxKind.Identifier) {
      if (isSensitiveName(expr.getText())) found.add(expr.getText());
    }
    // ${user.password} / ${req.body}
    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const name = expr.getName();
      if (isSensitiveName(name)) found.add(name);
    }
  }
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
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!isLogCall(call)) continue;

      const found = new Set();
      for (const arg of call.getArguments()) {
        const kind = arg.getKind();
        if (kind === SyntaxKind.ObjectLiteralExpression) {
          checkObjectArg(arg, found);
        } else if (kind === SyntaxKind.TemplateExpression) {
          checkTemplateArg(arg, found);
        }
      }

      if (found.size) {
        violations.push({
          path: filePath,
          line: call.getStartLineNumber(),
          description:
            `Log call surfaces sensitive field(s): ${[...found].join(", ")} — ` +
            "secrets and full payloads must not appear in logs. Log identifiers instead.",
          code: call.getText().split("\n")[0],
        });
      }
    }
  }

  if (opts.verbose) {
    console.log(`Scanned ${project.getSourceFiles().length} files for sensitive logging.`);
  }
  process.exit(report(violations, opts, "Sensitive field logging"));
}

main();
