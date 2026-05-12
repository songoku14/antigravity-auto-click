#!/bin/bash
# menu.sh - Interactive CLI Menu for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.antigravity.autoretry"
ACTIVITY_FILE="$PROJECT_ROOT/logs/activity-log.json"

show_menu() {
    clear
    echo "======================================================"
    echo "         🤖 ANTIGRAVITY AUTO-CLICK MENU 🤖          "
    echo "======================================================"
    
    # Check current state for header
    AUTO_RETRY=$(jq -r 'if .autoRetry == null then true else .autoRetry end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    AUTO_ACCEPT_ENABLED=$(jq -r 'if .autoAccept | type == "boolean" then .autoAccept else (if .autoAccept.enabled == null then true else .autoAccept.enabled end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    NODE_RUNNING=$(pgrep -f "node.*src/core/auto-retry.js" > /dev/null && echo "yes" || echo "no")
    APP_RUNNING=$(ps aux | grep "Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null && echo "yes" || echo "no")
    CDP_ENABLED=$(ps aux | grep -i "Antigravity.app/Contents/MacOS/Electron" | grep -v grep | grep -q "\\-\\-remote-debugging-port=" && echo "yes" || echo "no")

    if [ "$NODE_RUNNING" = "no" ]; then
        STATUS_HEADER="\033[37m[⚪ HỆ THỐNG ĐANG TẮT]\033[0m"
    elif [ "$APP_RUNNING" = "yes" ] && [ "$CDP_ENABLED" = "yes" ]; then
        STATUS_HEADER="\033[32m[✅ HỆ THỐNG ĐANG HOẠT ĐỘNG]\033[0m"
    else
        STATUS_HEADER="\033[31m[❌ HỆ THỐNG CÓ LỖI / CHƯA SẴN SÀNG]\033[0m"
    fi

    # Feature Status
    RETRY_STATUS="---"
    ACCEPT_STATUS="---"
    if [ "$NODE_RUNNING" = "yes" ]; then
        [ "$AUTO_RETRY" = "true" ] && RETRY_STATUS="\033[32mACTIVE\033[0m" || RETRY_STATUS="\033[31mOFF\033[0m"
        
        if [ "$AUTO_ACCEPT_ENABLED" = "true" ]; then
            # Get active categories
            CATS=$(jq -r 'if .autoAccept | type == "object" then 
                [.autoAccept.categories | to_entries[] | select(.value.enabled != false) | .key | {terminal: "t", review: "r", system: "s"}[.]] | join("")
                else "" end' "$PROJECT_ROOT/config.json" 2>/dev/null)
            if [ -n "$CATS" ]; then
                ACCEPT_STATUS="\033[32mACTIVE\033[0m [\033[36m$CATS\033[0m]"
            else
                ACCEPT_STATUS="\033[32mACTIVE\033[0m"
            fi
        else
            ACCEPT_STATUS="\033[31mOFF\033[0m"
        fi
    fi

    # Activity Counts
    RETRY_COUNT=0
    ACCEPT_COUNT=0
    if [ -f "$ACTIVITY_FILE" ]; then
        RETRY_COUNT=$(jq -r '.retry.clicked' "$ACTIVITY_FILE" 2>/dev/null || echo "0")
        ACCEPT_COUNT=$(jq -r '.accept.clicked' "$ACTIVITY_FILE" 2>/dev/null || echo "0")
    fi

    [ "$CDP_ENABLED" = "yes" ] && CDP_STATUS_LABEL="\033[32mACTIVE\033[0m" || CDP_STATUS_LABEL="\033[31mOFF\033[0m"

    echo -e "   Tổng quan:  $STATUS_HEADER    |    CDP Debug:  $CDP_STATUS_LABEL"
    echo -e "   Auto Retry: $RETRY_STATUS ($RETRY_COUNT)    |    Auto Accept: $ACCEPT_STATUS ($ACCEPT_COUNT)"
    echo "======================================================"
    echo " 1) 📊 Xem Trạng thái & Logs chi tiết"
    echo " 2) 🧪 Test DOM samples (Regression)"
    echo " 3) 🛠️ Developer Tools (Debug & Analysis)"
    echo "------------------------------------------------------"
    echo " 4) 🚀 Start All Features (Bắt đầu chạy)"
    echo " 5) 🛑 Stop All Features  (Dừng hoàn toàn)"
    echo " 6) 🔄 Restart All Features (Khởi động lại)"
    echo "------------------------------------------------------"
    echo " 7) 📥 Bật Khởi động cùng máy tính"
    echo " 8) 🗑️ Tắt Khởi động cùng máy tính"
    echo " 9) 🐛 Bật CDP (Chrome DevTools Protocol)"
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
        echo "======================================================"
        echo "           🛠️ ANTIGRAVITY DEVELOPER TOOLS            "
        echo "======================================================"
        echo " 1) 📦 Chụp toàn bộ IDE (Dump DOM Snapshot)"
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
                bash "$SCRIPT_DIR/core/status.sh"
                
                # Get current settings for display
                CUR_RETRY=$(jq -r 'if .autoRetry == null then true else .autoRetry end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
                CUR_ACCEPT=$(jq -r 'if .autoAccept | type == "boolean" then .autoAccept else (if .autoAccept.enabled == null then true else .autoAccept.enabled end) end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
                
                [ "$CUR_RETRY" = "true" ] && RETRY_LBL="\033[32mACTIVE\033[0m" || RETRY_LBL="\033[31mOFF\033[0m"
                [ "$CUR_ACCEPT" = "true" ] && ACCEPT_LBL="\033[32mACTIVE\033[0m" || ACCEPT_LBL="\033[31mOFF\033[0m"

                echo ""
                echo "------------------------------------------------------"
                echo " TÙY CHỌN CHI TIẾT:"
                echo " 1) 📋 Xem log thời gian thực (tail -f)"
                echo " 2) 🔄 Reset bộ đếm thống kê"
                echo -e " 3) 🔄 Toggle Auto Retry   (Hiện tại: $RETRY_LBL)"
                echo -e " 4) 🔄 Toggle Auto Accept  (Hiện tại: $ACCEPT_LBL)"
                echo " 0) 🔙 Quay lại Menu chính"
                echo "------------------------------------------------------"
                read -p "Lựa chọn của bạn: " sub_choice
                
                case $sub_choice in
                    1)
                        LOG_FILE="$PROJECT_ROOT/logs/daemon.log"
                        if [ -f "$LOG_FILE" ]; then
                            echo "Đang theo dõi log (Nhấn Ctrl+C để thoát)..."
                            tail -f "$LOG_FILE"
                        else
                            echo "Chưa có file log nào."
                            sleep 1
                        fi
                        ;;
                    2)
                        bash "$SCRIPT_DIR/core/status.sh" --reset
                        sleep 1
                        ;;
                    3)
                        if [ "$CUR_RETRY" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq ".autoRetry = $NEW_VAL" "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Auto Retry sang: $NEW_VAL"
                        sleep 1
                        ;;
                    4)
                        if [ "$CUR_ACCEPT" = "true" ]; then NEW_VAL="false"; else NEW_VAL="true"; fi
                        jq "if .autoAccept | type == \"boolean\" then .autoAccept = $NEW_VAL else .autoAccept.enabled = $NEW_VAL end" "$PROJECT_ROOT/config.json" > "$PROJECT_ROOT/config.json.tmp" && mv "$PROJECT_ROOT/config.json.tmp" "$PROJECT_ROOT/config.json"
                        echo -e "✅ Đã chuyển Auto Accept sang: $NEW_VAL"
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
            run_regression_suite
            ;;
        3)
            show_dev_menu
            ;;
        4)
            bash "$SCRIPT_DIR/core/start.sh"
            sleep 1
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        5)
            echo "🛑 Đang dừng hệ thống..."
            bash "$SCRIPT_DIR/core/stop.sh"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        6)
            bash "$SCRIPT_DIR/core/restart.sh"
            sleep 1
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        7)
            bash "$SCRIPT_DIR/install.sh"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        8)
            bash "$SCRIPT_DIR/uninstall.sh"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        9)
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
