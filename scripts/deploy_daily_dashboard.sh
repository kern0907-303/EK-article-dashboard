#!/bin/bash
# Brand Intelligence OS - Auto Publish Hook
# This script automatically commits and pushes the updated operations/site/ files to GitHub.

cd "$(dirname "$0")/.."

# Load PATH to ensure git command is available in launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

echo "=== Auto-publishing daily web dashboard ==="

# Check if there are changes in operations/site
if [[ -n $(git status --porcelain operations/site/) ]]; then
    git add operations/site/
    git commit -m "chore: auto-publish daily dashboard for $(date '+%Y-%m-%d')"
    git push origin main
    echo "=== Auto-publish completed successfully! ==="
else
    echo "No new dashboard changes to publish."
fi
exit 0
