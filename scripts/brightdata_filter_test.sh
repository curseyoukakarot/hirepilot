#!/usr/bin/env bash
set -euo pipefail

API_BASE="https://api.brightdata.com"

BRIGHTDATA_API_KEY="${BRIGHTDATA_API_KEY:-}"
DATASET_ID="${DATASET_ID:-}"

# Config
RECORDS_LIMIT="${RECORDS_LIMIT:-100}"
FILTER_EXAMPLE="${FILTER_EXAMPLE:-simple}" # simple | role_keyword
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-3}"
POLL_TIMEOUT_SECONDS="${POLL_TIMEOUT_SECONDS:-90}"

OUT_FILE="${OUT_FILE:-tmp/brightdata_snapshot.json}"

# Simple filter (used by FILTER_EXAMPLE=simple). Override per dataset.
# Tip: "=" is often too strict; try SIMPLE_OPERATOR=includes with SIMPLE_VALUE_JSON='["John"]'
SIMPLE_FIELD_NAME="${SIMPLE_FIELD_NAME:-name}"
SIMPLE_OPERATOR="${SIMPLE_OPERATOR:-=}"
SIMPLE_VALUE="${SIMPLE_VALUE:-John}"
# If set, this is used verbatim as the JSON value (e.g. '"John"' or '["John","Jane"]' or 'null')
SIMPLE_VALUE_JSON="${SIMPLE_VALUE_JSON:-}"

# Fields (used by FILTER_EXAMPLE=role_keyword). Override to match dataset schema.
ROLE_FIELD_NAME="${ROLE_FIELD_NAME:-headline}"            # e.g. title | headline
KEYWORDS_FIELD_NAME="${KEYWORDS_FIELD_NAME:-skills}"      # e.g. skills | summary
MIN_FIELD_NAME="${MIN_FIELD_NAME:-years_experience}"      # optional
MIN_FIELD_VALUE="${MIN_FIELD_VALUE:-3}"

# JSON arrays (strings) to keep it copy/paste friendly.
ROLE_VALUES_JSON="${ROLE_VALUES_JSON:-'[\"network engineer\",\"network architect\"]'}"
KEYWORD_VALUES_JSON="${KEYWORD_VALUES_JSON:-'[\"sd-wan\",\"sdwan\",\"viptela\",\"velocloud\",\"versa\",\"edgeconnect\"]'}"

if [[ -z "$BRIGHTDATA_API_KEY" ]]; then
  echo "Set BRIGHTDATA_API_KEY (Bright Data API token)" >&2
  exit 1
fi

if [[ -z "$DATASET_ID" ]]; then
  echo "Set DATASET_ID (e.g. gd_l1viktl72bvl7bjuj0)" >&2
  exit 1
fi

if ! [[ "$RECORDS_LIMIT" =~ ^[0-9]+$ ]]; then
  echo "RECORDS_LIMIT must be an integer (got: $RECORDS_LIMIT)" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

json_get() {
  # Reads JSON from stdin and prints the requested key via jq if available,
  # otherwise via python3.
  local expr="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r "$expr" 2>/dev/null || true
    return 0
  fi

  python3 - <<'PY' "$expr"
import json,sys
expr=sys.argv[1]
try:
  data=json.load(sys.stdin)
except Exception:
  sys.exit(0)

# Minimal selector support for common fields used in this script.
# Supported expressions: '.foo', '.foo.bar', and '(.a // .b // .c)'

def get_path(obj, path):
  cur=obj
  for part in path.split('.'):
    if part=="":
      continue
    if isinstance(cur, dict) and part in cur:
      cur=cur[part]
    else:
      return None
  return cur

def eval_simple(e):
  e=e.strip()
  if e.startswith('(') and e.endswith(')'):
    e=e[1:-1].strip()
  # handle a // b // c
  parts=[p.strip() for p in e.split('//')]
  for p in parts:
    if p.startswith('.'):
      val=get_path(data, p[1:])
      if val is not None:
        return val
  return None

val=eval_simple(expr)
if val is None:
  sys.exit(0)
if isinstance(val, (dict, list)):
  print(json.dumps(val))
else:
  print(val)
PY
}

echo "→ Listing datasets (sanity check / find dataset IDs)"
curl -sS --request GET \
  --url "$API_BASE/datasets/list" \
  --header "Authorization: Bearer $BRIGHTDATA_API_KEY" \
  | head -c 2000 || true

echo

