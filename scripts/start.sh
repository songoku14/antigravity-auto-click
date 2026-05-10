#!/bin/bash
# start.sh - Start Auto-Retry daemon in background

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/AntigravityAutoRetry"
mkdir -p "$LOG_DIR"

# Kill existing process if any
pkill -f "node.*src/auto-retry.js" 2>/dev/null

echo "🚀 Đang khởi chạy Auto-Click..."

cd "$PROJECT_ROOT"
nohup node src/auto-retry.js > "$LOG_DIR/stdout.log" 2> "$LOG_DIR/stderr.log" &

echo "✅ Đã bắt đầu chạy ngầm."
echo "📊 Bạn có thể kiểm tra trạng thái ở mục số 1."
