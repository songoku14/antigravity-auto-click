#!/bin/bash
# menu.sh - Interactive CLI Menu for Antigravity Auto-Click

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="com.antigravity.autoretry"

show_menu() {
    clear
    echo "======================================================"
    echo "         🤖 ANTIGRAVITY AUTO-CLICK MENU 🤖          "
    echo "======================================================"
    
    # Check current state for header
    AUTO_RETRY=$(jq -r '.autoRetry' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
    AUTO_ACCEPT=$(jq -r '.autoAccept' "$PROJECT_ROOT/config.json" 2>/dev/null || echo "true")
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
        [ "$AUTO_ACCEPT" = "true" ] && ACCEPT_STATUS="\033[32mACTIVE\033[0m" || ACCEPT_STATUS="\033[31mOFF\033[0m"
    fi

    echo -e "   Tổng quan:  $STATUS_HEADER"
    echo -e "   Auto Retry: $RETRY_STATUS    |    Auto Accept: $ACCEPT_STATUS"
    echo "======================================================"
    echo " 1) 📊 Xem Trạng thái & Logs chi tiết"
    echo "------------------------------------------------------"
    echo " 2) 🔄 Test Auto-Retry (Giả lập High Traffic)"
    echo " 3) ✅ Test Auto-Accept (Giả lập Agent Prompt)"
    echo "------------------------------------------------------"
    echo " 4) 🚀 Start All Features (Bắt đầu chạy)"
    echo " 5) 🛑 Stop All Features  (Dừng hoàn toàn)"
    echo "------------------------------------------------------"
    echo " 6) 📥 Bật Khởi động cùng máy tính"
    echo " 7) 🗑️ Tắt Khởi động cùng máy tính"
    echo " 8) 🔄 Khởi động lại Antigravity (Chế độ Debug)"
    echo " 0) 🚪 Thoát"
    echo "======================================================"
    echo ""
}

while true; do
    show_menu
    read -p "Lựa chọn của bạn: " choice
    echo ""
    
    case $choice in
        1)
            # Xem Status và sau đó hỏi có muốn xem log không
            bash "$SCRIPT_DIR/status.sh"
            echo ""
            read -p "Bạn có muốn xem log thời gian thực không? (y/n): " view_logs
            if [[ "$view_logs" == "y" || "$view_logs" == "Y" ]]; then
                LOG_FILE="$HOME/Library/Logs/AntigravityAutoRetry/stdout.log"
                if [ -f "$LOG_FILE" ]; then
                    echo "Đang theo dõi log (Nhấn Ctrl+C để thoát)..."
                    tail -f "$LOG_FILE"
                else
                    echo "Chưa có file log nào."
                fi
            fi
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        2)
            echo "🧪 Đang kiểm tra Auto-Retry..."
            node "$SCRIPT_DIR/trigger-test.js"
            read -p "Nhấn Enter để quay lại menu..."
            ;;
        3)
            echo "🧪 Đang kiểm tra Auto-Accept..."
            node "$SCRIPT_DIR/trigger-accept-test.js"
            read -p "Nhấn Enter để quay lại menu..."
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
        8)
            echo "Đang đóng Antigravity..."
            pkill -f "Antigravity.app/Contents/MacOS/Electron" || pkill -f "Antigravity" || true
            sleep 1
            echo 'open -a Antigravity --args --remote-debugging-port=9222' | pbcopy
            echo -e "\033[32m✅ Lệnh khởi động đã được copy vào Clipboard!\033[0m"
            echo "👉 Vui lòng dán lệnh vào Terminal để mở lại Antigravity ở chế độ Debug."
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