echo "→ Creating filtered snapshot (FILTER_EXAMPLE=$FILTER_EXAMPLE)"

filter_payload=""
if [[ "$FILTER_EXAMPLE" == "simple" ]]; then
  value_json="$SIMPLE_VALUE_JSON"
  if [[ -z "$value_json" ]]; then
    # Note: keeps it simple; if you need escaping, set SIMPLE_VALUE_JSON explicitly.
    value_json="\"$SIMPLE_VALUE\""
  fi
  filter_payload=$(cat <<EOF
{
  "dataset_id": "$DATASET_ID",
  "records_limit": $RECORDS_LIMIT,
  "filter": { "name": "$SIMPLE_FIELD_NAME", "operator": "$SIMPLE_OPERATOR", "value": $value_json }
}
EOF
)
elif [[ "$FILTER_EXAMPLE" == "role_keyword" ]]; then
  filter_payload=$(cat <<EOF
{
  "dataset_id": "$DATASET_ID",
  "records_limit": $RECORDS_LIMIT,
  "filter": {
    "operator": "and",
    "filters": [
      { "name": "$ROLE_FIELD_NAME", "operator": "in", "value": $ROLE_VALUES_JSON },
      { "name": "$KEYWORDS_FIELD_NAME", "operator": "includes", "value": $KEYWORD_VALUES_JSON },
      { "name": "$MIN_FIELD_NAME", "operator": ">=", "value": $MIN_FIELD_VALUE }
    ]
  }
}
EOF
)
else
  echo "Unknown FILTER_EXAMPLE: $FILTER_EXAMPLE (expected: simple | role_keyword)" >&2
  exit 1
fi

create_resp="$(curl -sS --request POST \
  --url "$API_BASE/datasets/filter" \
  --header "Authorization: Bearer $BRIGHTDATA_API_KEY" \
  --header "Content-Type: application/json" \
  --data "$filter_payload" \
  || true)"

snapshot_id="$(printf '%s' "$create_resp" | json_get '(.snapshot_id // .snapshotId // .id)')"

if [[ -z "$snapshot_id" || "$snapshot_id" == "null" ]]; then
  echo "Failed to parse SNAPSHOT_ID from response:" >&2
  echo "$create_resp" >&2
  exit 1
fi

echo "SNAPSHOT_ID=$snapshot_id"

echo "→ Polling snapshot status (every ${POLL_INTERVAL_SECONDS}s up to ${POLL_TIMEOUT_SECONDS}s)"

attempts=$((POLL_TIMEOUT_SECONDS / POLL_INTERVAL_SECONDS))
if (( attempts < 1 )); then
  attempts=1
fi

status=""
last_resp=""
for ((i=1; i<=attempts; i++)); do
  last_resp="$(curl -sS --request GET \
    --url "$API_BASE/datasets/snapshots/$snapshot_id" \
    --header "Authorization: Bearer $BRIGHTDATA_API_KEY" \
    || true)"

  status="$(printf '%s' "$last_resp" | json_get '(.status // .snapshot.status // .data.status)')"

  if [[ "$status" == "ready" ]]; then
    echo "✓ Snapshot is ready"
    break
  fi

  if [[ "$status" == "failed" ]]; then
    echo "✗ Snapshot failed" >&2
    echo "$last_resp" >&2
    exit 2
  fi

  echo "  - status=${status:-unknown} (attempt $i/$attempts)"
  sleep "$POLL_INTERVAL_SECONDS"
done

if [[ "$status" != "ready" ]]; then
  echo "Timed out waiting for snapshot to become ready" >&2
  echo "$last_resp" >&2
  exit 3
fi

echo "→ Downloading snapshot to $OUT_FILE"

tmp_body="$OUT_FILE.tmp"
http_code="$(curl -sS -L --request GET \
  --url "$API_BASE/datasets/snapshots/$snapshot_id/download" \
  --header "Authorization: Bearer $BRIGHTDATA_API_KEY" \
  --output "$tmp_body" \
  --write-out "%{http_code}" \
  || true)"

echo "  - http=$http_code"

if [[ "$http_code" != "200" ]]; then
  echo "Download did not return 200 (got $http_code). Response body:" >&2
  # best-effort: show up to 2KB
  head -c 2000 "$tmp_body" >&2 || true
  rm -f "$tmp_body" || true
  exit 4
fi

mv "$tmp_body" "$OUT_FILE"

echo "✓ Downloaded: $OUT_FILE"