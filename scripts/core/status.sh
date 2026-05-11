#!/bin/bash
# status.sh - Simplified status view for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONFIG_FILE="$PROJECT_ROOT/config.json"
ACTIVITY_FILE="$PROJECT_ROOT/logs/activity-log.json"

# Check if reset is requested
if [ "$1" == "--reset" ]; then
    mkdir -p "$(dirname "$ACTIVITY_FILE")"
    echo '{
  "retry": {
    "detected": 0,
    "clicked": 0
  },
  "accept": {
    "detected": 0,
    "clicked": 0,
    "blocked": 0
  }
}' > "$ACTIVITY_FILE"
    echo "✅ Đã reset bộ đếm thống kê thành công!"
    exit 0
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Lỗi: 'jq' chưa được cài đặt. Vui lòng cài đặt 'jq' để sử dụng chức năng này."
    exit 1
fi

# Check config
AUTO_RETRY=$(jq -r '.autoRetry' "$CONFIG_FILE" 2>/dev/null || echo "true")
AUTO_ACCEPT=$(jq -r '.autoAccept' "$CONFIG_FILE" 2>/dev/null || echo "true")

# Check Node process
NODE_RUNNING=$(pgrep -f "node.*src/core/auto-retry.js" > /dev/null && echo "yes" || echo "no")

# Check Antigravity App
APP_RUNNING=$(ps aux | grep "Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null && echo "yes" || echo "no")

# Check CDP Port (remote debugging)
CDP_ENABLED=$(ps aux | grep -i "Antigravity.app/Contents/MacOS/Electron" | grep -v grep | grep -q "\\-\\-remote-debugging-port=" && echo "yes" || echo "no")

# Check Auto-Start (LaunchAgent)
AUTO_START_ENABLED=$(launchctl list | grep "com.antigravity.autoretry" > /dev/null && echo "yes" || echo "no")
PLIST_EXISTS=$([ -f "$HOME/Library/LaunchAgents/com.antigravity.autoretry.plist" ] && echo "yes" || echo "no")

# Function to format status
get_status() {
    local val=$1
    if [ "$val" = "yes" ]; then
        echo -e "\033[0;32mEnabled\033[0m" # Green
    elif [ "$val" = "no" ]; then
        echo -e "\033[0;37mDisabled\033[0m" # Gray
    else
        echo -e "\033[0;31mError\033[0m" # Red
    fi
}

echo "🔍 Antigravity Auto-Click Status:"
echo "------------------------------------------------"
echo -e "Auto Retry:  $(get_status "$([ "$AUTO_RETRY" = "true" ] && [ "$NODE_RUNNING" = "yes" ] && echo "yes" || echo "no")")"
echo -e "Auto Accept: $(get_status "$([ "$AUTO_ACCEPT" = "true" ] && [ "$NODE_RUNNING" = "yes" ] && echo "yes" || echo "no")")"
echo "------------------------------------------------"
echo -e "CDP (Remote Debug):  $(get_status "$CDP_ENABLED")"
echo -e "Khởi động cùng máy:  $(get_status "$AUTO_START_ENABLED")"
echo "------------------------------------------------"

# Activity Stats
if [ -f "$ACTIVITY_FILE" ]; then
    RETRY_DET=$(jq -r '.retry.detected' "$ACTIVITY_FILE")
    RETRY_CLK=$(jq -r '.retry.clicked' "$ACTIVITY_FILE")
    ACCEPT_DET=$(jq -r '.accept.detected' "$ACTIVITY_FILE")
    ACCEPT_CLK=$(jq -r '.accept.clicked' "$ACTIVITY_FILE")
    ACCEPT_BLK=$(jq -r '.accept.blocked' "$ACTIVITY_FILE")

    echo "📊 Thống kê hoạt động (Toàn thời gian):"
    echo -e "   [Retry]  Phát hiện: \033[1m$RETRY_DET\033[0m | Click: \033[32m$RETRY_CLK\033[0m"
    echo -e "   [Accept] Phát hiện: \033[1m$ACCEPT_DET\033[0m | Click: \033[32m$ACCEPT_CLK\033[0m | Chặn: \033[31m$ACCEPT_BLK\033[0m"
    echo "------------------------------------------------"
fi

# Error details
ERRORS=""
if [ "$NODE_RUNNING" = "no" ]; then
    # Only show hint if user hasn't explicitly disabled both (unlikely)
    if [ "$AUTO_RETRY" = "true" ] || [ "$AUTO_ACCEPT" = "true" ]; then
        ERRORS="${ERRORS}ℹ️ Hệ thống đang tắt. Hãy vào menu chọn số 4 để bật lên.\n"
    fi
fi

if [ "$APP_RUNNING" = "no" ]; then
    ERRORS="${ERRORS}❌ Antigravity chưa mở -> Vui lòng mở Antigravity\n"
elif [ "$CDP_ENABLED" = "no" ]; then
    ERRORS="${ERRORS}❌ Antigravity chưa bật CDP -> Cần chạy lại Antigravity (Debug Mode)\n"
fi

if [ "$PLIST_EXISTS" = "yes" ] && [ "$AUTO_START_ENABLED" = "no" ]; then
    ERRORS="${ERRORS}⚠️ Tự động khởi động đã cài nhưng chưa được load.\n"
fi

if [ -n "$ERRORS" ]; then
    echo -e "$ERRORS"
    echo "------------------------------------------------"
fi

# Show 3 latest logs for context
LOG_FILE="$HOME/Library/Logs/AntigravityAutoRetry/stdout.log"
if [ -f "$LOG_FILE" ]; then
    echo "Dòng log cuối:"
    tail -n 3 "$LOG_FILE" | sed 's/^/  /'
    echo "------------------------------------------------"
fi
