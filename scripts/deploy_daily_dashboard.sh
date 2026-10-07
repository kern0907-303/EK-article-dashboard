#!/bin/bash
# Brand Intelligence OS - Auto Publish Hook
# This script automatically commits and pushes the updated operations/site/ files to GitHub.

if ! cd "$(dirname "$0")/.."; then
    echo "Unable to enter project directory." >&2
    exit 1
fi

# Load PATH to ensure git command is available in launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

echo "=== Auto-publishing daily web dashboard ==="

alert_sent=0

send_push_failure_alert() {
    if [[ "$alert_sent" -eq 1 ]]; then
        return 0
    fi
    alert_sent=1

    if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
        echo "Telegram alert could not be sent because configuration is missing." >&2
        return 1
    fi

    "${PYTHON_BIN:-python3}" - <<'PY'
import json
import os
import urllib.request

token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
message = "每日報告網站自動發佈失敗，請檢查 GitHub 推送狀態。"
if not token or not chat_id:
    raise SystemExit(1)

request = urllib.request.Request(
    f"https://api.telegram.org/bot{token}/sendMessage",
    data=json.dumps({"chat_id": chat_id, "text": message}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        if response.status < 200 or response.status >= 300:
            raise SystemExit(1)
except Exception:
    raise SystemExit(1)
PY
    if [[ $? -ne 0 ]]; then
        echo "Telegram failure alert could not be delivered." >&2
        return 1
    fi
    echo "Telegram failure alert delivered."
}

fail_publish() {
    local reason="$1"
    echo "=== Auto-publish failed: ${reason} ===" >&2
    send_push_failure_alert || true
    exit 1
}

# Check if there are changes in operations/site
if [[ -n $(git status --porcelain operations/site/) ]]; then
    git add operations/site/
    if ! git commit -m "chore: auto-publish daily dashboard for $(date '+%Y-%m-%d')"; then
        fail_publish "local commit did not complete"
    fi

    if ! git pull --rebase --autostash origin main; then
        fail_publish "unable to rebase on origin main"
    fi

    if git push origin main; then
        echo "=== Auto-publish completed successfully! ==="
        exit 0
    fi

    echo "First push attempt failed. Updating from origin main before one retry." >&2
    if git pull --rebase --autostash origin main && git push origin main; then
        echo "=== Auto-publish completed successfully after one retry! ==="
        exit 0
    fi

    fail_publish "push failed after one retry"
else
    echo "No new dashboard changes to publish."
fi
exit 0
