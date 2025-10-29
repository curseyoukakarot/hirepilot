#!/usr/bin/env bash
set -euo pipefail

# Determine start URL (prefer START_URL, then LI_START_URL, then LinkedIn login)
URL="${START_URL:-${LI_START_URL:-https://www.linkedin.com/login}}"

# Pick available browser binary
CHROME=""
for c in \
  /usr/bin/google-chrome \
  /usr/bin/chromium \
  /usr/bin/chromium-browser \
; do
  if [ -x "$c" ]; then CHROME="$c"; break; fi
done

if [ -z "$CHROME" ]; then
  echo "[launch-browser] No Chrome/Chromium found in image. Sleeping to keep container alive..." >&2
  sleep 3600
  exit 1
fi

exec "$CHROME" \
  --remote-debugging-address=0.0.0.0 \
  --remote-debugging-port=9222 \
  --user-data-dir="${USER_DATA_DIR:-/home/chrome/user-data-dir}" \
  --disable-dev-shm-usage \
  --no-first-run \
  --no-default-browser-check \
  --window-size=1366,768 \
  --lang=en-US \
  "$URL"


