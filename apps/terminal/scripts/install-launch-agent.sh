#!/usr/bin/env bash
set -euo pipefail

LABEL="com.folo.terminal"
PORT="${FOLO_PORT:-3847}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENTRY="$APP_DIR/dist/index.js"
NODE_BIN="$(command -v node)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/folo-terminal.log"
DOMAIN="gui/$(id -u)"

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed $LABEL"
  exit 0
fi

if [[ ! -f "$ENTRY" ]]; then
  echo "Missing $ENTRY. Run 'pnpm build' in apps/terminal first." >&2
  exit 1
fi

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"

NODE_BIN="$NODE_BIN" ENTRY="$ENTRY" PLIST="$PLIST" LOG="$LOG" PORT="$PORT" LABEL="$LABEL" python3 <<'PY'
import os
import plistlib
from pathlib import Path

payload = {
    "Label": os.environ["LABEL"],
    "ProgramArguments": [
        os.environ["NODE_BIN"],
        os.environ["ENTRY"],
        "--server-only",
        "--port",
        os.environ["PORT"],
    ],
    "WorkingDirectory": str(Path(os.environ["ENTRY"]).parent.parent),
    "EnvironmentVariables": {
        "PATH": f"{Path(os.environ['NODE_BIN']).parent}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
        "NODE_ENV": "production",
    },
    "RunAtLoad": True,
    "KeepAlive": {"SuccessfulExit": False},
    "ProcessType": "Background",
    "StandardOutPath": os.environ["LOG"],
    "StandardErrorPath": os.environ["LOG"],
}

with Path(os.environ["PLIST"]).open("wb") as handle:
    plistlib.dump(payload, handle, sort_keys=False)
PY

plutil -lint "$PLIST"
launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl kickstart -k "$DOMAIN/$LABEL"

for _ in {1..80}; do
  if curl --noproxy '*' --fail --silent "http://127.0.0.1:$PORT/api/health" >/dev/null; then
    echo "Folo terminal service is running at http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 0.25
done

echo "Folo terminal service failed to become healthy. See $LOG" >&2
exit 1
