#!/bin/bash
# stop.sh - Stop Auto-Retry daemon

PLIST_NAME="com.antigravity.autoretry"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "🛑 Stopping Antigravity Auto-Retry..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

echo "🧹 Cleaning injected scripts from Antigravity..."
node "$PROJECT_ROOT/src/core/cleanup-injected.js" 2>/dev/null || true

if [ -f "$PLIST_DST" ]; then
  launchctl unload "$PLIST_DST" 2>/dev/null
  echo "✅ LaunchAgent unloaded."
else
  echo "⚠️  LaunchAgent plist not found at $PLIST_DST"
fi

# Also kill any running instances
pkill -f "src/core/auto-retry.js" 2>/dev/null && echo "✅ Process killed." || echo "ℹ️  No running process found."
