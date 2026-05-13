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
    "candidates": 0,
    "skipped": 0,
    "detected": 0,
    "clicked": 0
  },
  "accept": {
    "candidates": 0,
    "skipped": 0,
    "detected": 0,
    "clicked": 0,
    "blocked": 0,
    "clickedByCategory": {}
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
AUTO_RETRY=$(jq -r '
  if (.autoRetry | type) == "object" then
    (if .autoRetry.enabled == null then true else .autoRetry.enabled end)
  else
    (if .autoRetry == null then true else .autoRetry end)
  end
' "$CONFIG_FILE" 2>/dev/null || echo "true")
AUTO_ACCEPT=$(jq -r '
  if (.autoAccept | type) == "object" then
    (if .autoAccept.enabled == null then true else .autoAccept.enabled end)
  else
    (if .autoAccept == null then true else .autoAccept end)
  end
' "$CONFIG_FILE" 2>/dev/null || echo "true")

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
        echo -e "\033[0;32mACTIVE\033[0m" # Green
    elif [ "$val" = "no" ]; then
        echo -e "\033[0;31mOFF\033[0m"    # Red
    else
        echo -e "\033[0;31mError\033[0m"  # Red
    fi
}



# Activity Stats
if [ -f "$ACTIVITY_FILE" ]; then
    RETRY_DET=$(jq -r '.retry.detected // 0' "$ACTIVITY_FILE")
    RETRY_CLK=$(jq -r '.retry.clicked // 0' "$ACTIVITY_FILE")
    ACCEPT_DET=$(jq -r '.accept.detected // 0' "$ACTIVITY_FILE")
    ACCEPT_CLK=$(jq -r '.accept.clicked // 0' "$ACTIVITY_FILE")
    ACCEPT_BLK=$(jq -r '.accept.blocked // 0' "$ACTIVITY_FILE")
    RETRY_SKP=$(jq -r '(.retry.skipped // ([.skipReasons // {} | to_entries[]? | select(.key | startswith("retry:")) | (.value // 0)] | add)) // 0' "$ACTIVITY_FILE")
    ACCEPT_SKP=$(jq -r '(.accept.skipped // ([.skipReasons // {} | to_entries[]? | select(.key | startswith("accept:")) | (.value // 0)] | add)) // 0' "$ACTIVITY_FILE")
    RETRY_CAN=$(jq -r "(.retry.candidates // ($RETRY_DET + $RETRY_SKP)) // 0" "$ACTIVITY_FILE")
    ACCEPT_CAN=$(jq -r "(.accept.candidates // ($ACCEPT_DET + $ACCEPT_SKP)) // 0" "$ACTIVITY_FILE")

    echo "📊 Thống kê hoạt động (Toàn thời gian):"
    echo -e "   [Retry]  Ứng viên: \033[1m$RETRY_CAN\033[0m | Bỏ qua: \033[33m$RETRY_SKP\033[0m | Qua lọc: \033[36m$RETRY_DET\033[0m | Click: \033[32m$RETRY_CLK\033[0m"
    echo -e "   [Accept] Ứng viên: \033[1m$ACCEPT_CAN\033[0m | Bỏ qua: \033[33m$ACCEPT_SKP\033[0m | Qua lọc: \033[36m$ACCEPT_DET\033[0m | Click: \033[32m$ACCEPT_CLK\033[0m | Chặn: \033[31m$ACCEPT_BLK\033[0m"
    
    # Accept breakdown by category (based on detections/passed)
    ACCEPT_CATS=$(jq -r '.accept.detectedByCategory // {} | to_entries | map("\(.key|ascii_upcase): \(.value)") | join(" | ")' "$ACTIVITY_FILE")
    if [ -n "$ACCEPT_CATS" ] && [ "$ACCEPT_CATS" != "" ]; then
        echo -e "            ↳ Chi tiết (Qua lọc): \033[32m$ACCEPT_CATS\033[0m"
    fi
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
