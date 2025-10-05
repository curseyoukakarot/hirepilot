#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$USER_DATA_DIR"

# Start Xvfb + window manager + Chrome + x11vnc + noVNC via supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf


