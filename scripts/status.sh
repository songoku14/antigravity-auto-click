#!/bin/bash
# status.sh - Simplified status view for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/config.json"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Lỗi: 'jq' chưa được cài đặt. Vui lòng cài đặt 'jq' để sử dụng chức năng này."
    exit 1
fi

# Check config
AUTO_RETRY=$(jq -r '.autoRetry' "$CONFIG_FILE" 2>/dev/null || echo "true")
AUTO_ACCEPT=$(jq -r '.autoAccept' "$CONFIG_FILE" 2>/dev/null || echo "true")

# Check Node process
NODE_RUNNING=$(pgrep -f "node.*src/auto-retry.js" > /dev/null && echo "yes" || echo "no")

# Check Antigravity App
APP_RUNNING=$(ps aux | grep "Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null && echo "yes" || echo "no")

# Check CDP Port (remote debugging)
CDP_ENABLED=$(ps aux | grep -i "Antigravity.app/Contents/MacOS/Electron" | grep -v grep | grep -q "\\-\\-remote-debugging-port=" && echo "yes" || echo "no")

# Function to format status
get_status() {
    local enabled=$1
    if [ "$enabled" != "true" ]; then
        echo -e "\033[0;37mDisabled\033[0m" # Gray
    elif [ "$NODE_RUNNING" = "no" ] || [ "$APP_RUNNING" = "no" ] || [ "$CDP_ENABLED" = "no" ]; then
        echo -e "\033[0;31mError\033[0m" # Red
    else
        echo -e "\033[0;32mEnabled\033[0m" # Green
    fi
}

echo "🔍 Antigravity Auto-Click Status:"
echo "------------------------------------------------"
echo -e "Auto Retry:  $(get_status "$AUTO_RETRY")"
echo -e "Auto Accept: $(get_status "$AUTO_ACCEPT")"
echo "------------------------------------------------"

# Error details
ERRORS=""
if [ "$AUTO_RETRY" = "true" ] || [ "$AUTO_ACCEPT" = "true" ]; then
    if [ "$NODE_RUNNING" = "no" ]; then
        ERRORS="${ERRORS}❌ node chưa chạy -> Cần restart lại Extension chẳng hạn\n"
    fi
    
    if [ "$APP_RUNNING" = "no" ]; then
        ERRORS="${ERRORS}❌ Antigravity chưa mở -> Vui lòng mở Antigravity\n"
    elif [ "$CDP_ENABLED" = "no" ]; then
        ERRORS="${ERRORS}❌ Antigravity chưa bật CDP -> Cần chạy lại Antigravity (Debug Mode)\n"
    fi
fi

if [ -n "$ERRORS" ]; then
    echo -e "$ERRORS"
    echo "------------------------------------------------"
fi

# Show 3 latest logs for context (optional, but keep it brief)
if [ -f "$HOME/Library/Logs/AntigravityAutoRetry/stdout.log" ]; then
    echo "Dòng log cuối:"
    tail -n 3 "$HOME/Library/Logs/AntigravityAutoRetry/stdout.log" | sed 's/^/  /'
    echo "------------------------------------------------"
fi
