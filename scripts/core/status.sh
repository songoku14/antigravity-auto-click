#!/bin/bash
# status.sh - Simplified status view for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CONFIG_FILE="$PROJECT_ROOT/config.json"
ACTIVITY_FILE="$PROJECT_ROOT/logs/activity-log.json"

# Check if reset is requested
SHOW_ACTIVITY_STATS="false"
for arg in "$@"; do
    case "$arg" in
        --activity|--stats)
            SHOW_ACTIVITY_STATS="true"
            ;;
    esac
done

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
    "clickedByCategory": {},
    "detectedByCategory": {}
  },
  "skipReasons": {}
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
AUTO_ACCEPT_PERFORM_CLICK=$(jq -r '
  if (.autoAccept | type) == "object" then
    (if .autoAccept.performClick == null then false else .autoAccept.performClick end)
  else
    (if .performClickAutoAccept == null then false else .performClickAutoAccept end)
  end
' "$CONFIG_FILE" 2>/dev/null || echo "false")


# Check Node process
NODE_RUNNING=$(pgrep -f "node.*src/core/auto-retry.js" > /dev/null && echo "yes" || echo "no")

# Check Antigravity App
APP_RUNNING=$(ps aux | grep "Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null && echo "yes" || echo "no")

# Check CDP Port (remote debugging)
CDP_ENABLED=$(ps aux | grep -i "Antigravity.app/Contents/MacOS/Electron" | grep -v grep | grep -q "\\-\\-remote-debugging-port=" && echo "yes" || echo "no")

# Function to format status
pad_text() {
    local text="$1"
    local width="$2"
    local align="${3:-left}"
    
    # Tính độ dài hiển thị (loại bỏ mã màu ANSI)
    local visible_text=$(echo -e "$text" | sed 's/\x1B\[[0-9;]*[mK]//g')
    local len=${#visible_text}

    if [ "$len" -gt "$width" ]; then
        if [ "$len" -eq ${#text} ]; then
            if [ "$width" -le 3 ]; then
                printf '%s' "${text:0:width}"
            else
                printf '%s...' "${text:0:$((width - 3))}"
            fi
        else
            printf '%s' "$text"
        fi
        return
    fi

    local pad=$((width - len))

    if [ "$pad" -le 0 ]; then
        printf '%s' "$text"
        return
    fi

    if [ "$align" = "right" ]; then
        printf '%*s%s' "$pad" "" "$text"
    elif [ "$align" = "center" ]; then
        local left=$((pad / 2))
        local right=$((pad - left))
        printf '%*s%s%*s' "$left" "" "$text" "$right" ""
    else
        printf '%s%*s' "$text" "$pad" ""
    fi
}

color_text() {
    local color="$1"
    shift
    printf '\033[%sm%s\033[0m' "$color" "$*"
}

status_cell() {
    local text="$1"
    local color="$2"
    local width="$3"
    local align="${4:-left}"
    color_text "$color" "$(pad_text "$text" "$width" "$align")"
}

if [ "$NODE_RUNNING" = "no" ]; then
    STATUS_HEADER_TEXT="[TẮT]"
    STATUS_HEADER_COLOR="37"
elif [ "$APP_RUNNING" = "yes" ] && [ "$CDP_ENABLED" = "yes" ]; then
    STATUS_HEADER_TEXT="[OK]"
    STATUS_HEADER_COLOR="32"
elif [ "$APP_RUNNING" = "yes" ] && [ "$CDP_ENABLED" = "no" ]; then
    STATUS_HEADER_TEXT="[CDP OFF]"
    STATUS_HEADER_COLOR="33"
else
    STATUS_HEADER_TEXT="[CÓ LỖI]"
    STATUS_HEADER_COLOR="31"
fi

table_cell() {
    local text="$1"
    local width="$2"
    local align="${3:-left}"
    pad_text "$text" "$width" "$align"
}

get_status() {
    local val=$1
    if [ "$val" = "yes" ]; then
        echo "ACTIVE"
    elif [ "$val" = "no" ]; then
        echo "OFF"
    else
        echo "ERROR"
    fi
}

SUMMARY_LABEL_WIDTH=16
SUMMARY_STATUS_WIDTH=26

RETRY_STATUS_TEXT="---"
RETRY_STATUS_COLOR="37"
ACCEPT_STATUS_TEXT="---"
ACCEPT_STATUS_COLOR="37"
RETRY_COUNT="0"
ACCEPT_COUNT="0"

if [ -f "$ACTIVITY_FILE" ]; then
    RETRY_COUNT=$(jq -r '.retry.clicked // 0' "$ACTIVITY_FILE" 2>/dev/null || echo "0")
    ACCEPT_COUNT=$(jq -r '.accept.clicked // 0' "$ACTIVITY_FILE" 2>/dev/null || echo "0")
fi

if [ "$NODE_RUNNING" = "yes" ]; then
    if [ "$AUTO_RETRY" = "true" ]; then
        RETRY_STATUS_TEXT="ACTIVE"
        RETRY_STATUS_COLOR="32"
    else
        RETRY_STATUS_TEXT="OFF"
        RETRY_STATUS_COLOR="31"
    fi

    if [ "$AUTO_ACCEPT" = "true" ]; then
        ACCEPT_CATEGORY_TAGS=$(jq -r '
          if (.autoAccept | type) == "object" then
            [(.autoAccept.categories // {}) | to_entries[] | select(.value.enabled != false) | .key | {terminal: "t", reviewChange: "r", systemReview: "s"}[.]]
            | join("")
          else
            ""
          end
        ' "$CONFIG_FILE" 2>/dev/null)
        if [ -n "$ACCEPT_CATEGORY_TAGS" ]; then
            ACCEPT_STATUS_TEXT="ACTIVE [$ACCEPT_CATEGORY_TAGS]"
        else
            ACCEPT_STATUS_TEXT="ACTIVE"
        fi
        ACCEPT_STATUS_COLOR="32"
    else
        ACCEPT_STATUS_TEXT="OFF"
        ACCEPT_STATUS_COLOR="31"
    fi
fi


# Chi tiết trạng thái hệ thống
echo "   🔎 Trạng thái hệ thống:"
printf '   ┌────────────────────┬────────────────────────────┐\n'
printf '   │ %s │ %s │\n' "$(pad_text "Tổng quan" 18)" "$(status_cell "$STATUS_HEADER_TEXT" "$STATUS_HEADER_COLOR" 26)"
printf '   ├────────────────────┼────────────────────────────┤\n'
printf '   │ %s │ %s │\n' "$(pad_text "Auto Retry" 18)" "$(status_cell "$RETRY_STATUS_TEXT ($RETRY_COUNT)" "$RETRY_STATUS_COLOR" 26)"
printf '   ├────────────────────┼────────────────────────────┤\n'
printf '   │ %s │ %s │\n' "$(pad_text "Auto Accept" 18)" "$(status_cell "$ACCEPT_STATUS_TEXT ($ACCEPT_COUNT)" "$ACCEPT_STATUS_COLOR" 26)"
printf '   │ %s │ %s │\n' "$(pad_text "Perform Click" 18)" "$(status_cell "$([ "$AUTO_ACCEPT_PERFORM_CLICK" = "true" ] && echo ACTIVE || echo OFF)" "$( [ "$AUTO_ACCEPT_PERFORM_CLICK" = "true" ] && echo 32 || echo 31 )" 26)"
printf '   ├────────────────────┼────────────────────────────┤\n'
printf '   │ %s │ %s │\n' "$(pad_text "Node Daemon" 18)" "$(status_cell "$([ "$NODE_RUNNING" = "yes" ] && echo ON || echo OFF)" "$( [ "$NODE_RUNNING" = "yes" ] && echo 32 || echo 31 )" 26)"
printf '   │ %s │ %s │\n' "$(pad_text "CDP" 18)" "$(status_cell "$([ "$CDP_ENABLED" = "yes" ] && echo ACTIVE || echo OFF)" "$( [ "$CDP_ENABLED" = "yes" ] && echo 32 || echo 31 )" 26)"
printf '   └────────────────────┴────────────────────────────┘\n'
if [ -n "$ACCEPT_CATEGORY_TAGS" ]; then
    echo "   (t: Terminal, r: Review Change, s: System Review)"
fi
echo "======================================================"

if [ "$SHOW_ACTIVITY_STATS" = "true" ]; then
    echo ""
    node "$SCRIPT_DIR/../tools/list-activity-stats.js"
fi
