# Auto Scheduler Setup Guide

This guide details how to configure the daily automated execution of the Brand Intelligence OS at **07:00 local time** on macOS.

---

## 1. macOS launchd Plist Configuration

Create a launchd property list file named `com.brandos.dailyrun.plist` in the user's agents directory:

`~/Library/LaunchAgents/com.brandos.dailyrun.plist`

### Plist Content

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.brandos.dailyrun</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/erickair/.gemini/antigravity/scratch/ai_content_factory/scripts/daily_run.sh</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/erickair/.gemini/antigravity/scratch/ai_content_factory/operations/logs/launchd_output.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/erickair/.gemini/antigravity/scratch/ai_content_factory/operations/logs/launchd_error.log</string>
</dict>
</plist>
```

### Loading the Scheduler

Run the following commands to load and activate the launchd agent:

```bash
# Load the agent
launchctl load ~/Library/LaunchAgents/com.brandos.dailyrun.plist

# Verify it is loaded
launchctl list | grep com.brandos.dailyrun
```

---

## 2. macOS Sleep & Wake Recommendations

Since macOS `launchd` jobs do not run while the computer is sleeping, follow these recommendations to ensure 07:00 execution:

### Recommendation A: Prevent Sleeping during Execution
Keep the system awake or configure the Energy Saver settings.
```bash
# Temporarily prevent sleeping using caffeinate:
caffeinate -d -i -m -u -t 86400 &
```

### Recommendation B: Schedule a Daily Wake Event via pmset
You can schedule the Mac to wake up automatically at 06:55 AM (5 minutes before the daily run):
```bash
# Schedule daily wake up at 06:55
sudo pmset repeat wakeorpoweron MTWRFSU 06:55:00
```
*(Requires Administrator/sudo privileges).*
