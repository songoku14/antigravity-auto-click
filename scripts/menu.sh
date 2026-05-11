#!/bin/bash
# menu.sh - Interactive CLI Menu for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.antigravity.autoretry"
ACTIVITY_FILE="$PROJECT_ROOT/activity-log.json"

show_menu() {
    clear
    echo "======================================================"
    echo "         🤖 ANTIGRAVITY AUTO-CLICK MENU 🤖          "
    echo "======================================================"
    
    # Check current state for header
    AUTO_RETRY=$(jq -r '.autoRetry // true' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    AUTO_ACCEPT_ENABLED=$(jq -r 'if .autoAccept | type == "boolean" then .autoAccept else .autoAccept.enabled // true end' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    NODE_RUNNING=$(pgrep -f "node.*src/auto-retry.js" > /dev/null && echo "yes" || echo "no")
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

    echo -e "   Tổng quan:  $STATUS_HEADER"
    echo -e "   Auto Retry: $RETRY_STATUS ($RETRY_COUNT)    |    Auto Accept: $ACCEPT_STATUS ($ACCEPT_COUNT)"
    echo "======================================================"
    echo " 1) 📊 Xem Trạng thái & Logs chi tiết"
    echo " 2) 🧪 Testing Lab (Live & Regression)"
    echo " 3) 🛠️ Developer Tools (Debug & Analysis)"
    echo "------------------------------------------------------"
    echo " 4) 🚀 Start All Features (Bắt đầu chạy)"
    echo " 5) 🛑 Stop All Features  (Dừng hoàn toàn)"
    echo "------------------------------------------------------"
    echo " 6) 📥 Bật Khởi động cùng máy tính"
    echo " 7) 🗑️ Tắt Khởi động cùng máy tính"
    echo " 0) 🚪 Thoát"
    echo "======================================================"
    echo ""
}

show_test_menu() {
    while true; do
        clear
        echo "======================================================"
        echo "           🧪 ANTIGRAVITY TESTING LAB               "
        echo "======================================================"
        echo " 1) 🔄 Test Auto-Retry (Giả lập High Traffic - LIVE)"
        echo " 2) ✅ Test Auto-Accept (Giả lập Agent Prompt - LIVE)"
        echo " 3) 🧪 Chạy Regression Test (Mẫu Offline - SAMPLES)"
        echo " 0) 🔙 Quay lại Menu chính"
        echo "======================================================"
        echo ""
        read -p "Lựa chọn của bạn: " test_choice
        echo ""
        
        case $test_choice in
            1)
                echo "🧪 Đang kiểm tra Auto-Retry (LIVE)..."
                node "$SCRIPT_DIR/trigger-test.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            2)
                echo "🧪 Đang kiểm tra Auto-Accept (LIVE)..."
                node "$SCRIPT_DIR/trigger-accept-test.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            3)
                echo "🧪 Đang chuẩn bị bộ kiểm tra hồi quy (SAMPLES)..."
                SAMPLES_DIR="$PROJECT_ROOT/samples"
                if [ ! -d "$SAMPLES_DIR" ]; then
                    echo "❌ Thư mục samples/ không tồn tại."
                    sleep 1
                    continue
                fi

                read -p "🔍 Nhập từ khóa tìm kiếm (bỏ trống để xem tất cả): " search_term
                
                # Tìm kiếm file khớp từ khóa
                FILES=()
                while IFS= read -r -d $'\0' file; do
                    FILES+=("$(basename "$file")")
                done < <(find "$SAMPLES_DIR" -maxdepth 1 -iname "*${search_term}*.html" -print0 2>/dev/null)

                # Fallback nếu không thấy mẫu nào
                if [ ${#FILES[@]} -eq 0 ]; then
                    echo "⚠️ Không tìm thấy mẫu khớp với: '$search_term'"
                    echo "🔍 Tự động hiển thị 10 mẫu 'full_dom' mới nhất..."
                    # Dùng while read để an toàn với dấu cách
                    while IFS= read -r file; do
                        [ -n "$file" ] && FILES+=("$(basename "$file")")
                    done < <(ls -t "$SAMPLES_DIR"/*full_dom*.html 2>/dev/null | head -n 10)
                fi

                if [ ${#FILES[@]} -eq 0 ]; then
                    echo "ℹ️ Không tìm thấy mẫu nào khả dụng trong thư mục samples/."
                    read -p "Nhấn Enter để tiếp tục..."
                    continue
                fi

                while true; do
                    clear
                    echo "======================================================"
                    echo "         🧪 REGRESSION TEST - KẾT QUẢ TÌM KIẾM        "
                    echo "======================================================"
                    echo " Từ khóa: '$search_term' (Tìm thấy: ${#FILES[@]} mẫu)"
                    echo "------------------------------------------------------"
                    echo " a) 🏃 Chạy TẤT CẢ các mẫu trong danh sách này"
                    echo " 0) 🔙 Quay lại Menu Test Lab"
                    echo "------------------------------------------------------"
                    for i in "${!FILES[@]}"; do
                        echo " $((i+1))) ${FILES[$i]}"
                    done
                    echo "------------------------------------------------------"
                    read -p "Lựa chọn của bạn: " sample_choice

                    if [[ "$sample_choice" == "0" ]]; then
                        break
                    elif [[ "$sample_choice" == "a" ]]; then
                        echo "🧪 Đang chạy Regression Test cho toàn bộ danh sách..."
                        for f in "${FILES[@]}"; do
                            node "$SCRIPT_DIR/verify-dialog-detection-regression.js" "$f"
                        done
                        read -p "Nhấn Enter để quay lại danh sách..."
                    elif [[ "$sample_choice" =~ ^[0-9]+$ ]] && [ "$sample_choice" -gt 0 ] && [ "$sample_choice" -le ${#FILES[@]} ]; then
                        SELECTED_FILE=${FILES[$((sample_choice-1))]}
                        echo "🧪 Đang chạy Regression Test cho mẫu: $SELECTED_FILE"
                        node "$SCRIPT_DIR/verify-dialog-detection-regression.js" "$SELECTED_FILE"
                        read -p "Nhấn Enter để quay lại danh sách..."
                    else
                        echo "❌ Lựa chọn không hợp lệ."
                        sleep 1
                    fi
                done
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

show_dev_menu() {
    while true; do
        clear
        echo "======================================================"
        echo "           🛠️ ANTIGRAVITY DEVELOPER TOOLS            "
        echo "======================================================"
        echo " 1) 🔄 Khởi động lại Antigravity (Chế độ Debug)"
        echo " 2) 🔍 Phân tích Dialog hiện tại"
        echo " 3) 🎭 Giả lập Dialog từ Sample"
        echo " 4) 📦 Chụp toàn bộ IDE (Dump DOM)"
        echo " 0) 🔙 Quay lại Menu chính"
        echo "======================================================"
        echo ""
        read -p "Lựa chọn của bạn: " dev_choice
        echo ""
        
        case $dev_choice in
            1)
                # 1. Prepare and copy launch command FIRST
                LAUNCH_CMD='open -a "/Applications/Antigravity.app" --args --remote-debugging-port=31905'
                printf "%s" "$LAUNCH_CMD" | pbcopy
                
                echo -e "\033[32m✅ Đã copy lệnh khởi động vào Clipboard.\033[0m"
                echo -e "Nội dung kiểm tra (pbpaste): \033[36m$(pbpaste)\033[0m"
                echo ""

                # 2. Now close Antigravity
                echo "🔄 Đang yêu cầu Antigravity đóng nhẹ nhàng..."
                osascript -e 'quit app "Antigravity"' 2>/dev/null || true
                
                echo "⏳ Đợi ứng dụng phản hồi (3s)..."
                sleep 3
                
                # Check if still running
                if ps aux | grep -i "/Applications/Antigravity.app/Contents/MacOS/Electron" | grep -v grep > /dev/null; then
                    echo "⚠️ Antigravity vẫn đang chạy, đang thực hiện đóng cưỡng bức..."
                    pkill -9 -f "Antigravity" 2>/dev/null || true
                    sleep 1
                fi

                echo -e "\033[32m✅ Antigravity đã được đóng hoàn toàn.\033[0m"
                
                echo "======================================================"
                echo -e "\033[32m🚀 HỆ THỐNG ĐÃ SẴN SÀNG!\033[0m"
                echo "------------------------------------------------------"
                echo "👉 Lệnh đã có trong Clipboard. Vui lòng dán (Cmd+V)"
                echo "   vào Terminal để mở lại Antigravity."
                echo "======================================================"
                read -p "Nhấn Enter để quay lại menu..."
                ;;
            2)
                echo "🔍 Đang khởi chạy công cụ phân tích..."
                node "$SCRIPT_DIR/analyze-dialog.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            3)
                echo "🎭 Đang khởi chạy công cụ giả lập..."
                node "$SCRIPT_DIR/mock-dialog.js"
                read -p "Nhấn Enter để tiếp tục..."
                ;;
            4)
                echo "📦 Đang thực hiện dump toàn bộ DOM..."
                node "$SCRIPT_DIR/dump-dom.js"
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
            bash "$SCRIPT_DIR/status.sh"
            echo ""
            echo "------------------------------------------------------"
            echo " TÙY CHỌN:"
            echo " 1) 📋 Xem log thời gian thực (tail -f)"
            echo " 2) 🔄 Reset bộ đếm thống kê"
            echo " 0) 🔙 Quay lại Menu chính"
            echo "------------------------------------------------------"
            read -p "Lựa chọn của bạn: " sub_choice
            
            case $sub_choice in
                1)
                    LOG_FILE="$HOME/Library/Logs/AntigravityAutoRetry/stdout.log"
                    if [ -f "$LOG_FILE" ]; then
                        echo "Đang theo dõi log (Nhấn Ctrl+C để thoát)..."
                        tail -f "$LOG_FILE"
                    else
                        echo "Chưa có file log nào."
                        sleep 1
                    fi
                    ;;
                2)
                    bash "$SCRIPT_DIR/status.sh" --reset
                    sleep 1
                    ;;
                0)
                    # Quay lại menu chính
                    ;;
                *)
                    echo "❌ Lựa chọn không hợp lệ."
                    sleep 1
                    ;;
            esac
            ;;
        2)
            show_test_menu
            ;;
        3)
            show_dev_menu
            ;;
        4)
            bash "$SCRIPT_DIR/start.sh"
            sleep 1
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        5)
            echo "🛑 Đang dừng hệ thống..."
            bash "$SCRIPT_DIR/stop.sh"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        6)
            bash "$SCRIPT_DIR/install.sh"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        7)
            bash "$SCRIPT_DIR/uninstall.sh"
            read -p "Nhấn Enter để quay lại menu..."
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
