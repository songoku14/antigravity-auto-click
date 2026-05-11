#!/bin/bash
# restart.sh - Restart Antigravity Auto-Retry Features

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🔄 Restarting Antigravity Auto-Retry..."

# 1. Stop the system
bash "$SCRIPT_DIR/stop.sh"

# 2. Short pause to ensure cleanup
echo "⏳ Waiting for cleanup..."
sleep 2

# 3. Start the system
bash "$SCRIPT_DIR/start.sh"

echo "✅ Restart complete."
