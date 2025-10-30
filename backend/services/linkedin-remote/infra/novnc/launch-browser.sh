#!/usr/bin/env bash
set -euo pipefail

# Determine start URL (prefer START_URL, then LI_START_URL, then LinkedIn login)
URL="${START_URL:-${LI_START_URL:-https://www.linkedin.com/login}}"

# Ensure DISPLAY is set for Chrome
export DISPLAY="${DISPLAY:-:99}"

# Give Xvfb a moment to fully initialize and set a solid background to trigger framebuffer
sleep 3
xsetroot -solid black || true
xrandr -display :99 -s 1366x768 || true
xdotool mousemove 10 10 || true

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
  --disable-gpu \
  --disable-software-rasterizer \
  --disable-dev-shm-usage \
  --disable-features=UseOzonePlatform \
  --no-first-run \
  --no-default-browser-check \
  --window-size=1366,768 \
  --lang=en-US \
  "$URL"


