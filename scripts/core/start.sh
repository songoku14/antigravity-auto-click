#!/bin/bash
# start.sh - Start Auto-Retry daemon in background

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
PLIST_NAME="com.antigravity.autoretry"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

# Check if LaunchAgent exists
if [ -f "$PLIST_DST" ]; then
    echo "📋 Phát hiện LaunchAgent. Đang nạp và bắt đầu..."
    launchctl unload "$PLIST_DST" 2>/dev/null || true
    launchctl load "$PLIST_DST"
    launchctl start "$PLIST_NAME"
else
    echo "🚀 Đang khởi chạy daemon trực tiếp..."
    # Kill existing process if any
    pkill -f "node.*src/core/auto-retry.js" 2>/dev/null || true
    
    # Run in background
    mkdir -p "$PROJECT_ROOT/logs"
    cd "$PROJECT_ROOT"
    nohup node src/core/auto-retry.js >> "$PROJECT_ROOT/logs/daemon.log" 2>&1 &
fi

echo "✅ Đã bắt đầu chạy ngầm."
echo "📊 Bạn có thể kiểm tra trạng thái ở mục số 1."
