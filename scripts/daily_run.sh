#!/bin/bash
# Brand Intelligence OS - Daily Automated Run Script
# Configured to run every morning at 07:00 local time

# 1. cd into project root
cd "$(dirname "$0")/.."

# 2. Safely load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 3. Create log directory
mkdir -p operations/logs

TODAY=$(date "+%Y-%m-%d")
LOG_FILE="operations/logs/${TODAY}_0700.log"

echo "=== Daily Production Run Started: $(date) ===" | tee -a "$LOG_FILE"

# 4. Execute the daily production run command
python3 run_source_os.py --daily-production-run 2>&1 | tee -a "$LOG_FILE"

echo "=== Daily Production Run Finished: $(date) ===" | tee -a "$LOG_FILE"
