#!/bin/bash
# status.sh - Check status of Antigravity Auto-Retry daemon

PLIST_NAME="com.antigravity.autoretry"
LOG_DIR="$HOME/Library/Logs/AntigravityAutoRetry"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

echo "🔍 Kiểm tra trạng thái Antigravity Auto-Retry..."
echo "------------------------------------------------"

# 1. Kiểm tra LaunchAgent của macOS
if launchctl list | grep -q "$PLIST_NAME"; then
    PID=$(launchctl list | grep "$PLIST_NAME" | awk '{print $1}')
    if [ "$PID" != "-" ] && [ -n "$PID" ]; then
        echo "✅ LaunchAgent (Service ngầm): ĐANG CHẠY (PID: $PID)"
    else
        echo "⚠️ LaunchAgent: Đã load nhưng chưa cấp PID (có thể đang khởi động lại hoặc lỗi)"
    fi
else
    echo "❌ LaunchAgent: KHÔNG CHẠY (Chưa được cài đặt hoặc đã bị dừng)"
fi

echo "------------------------------------------------"

# 2. Kiểm tra tiến trình Node.js thực tế
NODE_PIDS=$(pgrep -f "node.*src/auto-retry.js" || true)
if [ -n "$NODE_PIDS" ]; then
    PIDS_FORMATTED=$(echo $NODE_PIDS | tr '\n' ' ')
    echo "✅ Tiến trình Node.js: ĐANG HOẠT ĐỘNG (PID: $PIDS_FORMATTED)"
else
    echo "❌ Tiến trình Node.js: KHÔNG TÌM THẤY (Chưa chạy)"
fi

echo "------------------------------------------------"

# 3. Xem nhanh 5 dòng log cuối cùng để biết đang làm gì
echo "📄 Log hoạt động mới nhất (stdout):"
if [ -f "$LOG_DIR/stdout.log" ]; then
    tail -n 5 "$LOG_DIR/stdout.log" | sed 's/^/   /'
else
    echo "   [Chưa có file log hoạt động nào được sinh ra]"
fi

echo "------------------------------------------------"
echo "💡 Các lệnh hữu ích:"
echo "   - Xem log liên tục:  tail -f $LOG_DIR/stdout.log"
echo "   - Chạy kiểm tra:     node ./scripts/trigger-test.js"
echo "   - Cài lại/Bật lại:   ./scripts/install.sh"
echo "   - Gỡ/Dừng hẳn:       ./scripts/uninstall.sh"
