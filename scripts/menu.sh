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
    local len=${#text}
    local pad=$((width - len))

    if [ "$pad" -le 0 ]; then
        printf '%s' "$text"
        return
    fi

    if [ "$align" = "right" ]; then
        printf '%*s%s' "$pad" "" "$text"
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

show_menu() {
    clear
    echo "======================================================"
    echo "         🤖 ANTIGRAVITY AUTO-CLICK MENU 🤖          "
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

    printf '   ┌──────────────────┬────────────────────────────┐\n'
    printf '   │ %s │ %s │\n' "$(pad_text "Tong quan" 16)" "$(status_cell "$STATUS_HEADER_TEXT" "$STATUS_HEADER_COLOR" 26)"
    printf '   │ %s │ %s │\n' "$(pad_text "Auto Retry" 16)" "$(status_cell "$RETRY_STATUS_TEXT ($RETRY_COUNT)" "$RETRY_STATUS_COLOR" 26)"
    printf '   │ %s │ %s │\n' "$(pad_text "Auto Accept" 16)" "$(status_cell "$ACCEPT_STATUS_TEXT ($ACCEPT_COUNT)" "$ACCEPT_STATUS_COLOR" 26)"
    printf '   └──────────────────┴────────────────────────────┘\n'
    if [ "$NODE_RUNNING" = "yes" ] && [ "$CDP_ENABLED" = "no" ]; then
        echo "   Ghi chú: CDP chưa bật"
    fi
    echo "======================================================"
    echo " 1) ⚙️ Cài đặt"
    echo " 2) 🛠️ Developer Tools (Debug & Analysis)"
    echo "------------------------------------------------------"
    echo " 3) 🚀 Start/Restart All Features (Khởi chạy hệ thống)"
    echo " 4) 🛑 Stop All Features  (Dừng hoàn toàn)"
    echo "------------------------------------------------------"
    echo " 5) 🐛 Bật CDP (Chrome DevTools Protocol)"
    echo " 0) 🚪 Thoát"
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
        echo "------------------------------------------------------"
        echo " a) 🏃 Chạy TẤT CẢ các mẫu trong danh sách này"
        echo " 0) 🔙 Quay lại Menu chính"
        echo "------------------------------------------------------"
        for i in "${!FILES[@]}"; do
            echo " $((i+1))) ${FILES[$i]}"
        done
        echo "------------------------------------------------------"
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
        echo "           🛠️ ANTIGRAVITY DEVELOPER TOOLS            "
        echo "======================================================"
        echo " 1) 📦 Chụp toàn bộ IDE (Dump DOM Snapshot)"
        echo " 2) 📋 Xem log daemon thời gian thực (tail -f)"
        echo " 3) 🧪 Test DOM samples (Regression)"
        echo " 4) 🔍 Phân tích DOM trực tiếp (Live Analysis)"
        echo "------------------------------------------------------"
        echo " 5) 📊 Thống kê"
        echo " 6) 🔄 Load lại dữ liệu"
        echo " 7) 🗑️ Reset bộ đếm thống kê"
        echo " 0) 🔙 Quay lại Menu chính"
        echo "======================================================"
        echo ""
        read -p "Lựa chọn của bạn: " dev_choice
        echo ""
        
        case $dev_choice in
            1)
                echo "📦 Đang thực hiện dump toàn bộ DOM..."
                node "$SCRIPT_DIR/tools/dump-dom.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            2)
                LOG_FILE="$PROJECT_ROOT/logs/daemon.log"
                if [ -f "$LOG_FILE" ]; then
                    echo "Đang theo dõi log (Nhấn Ctrl+C để thoát)..."
                    tail -f "$LOG_FILE"
                else
                    echo "Chưa có file log nào."
                    sleep 1
                fi
                ;;
            3)
                run_regression_suite
                ;;
            4)
                echo "🔍 Đang phân tích trạng thái Antigravity..."
                node "$SCRIPT_DIR/tools/analyze-live.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            5)
                echo "📊 Đang hiển thị thống kê..."
                bash "$SCRIPT_DIR/core/status.sh" --activity
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            6)
                echo "🔄 Đang load lại dữ liệu..."
                sleep 0.5
                ;;
            7)
                bash "$SCRIPT_DIR/core/status.sh" --reset
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
                
                [ "$CUR_RETRY" = "true" ] && RETRY_LBL="\033[32mACTIVE\033[0m" || RETRY_LBL="\033[31mOFF\033[0m"
                [ "$CUR_ACCEPT" = "true" ] && ACCEPT_LBL="\033[32mACTIVE\033[0m" || ACCEPT_LBL="\033[31mOFF\033[0m"
                [ "$CUR_CLICK_ACCEPT" = "true" ] && CLICK_ACCEPT_LBL="\033[32mACTIVE\033[0m" || CLICK_ACCEPT_LBL="\033[31mOFF\033[0m"
                [ "$CUR_DEBUG" = "true" ] && DEBUG_LBL="\033[32mACTIVE\033[0m" || DEBUG_LBL="\033[31mOFF\033[0m"

                # Check Startup state
                STARTUP_LBL="\033[31mOFF\033[0m"
                if [ -f "$HOME/Library/LaunchAgents/$PLIST_NAME.plist" ]; then
                    STARTUP_LBL="\033[32mACTIVE\033[0m"
                    IS_STARTUP="yes"
                else
                    IS_STARTUP="no"
                fi

                echo "======================================================"
                echo "                ⚙️ CÀI ĐẶT HỆ THỐNG                   "
                echo "======================================================"
                echo -e " 1) 🔄 Toggle Auto Retry   (Hiện tại: $RETRY_LBL)"
                echo -e " 2) 🔄 Toggle Auto Accept  (Hiện tại: $ACCEPT_LBL)"
                echo -e " 3) 🔄 Toggle Khởi động cùng macOS (Hiện tại: $STARTUP_LBL)"
                echo -e " 4) 🔄 Toggle Auto Accept Perform Click (Hiện tại: $CLICK_ACCEPT_LBL)"
                echo -e " 5) 🔄 Toggle Debug Mode   (Hiện tại: $DEBUG_LBL)"
                echo " 0) 🔙 Quay lại Menu chính"
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
                        if [ "$IS_STARTUP" = "yes" ]; then
                            bash "$SCRIPT_DIR/uninstall.sh"
                        else
                            bash "$SCRIPT_DIR/install.sh"
                        fi
                        read -p "Nhấn Enter để tiếp tục..."
                        ;;
                    4)
                        if [ "$CUR_CLICK_ACCEPT" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq 'if (.autoAccept | type) == "object" then .autoAccept.performClick = '"$NEW_VAL"' else .performClickAutoAccept = '"$NEW_VAL"' end' "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Auto Accept Click sang: $NEW_VAL"
                        sleep 1
                        ;;
                    5)
                        if [ "$CUR_DEBUG" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq ".debug = $NEW_VAL" "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Debug Mode sang: $NEW_VAL"
                        sleep 1
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
