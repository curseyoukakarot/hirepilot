// _lib.mjs — Shared constants and helpers for the TypeScript (ts-morph) check track.
//
// Requires: npm i -D ts-morph
//
// Constants lifted from the Brain Python pre-commit checks so the TS variants
// stay behaviorally aligned with their Python counterparts:
//
//   DB_URL_CREDENTIAL_REGEX  ← scripts/check_hardcoded_secrets.py  (DB_URL_PATTERN)
//   PLACEHOLDER_VALUES       ← scripts/check_hardcoded_secrets.py  (PLACEHOLDER_VALUES + SAFE_VALUES)
//                              + scripts/check_env_var_defaults.py (SAFE_DEFAULT_PATTERNS literals)
//   SENSITIVE_NAME_PATTERNS  ← scripts/check_hardcoded_secrets.py  (SENSITIVE_VAR_PATTERNS)
//                              + scripts/check_sensitive_field_logging.py
//                                (SENSITIVE_KWARG_NAMES + PAYLOAD_KWARG_NAMES)
//                              + scripts/check_env_var_defaults.py (SENSITIVE_VAR_PATTERNS)
//
// All comparisons are done lowercase. SENSITIVE_NAME_PATTERNS is an array of
// lowercase substrings; use `isSensitiveName()` for matching.

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// DB URL with embedded credentials
// Lifted from check_hardcoded_secrets.py:
//   r"(?:postgresql|mysql|sqlite|redis|mongodb|amqp)(?:\+\w+)?://[^:]+:[^@]+@"
// Faithful JS translation (the `+` in e.g. postgresql+asyncpg is optional).
// ---------------------------------------------------------------------------
export const DB_URL_CREDENTIAL_REGEX =
  /(?:postgresql|mysql|sqlite|redis|mongodb|amqp)(?:\+\w+)?:\/\/[^:]+:[^@]+@/;

// ---------------------------------------------------------------------------
// Sensitive variable / field / env-var names.
// Lowercase substrings — a name is "sensitive" if it CONTAINS one of these.
// Merged from the three Python checks (see header). De-duplicated.
// ---------------------------------------------------------------------------
export const SENSITIVE_NAME_PATTERNS = [
  // check_hardcoded_secrets.py — SENSITIVE_VAR_PATTERNS
  "password",
  "password_hash",
  "secret",
  "secret_key",
  "jwt_secret",
  "api_key",
  "apikey",
  "api_secret",
  "private_key",
  "client_secret",
  "access_token",
  "refresh_token",
  "encryption_key",
  "signing_key",
  "auth_token",
  "auth_key",
  "bearer_token",
  // check_sensitive_field_logging.py — SENSITIVE_KWARG_NAMES (additional)
  "token",
  "credentials",
  "authorization",
  "bearer",
  "session_id",
  "cookie",
  // check_env_var_defaults.py — SENSITIVE_VAR_PATTERNS (additional)
  "webhook_secret",
  // check_sensitive_field_logging.py — PAYLOAD_KWARG_NAMES (full-payload leakage)
  "request_body",
  "request_data",
];

// Names that contain a sensitive substring but are NOT actually secrets.
// Lifted from check_env_var_defaults.py — SAFE_FIELD_NAMES.
export const SAFE_NAME_PATTERNS = [
  "token_type",
  "password_hash_deprecated",
  "password_min_length",
  "password_max_length",
  "password_require_",
  "password_special_chars",
  "token_ttl",
  "token_expir",
  "secret_version",
];

// ---------------------------------------------------------------------------
// Placeholder / obviously-fake values that should be allowed (not flagged as a
// real hardcoded secret). Lowercased for comparison.
// Lifted from check_hardcoded_secrets.py (PLACEHOLDER_VALUES + SAFE_VALUES) and
// check_env_var_defaults.py (SAFE_DEFAULT_PATTERNS literals).
// ---------------------------------------------------------------------------
export const PLACEHOLDER_VALUES = [
  "", // empty string
  "none",
  "null",
  "change-me",
  "changeme",
  "change_me",
  "replace-me",
  "your-secret-here",
  "your-api-key-here",
  "your-key-here",
  "xxx",
  "todo",
  "fixme",
  "placeholder",
];

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/** True if `name` contains a sensitive substring and is not a known-safe name. */
export function isSensitiveName(name) {
  if (!name) return false;
  const lower = String(name).toLowerCase();
  if (SAFE_NAME_PATTERNS.some((safe) => lower.includes(safe))) return false;
  return SENSITIVE_NAME_PATTERNS.some((pat) => lower.includes(pat));
}

/** True if `value` is an allowed placeholder / obviously-fake value. */
export function isPlaceholderValue(value) {
  if (value === undefined || value === null) return true;
  return PLACEHOLDER_VALUES.includes(String(value).trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

/** Parse `--strict` / `--verbose` (`-v`) and positional scan roots out of argv. */
export function parseArgs(argv = process.argv.slice(2)) {
  return {
    strict: argv.includes("--strict"),
    verbose: argv.includes("--verbose") || argv.includes("-v"),
    roots: argv.filter((a) => !a.startsWith("-")),
  };
}

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
]);

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);

/**
 * Recursively collect TypeScript files under each root directory.
 * Skips node_modules/.git/dist/build and declaration files (*.d.ts).
 */
export function collectTsFiles(roots = ["src"]) {
  const out = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // root doesn't exist — skip silently
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".d.ts")) continue;
        if (TS_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
      }
    }
  };

  for (const root of roots) walk(root);
  return out.sort();
}

/**
 * When explicit scan roots are provided on the CLI, fail fast if any doesn't
 * exist or isn't a directory. Otherwise a mistyped root silently scans zero
 * files and a --strict check passes green.
 */
export function assertRootsExist(roots) {
  const missing = roots.filter((r) => {
    try {
      return !fs.statSync(r).isDirectory();
    } catch {
      return true;
    }
  });
  if (missing.length) {
    console.error(`Scan root(s) not found or not a directory: ${missing.join(", ")}`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/**
 * A violation: { path, line, description, code }.
 *
 * Print findings and return the process exit code:
 *   1 if `strict` and there are violations, else 0.
 */
export function report(violations, { strict, verbose } = {}, title = "Violations") {
  if (violations.length === 0) {
    if (verbose) console.log("No violations found.");
    return 0;
  }

  console.log(`${title.toUpperCase()} FOUND:`);
  console.log("-".repeat(60));
  for (const v of violations) {
    console.log(`\n  File: ${v.path}`);
    console.log(`  Line: ${v.line}`);
    console.log(`  Issue: ${v.description}`);
    if (v.code) console.log(`  Code:  ${v.code.trim()}`);
  }
  console.log("");

  if (strict) {
    console.log("STRICT MODE: Failing due to violations found.");
    return 1;
  }
  console.log("WARN MODE: Violations found but not failing.");
  return 0;
}
