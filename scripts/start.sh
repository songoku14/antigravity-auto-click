#!/bin/bash
# start.sh - Start Auto-Retry daemon in foreground (for manual use)

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🚀 Starting Antigravity Auto-Retry (foreground mode)..."
echo "   Press Ctrl+C to stop"
echo ""

cd "$SCRIPT_DIR"
node src/auto-retry.js
