#!/bin/bash
# start.sh - Start Auto-Retry daemon in background

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
PLIST_NAME="com.antigravity.autoretry"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
CONFIG_FILE="$(node "$SCRIPT_DIR/print-storage-path.js" configPath)"
LOGS_DIR="$(node "$SCRIPT_DIR/print-storage-path.js" logsDir)"
DAEMON_LOG_FILE="$(node "$SCRIPT_DIR/print-storage-path.js" daemonLogPath)"

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
    mkdir -p "$LOGS_DIR"
    cd "$PROJECT_ROOT"
    nohup node src/core/auto-retry.js --config "$CONFIG_FILE" --logs "$LOGS_DIR" >> "$DAEMON_LOG_FILE" 2>&1 &
fi

echo "✅ Đã bắt đầu chạy ngầm."
echo "📊 Bạn có thể kiểm tra trạng thái ở mục số 1."
