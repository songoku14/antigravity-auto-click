#!/bin/bash
# uninstall.sh - Remove Auto-Retry LaunchAgent completely

PLIST_NAME="com.antigravity.autoretry"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$HOME/Library/Logs/AntigravityAutoRetry"

echo "🗑  Uninstalling Antigravity Auto-Retry..."

# Stop the agent
if [ -f "$PLIST_DST" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null
  rm -f "$PLIST_DST"
  echo "✅ LaunchAgent removed."
else
  echo "ℹ️  LaunchAgent not found."
fi

# Kill any running instances
pkill -f "auto-retry.js" 2>/dev/null

# Remove logs
if [ -d "$LOG_DIR" ]; then
  rm -rf "$LOG_DIR"
  echo "✅ Logs removed."
fi

echo ""
echo "✅ Uninstall complete."
echo "   Note: Project files in $(cd "$(dirname "$0")/.." && pwd) are preserved."
echo "   To remove completely: rm -rf $(cd "$(dirname "$0")/.." && pwd)"
