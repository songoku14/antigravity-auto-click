#!/bin/bash
# menu.sh - Interactive CLI Menu for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.antigravity.autoretry"
ACTIVITY_FILE="$PROJECT_ROOT/logs/activity-log.json"

# Auto-restart on launch to ensure system is ready
echo "🚀 Đang tự động kiểm tra và khởi chạy hệ thống..."
bash "$SCRIPT_DIR/core/restart.sh"

pad_text() {
    local text="$1"
    local width="$2"
    local align="${3:-left}"
    
    # Tính độ dài hiển thị (loại bỏ mã màu ANSI)
    local visible_text=$(echo -e "$text" | sed 's/\x1B\[[0-9;]*[mK]//g')
    local len=${#visible_text}

    if [ "$len" -gt "$width" ]; then
        # Nếu không có mã màu, có thể cắt bớt an toàn
        if [ "$len" -eq ${#text} ]; then
            if [ "$width" -le 3 ]; then
                printf '%s' "${text:0:width}"
            else
                printf '%s...' "${text:0:$((width - 3))}"
            fi
        else
            # Nếu có mã màu, trả về nguyên bản để tránh hỏng mã ANSI
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

print_table_border() {
    printf '   ┌──────┬──────────────────────────────────────────┐\n'
}

print_table_row() {
    local label="$1"
    local value="$2"
    local align="${3:-center}"
    printf '   │ %s │ %s │\n' "$(pad_text "$label" 4 "$align")" "$(pad_text "$value" 40)"
}

print_table_separator() {
    printf '   ├──────┼──────────────────────────────────────────┤\n'
}

print_table_bottom() {
    printf '   └──────┴──────────────────────────────────────────┘\n'
}

print_two_column_table() {
    local title="$1"
    shift
    echo "$title:"
    print_table_border
    while [ "$#" -gt 0 ]; do
        if [ "$1" = "---" ]; then
            print_table_separator
            shift
        else
            print_table_row "$1" "$2"
            shift 2
        fi
    done
    print_table_bottom
}

print_settings_row() {
    local id="$1"
    local label="$2"
    local status="$3"
    printf '   │ %s │ %s │ %s │\n' "$(pad_text "$id" 4 "center")" "$(pad_text "$label" 26 "left")" "$(pad_text "$status" 12 "left")"
}

print_settings_table() {
    local title="$1"
    shift
    echo "$title:"
    printf '   ┌──────┬────────────────────────────┬──────────────┐\n'
    printf '   │  ID  │ %s │ %s │\n' "$(pad_text "Tên tính năng" 26 "center")" "$(pad_text "Trạng thái" 12 "center")"
    printf '   ├──────┼────────────────────────────┼──────────────┤\n'
    while [ "$#" -gt 0 ]; do
        if [ "$1" = "---" ]; then
            printf '   ├──────┼────────────────────────────┼──────────────┤\n'
            shift
        else
            print_settings_row "$1" "$2" "$3"
            shift 3
        fi
    done
    printf '   └──────┴────────────────────────────┴──────────────┘\n'
}

print_status_row() {
    local label="$1"
    local value="$2"
    printf '   │ %s │ %s │\n' "$(pad_text "$label" 14 "left")" "$(pad_text "$value" 30)"
}

print_status_table() {
    local title="$1"
    shift
    echo "$title:"
    printf '   ┌────────────────┬────────────────────────────────┐\n'
    while [ "$#" -gt 0 ]; do
        print_status_row "$1" "$2"
        shift 2
    done
    printf '   └────────────────┴────────────────────────────────┘\n'
}

show_menu() {
    clear
    echo "======================================================"
    echo "            🤖 ANTIGRAVITY AUTO-CLICK MENU            "
    echo "======================================================"
    
    # Check current state for header
    AUTO_RETRY=$(jq -r 'if (.autoRetry | type) == "object" then (if .autoRetry.enabled == null then true else .autoRetry.enabled end) else (if .autoRetry == null then true else .autoRetry end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    AUTO_ACCEPT_ENABLED=$(jq -r 'if (.autoAccept | type) == "object" then (if .autoAccept.enabled == null then true else .autoAccept.enabled end) else (if .autoAccept == null then true else .autoAccept end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    NODE_RUNNING=$(pgrep -f "node.*src/core/auto-retry.js" > /dev/null && echo "yes" || echo "no")
    APP_RUNNING=$(ps aux | grep "Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null && echo "yes" || echo "no")
    CDP_ENABLED=$(ps aux | grep -i "Antigravity.app/Contents/MacOS/Electron" | grep -v grep | grep -q "\\-\\-remote-debugging-port=" && echo "yes" || echo "no")

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

    # Feature Status
    RETRY_STATUS_TEXT="---"
    RETRY_STATUS_COLOR="37"
    ACCEPT_STATUS_TEXT="---"
    ACCEPT_STATUS_COLOR="37"
    if [ "$NODE_RUNNING" = "yes" ]; then
        if [ "$AUTO_RETRY" = "true" ]; then
            RETRY_STATUS_TEXT="ACTIVE"
            RETRY_STATUS_COLOR="32"
        else
            RETRY_STATUS_TEXT="OFF"
            RETRY_STATUS_COLOR="31"
        fi
        
        if [ "$AUTO_ACCEPT_ENABLED" = "true" ]; then
            # Get active categories
            CATS=$(jq -r 'if .autoAccept | type == "object" then 
                [.autoAccept.categories | to_entries[] | select(.value.enabled != false) | .key | {terminal: "t", review: "r", system: "s"}[.]] | join("")
                else "" end' "$PROJECT_ROOT/config.json" 2>/dev/null)
            if [ -n "$CATS" ]; then
                ACCEPT_STATUS_TEXT="ACTIVE [$CATS]"
                ACCEPT_STATUS_COLOR="32"
            else
                ACCEPT_STATUS_TEXT="ACTIVE"
                ACCEPT_STATUS_COLOR="32"
            fi
        else
            ACCEPT_STATUS_TEXT="OFF"
            ACCEPT_STATUS_COLOR="31"
        fi
    fi

    # Activity Counts
    RETRY_COUNT=0
    ACCEPT_COUNT=0
    if [ -f "$ACTIVITY_FILE" ]; then
        RETRY_COUNT=$(jq -r '.retry.clicked' "$ACTIVITY_FILE" 2>/dev/null || echo "0")
        ACCEPT_COUNT=$(jq -r '.accept.clicked' "$ACTIVITY_FILE" 2>/dev/null || echo "0")
    fi

    if [ "$CDP_ENABLED" = "yes" ]; then
        CDP_STATUS_TEXT="ACTIVE"
        CDP_STATUS_COLOR="32"
    else
        CDP_STATUS_TEXT="OFF"
        CDP_STATUS_COLOR="31"
    fi

    print_status_table "   🔎 Trạng thái hệ thống" \
        "Tổng quan" "$(status_cell "$STATUS_HEADER_TEXT" "$STATUS_HEADER_COLOR" 30)" \
        "Node Daemon" "$(status_cell "$([ "$NODE_RUNNING" = "yes" ] && echo ON || echo OFF)" "$( [ "$NODE_RUNNING" = "yes" ] && echo 32 || echo 31 )" 30)" \
        "Antigravity App" "$(status_cell "$([ "$APP_RUNNING" = "yes" ] && echo ON || echo OFF)" "$( [ "$APP_RUNNING" = "yes" ] && echo 32 || echo 31 )" 30)" \
        "CDP" "$(status_cell "$CDP_STATUS_TEXT" "$CDP_STATUS_COLOR" 30)" \
        "Auto Retry" "$(status_cell "$RETRY_STATUS_TEXT ($RETRY_COUNT)" "$RETRY_STATUS_COLOR" 30)" \
        "Auto Accept" "$(status_cell "$ACCEPT_STATUS_TEXT ($ACCEPT_COUNT)" "$ACCEPT_STATUS_COLOR" 30)"
    
    if [ "$NODE_RUNNING" = "yes" ] && [ "$CDP_ENABLED" = "no" ]; then
        echo "   Ghi chú: CDP chưa bật"
    fi
    echo "======================================================"
    print_two_column_table "   🚀 Vận hành hệ thống" \
        "1)" "Cài đặt tham số hệ thống" \
        "2)" "Công cụ phát triển (Dev Tools)" \
        "---" \
        "3)" "Khởi chạy / Restart hệ thống" \
        "4)" "Dừng tất cả tính năng" \
        "---" \
        "5)" "Bật CDP (Cần Restart Antigravity)" \
        "---" \
        "0)" "Thoát chương trình"
    echo "   CDP (Chrome DevTools Protocol) :"
    echo "   - Auto Click cần Antigravity chạy ở chế độ Debug để chạy CDP"
    echo "   - Antigravity sẽ tự động Tắt."
    echo "   - Bật Terminal và Cmd + V và enter để chạy lại Antigravity"
    echo "======================================================"
    echo ""
}


run_regression_suite() {
    echo "🧪 Đang chuẩn bị Test DOM Samples..."
    SAMPLES_DIR="$PROJECT_ROOT/samples"
    if [ ! -d "$SAMPLES_DIR" ]; then
        echo "❌ Thư mục samples/ không tồn tại."
        sleep 1
        return
    fi

    read -p "🔍 Nhập từ khóa tìm kiếm (bỏ trống để xem tất cả): " search_term
    
    # Tìm kiếm file khớp từ khóa (chấp nhận cả full_dom_ và sample_)
    FILES=()
    while IFS= read -r -d $'\0' file; do
        FILES+=("$(basename "$file")")
    done < <(find "$SAMPLES_DIR" -maxdepth 1 -iname "*${search_term}*.html" \( -name "full_dom_*" -o -name "sample_*" \) -print0 2>/dev/null)

    # Fallback nếu không thấy mẫu nào
    if [ ${#FILES[@]} -eq 0 ]; then
        echo "⚠️ Không tìm thấy mẫu khớp với: '$search_term'"
        read -p "Nhấn Enter để tiếp tục..."
        return
    fi

    while true; do
        clear
        echo "======================================================"
        echo "         🧪 TEST DOM SAMPLES - KẾT QUẢ TÌM KIẾM        "
        echo "======================================================"
        echo " Từ khóa: '$search_term' (Tìm thấy: ${#FILES[@]} mẫu)"
        
        printf '   ┌────┬──────────────────────────────────────────┐\n'
        printf '   │ %s │ %s │\n' "$(pad_text "ID" 2)" "$(pad_text "Tên mẫu (Sample Name)" 40)"
        printf '   ├────┼──────────────────────────────────────────┤\n'
        printf '   │ %s │ %s │\n' "$(pad_text "a)" 2)" "$(pad_text "🏃 Chạy TẤT CẢ các mẫu này" 40)"
        printf '   │ %s │ %s │\n' "$(pad_text "0)" 2)" "$(pad_text "🔙 Quay lại Menu chính" 40)"
        printf '   ├────┼──────────────────────────────────────────┤\n'
        for i in "${!FILES[@]}"; do
            printf '   │ %s │ %s │\n' "$(pad_text "$((i+1)))" 2)" "$(pad_text "${FILES[$i]}" 40)"
        done
        printf '   └────┴──────────────────────────────────────────┘\n'
        echo ""
        read -p "Lựa chọn của bạn: " sample_choice

        if [[ "$sample_choice" == "0" ]]; then
            break
        elif [[ "$sample_choice" == "a" ]]; then
            echo "🧪 Đang chạy Test DOM Samples cho toàn bộ danh sách..."
            for f in "${FILES[@]}"; do
                node "$SCRIPT_DIR/tests/regression.js" "$f"
            done
            read -p "Nhấn Enter để quay lại danh sách..."
        elif [[ "$sample_choice" =~ ^[0-9]+$ ]] && [ "$sample_choice" -gt 0 ] && [ "$sample_choice" -le ${#FILES[@]} ]; then
            SELECTED_FILE=${FILES[$((sample_choice-1))]}
            echo "🧪 Đang chạy Test cho mẫu: $SELECTED_FILE"
            node "$SCRIPT_DIR/tests/regression.js" "$SELECTED_FILE"
            read -p "Nhấn Enter để quay lại danh sách..."
        else
            echo "❌ Lựa chọn không hợp lệ."
            sleep 1
        fi
    done
}


show_dev_menu() {
    while true; do
        clear
        bash "$SCRIPT_DIR/core/status.sh"
        echo ""
        echo "======================================================"
        echo "          🛠️ ANTIGRAVITY DEVELOPER TOOLS             "
        echo "======================================================"
        print_two_column_table "   ⚙️ Công cụ phát triển" \
            "1)" "Phân tích DOM live" \
            "2)" "Chụp IDE snapshot" \
            "---" \
            "3)" "Test DOM samples (Regression)" \
            "4)" "Xem log daemon (tail)" \
            "---" \
            "5)" "Xem thống kê chi tiết" \
            "6)" "Reset bộ đếm" \
            "7)" "Load lại dữ liệu" \
            "---" \
            "0)" "Quay lại Menu chính"
        echo "======================================================"
        echo ""
        read -p "Lựa chọn của bạn: " dev_choice
        echo ""
        
        case $dev_choice in
            1)
                echo "🔍 Đang phân tích trạng thái Antigravity..."
                node "$SCRIPT_DIR/tools/analyze-live.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            2)
                echo "📦 Đang thực hiện dump toàn bộ DOM..."
                node "$SCRIPT_DIR/tools/dump-dom.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            3)
                run_regression_suite
                ;;
            4)
                LOG_FILE="$PROJECT_ROOT/logs/daemon.log"
                if [ -f "$LOG_FILE" ]; then
                    echo "Đang theo dõi log (Nhấn Ctrl+C để thoát)..."
                    tail -f "$LOG_FILE"
                else
                    echo "Chưa có file log nào."
                    sleep 1
                fi
                ;;
            5)
                echo "📊 Đang hiển thị thống kê..."
                bash "$SCRIPT_DIR/core/status.sh" --activity
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            6)
                bash "$SCRIPT_DIR/core/status.sh" --reset
                sleep 0.5
                ;;
            7)
                echo "🔄 Đang load lại dữ liệu..."
                sleep 0.5
                ;;
            0)
                return
                ;;
            *)
                echo "❌ Lựa chọn không hợp lệ."
                sleep 1
                ;;
        esac
    done
}

while true; do
    show_menu
    read -p "Lựa chọn của bạn: " choice
    echo ""
    
    case $choice in
        1)
            while true; do
                clear
                # Get current settings for display
                CUR_RETRY=$(jq -r 'if (.autoRetry | type) == "object" then (if .autoRetry.enabled == null then true else .autoRetry.enabled end) else (if .autoRetry == null then true else .autoRetry end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
                CUR_ACCEPT=$(jq -r 'if (.autoAccept | type) == "object" then (if .autoAccept.enabled == null then true else .autoAccept.enabled end) else (if .autoAccept == null then true else .autoAccept end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
                CUR_CLICK_ACCEPT=$(jq -r 'if (.autoAccept | type) == "object" then (if .autoAccept.performClick == null then false else .autoAccept.performClick end) else (if .performClickAutoAccept == null then false else .performClickAutoAccept end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "false")
                CUR_DEBUG=$(jq -r 'if .debug == null then true else .debug end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
                
                [ "$CUR_RETRY" = "true" ] && RETRY_VAL="ACTIVE" || RETRY_VAL="OFF"
                [ "$CUR_RETRY" = "true" ] && RETRY_CLR="32" || RETRY_CLR="31"
                
                [ "$CUR_ACCEPT" = "true" ] && ACCEPT_VAL="ACTIVE" || ACCEPT_VAL="OFF"
                [ "$CUR_ACCEPT" = "true" ] && ACCEPT_CLR="32" || ACCEPT_CLR="31"
                
                [ "$CUR_CLICK_ACCEPT" = "true" ] && CLICK_VAL="ACTIVE" || CLICK_VAL="OFF"
                [ "$CUR_CLICK_ACCEPT" = "true" ] && CLICK_CLR="32" || CLICK_CLR="31"
                
                [ "$CUR_DEBUG" = "true" ] && DEBUG_VAL="ACTIVE" || DEBUG_VAL="OFF"
                [ "$CUR_DEBUG" = "true" ] && DEBUG_CLR="32" || DEBUG_CLR="31"

                # Check Startup state
                STARTUP_VAL="OFF"
                STARTUP_CLR="31"
                if [ -f "$HOME/Library/LaunchAgents/$PLIST_NAME.plist" ]; then
                    STARTUP_VAL="ACTIVE"
                    STARTUP_CLR="32"
                    IS_STARTUP="yes"
                else
                    IS_STARTUP="no"
                fi

                echo "======================================================"
                echo "                  ⚙️ CÀI ĐẶT HỆ THỐNG                "
                echo "======================================================"
                
                # Chuẩn bị label trạng thái có màu
                RETRY_STATUS="$(status_cell "$( [ "$CUR_RETRY" = "true" ] && echo ACTIVE || echo OFF )" "$RETRY_CLR" 12)"
                ACCEPT_STATUS="$(status_cell "$( [ "$CUR_ACCEPT" = "true" ] && echo ACTIVE || echo OFF )" "$ACCEPT_CLR" 12)"
                CLICK_STATUS="$(status_cell "$( [ "$CUR_CLICK_ACCEPT" = "true" ] && echo ACTIVE || echo OFF )" "$CLICK_CLR" 12)"
                DEBUG_STATUS="$(status_cell "$( [ "$CUR_DEBUG" = "true" ] && echo ACTIVE || echo OFF )" "$DEBUG_CLR" 12)"
                STARTUP_STATUS="$(status_cell "$STARTUP_VAL" "$STARTUP_CLR" 12)"

                print_settings_table "   ⚙️ Cấu hình hệ thống" \
                    "1)" "Toggle Auto Retry" "$RETRY_STATUS" \
                    "---" \
                    "2)" "Toggle Auto Accept" "$ACCEPT_STATUS" \
                    "3)" "Toggle Perform Click" "$CLICK_STATUS" \
                    "---" \
                    "4)" "Toggle Debug mode của Auto Click" "$DEBUG_STATUS" \
                    "5)" "Toggle Startup with OS" "$STARTUP_STATUS" \
                    "---" \
                    "0)" "Quay lại Menu chính" ""
                
                echo "   Ghi chú tính năng:"
                echo "   - Auto Retry    : Tự động nhấn Thử lại khi gặp lỗi Busy/Traffic."
                echo "   - Auto Accept   : Tự động chấp nhận Terminal/Review/System."
                echo "   - Perform Click : Thực hiện Click (nếu OFF sẽ chỉ log kết quả)."
                echo "   - Debug mode    : Ghi log chi tiết vào logs/daemon.log để debug."
                echo "   - Startup with OS : Tự động chạy khi khởi động máy tính."
                echo "======================================================"
                echo ""
                read -p "Lựa chọn của bạn: " sub_choice
                
                case $sub_choice in
                    1)
                        if [ "$CUR_RETRY" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq 'if (.autoRetry | type) == "object" then .autoRetry.enabled = '"$NEW_VAL"' else .autoRetry = '"$NEW_VAL"' end' "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Auto Retry sang: $NEW_VAL"
                        sleep 1
                        ;;
                    2)
                        if [ "$CUR_ACCEPT" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq 'if (.autoAccept | type) == "object" then .autoAccept.enabled = '"$NEW_VAL"' else .autoAccept = '"$NEW_VAL"' end' "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Auto Accept sang: $NEW_VAL"
                        sleep 1
                        ;;
                    3)
                        if [ "$CUR_CLICK_ACCEPT" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq 'if (.autoAccept | type) == "object" then .autoAccept.performClick = '"$NEW_VAL"' else .performClickAutoAccept = '"$NEW_VAL"' end' "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Auto Accept Click sang: $NEW_VAL"
                        sleep 1
                        ;;
                    4)
                        if [ "$CUR_DEBUG" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq ".debug = $NEW_VAL" "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Debug mode của Auto Click sang: $NEW_VAL"
                        sleep 1
                        ;;
                    5)
                        if [ "$IS_STARTUP" = "yes" ]; then
                            bash "$SCRIPT_DIR/uninstall.sh"
                        else
                            bash "$SCRIPT_DIR/install.sh"
                        fi
                        read -p "Nhấn Enter để tiếp tục..."
                        ;;
                    0)
                        break
                        ;;
                    *)
                        echo "❌ Lựa chọn không hợp lệ."
                        sleep 1
                        ;;
                esac
            done
            ;;
        2)
            show_dev_menu
            ;;
        3)
            bash "$SCRIPT_DIR/core/restart.sh"
            sleep 1
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        4)
            echo "🛑 Đang dừng hệ thống..."
            bash "$SCRIPT_DIR/core/stop.sh"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        5)
            echo "======================================================"
            echo -e "🐛 \033[33mBẬT CHẾ ĐỘ CDP (CHROME DEVTOOLS PROTOCOL)\033[0m"
            echo "======================================================"
            echo "Auto-Click cần Antigravity chạy với chế độ Debug để có"
            echo "thể hoạt động thông qua CDP (Chrome DevTools Protocol)"
            echo ""
            echo " - Antigravity sẽ tự tắt."
            echo " - Bạn hãy mở Terminal và Cmd+V, sau đó Enter để mở lại Antigravity."
            echo "======================================================"
            read -p "-> Ấn Enter để xác nhận " confirm
            
            # 1. Prepare and copy launch command
            LAUNCH_CMD='open -a "/Applications/Antigravity.app" --args --remote-debugging-port=31905'
            printf "%s" "$LAUNCH_CMD" | pbcopy
            
            echo ""
            echo -e "\033[32m✅ Đã copy lệnh khởi động vào Clipboard.\033[0m"
            echo ""
            
            # 2. Close Antigravity
            echo "🔄 Đang yêu cầu Antigravity đóng..."
            osascript -e 'quit app "Antigravity"' 2>/dev/null || true
            
            echo "⏳ Đợi ứng dụng phản hồi (3s)..."
            sleep 3
            
            # Check if still running
            if ps aux | grep -i "/Applications/Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null; then
                echo "⚠️ Antigravity vẫn chưa đóng, đang thực hiện đóng cưỡng bức..."
                pkill -9 -f "Antigravity" 2>/dev/null || true
                sleep 1
            fi
            
            echo -e "\033[32m✅ Hệ thống đã sẵn sàng cho bước tiếp theo.\033[0m"
            echo "👉 Vui lòng Cmd+V vào Terminal ngay bây giờ."
            echo ""
            read -p "Nhấn Enter để quay lại menu chính..."
            ;;
        0)
            echo "👋 Tạm biệt!"
            exit 0
            ;;
        *)
            echo "❌ Lựa chọn không hợp lệ."
            sleep 1
            ;;
    esac
done
