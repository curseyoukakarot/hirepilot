#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BACKEND_URL:-http://localhost:8080}"
TOKEN="${BEARER_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "Set BEARER_TOKEN with a valid access token" >&2
  exit 1
fi

echo "→ Dry-run test"
curl -s -X POST "$BASE_URL/api/sniper/test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"test_user","sampleSize":50}' | jq . || true

echo "✓ Smoke done"


