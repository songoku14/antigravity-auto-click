#!/bin/bash
# menu.sh - Interactive CLI Menu for Antigravity Auto-Retry

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.antigravity.autoretry"

show_menu() {
    clear
    echo "======================================================"
    echo "         🤖 ANTIGRAVITY AUTO-RETRY MENU 🤖          "
    echo "======================================================"
    
    # Lấy trạng thái hiện tại
    if launchctl list | grep -q "$PLIST_NAME"; then
        PID=$(launchctl list | grep "$PLIST_NAME" | awk '{print $1}')
        if [ "$PID" != "-" ] && [ -n "$PID" ]; then
            echo -e "   Trạng thái hiện tại: \033[32m[✅ ĐANG CHẠY NGẦM]\033[0m"
        else
            echo -e "   Trạng thái hiện tại: \033[33m[⚠️ LỖI PID / ĐANG KHỞI ĐỘNG]\033[0m"
        fi
    else
        NODE_PIDS=$(pgrep -f "node.*src/auto-retry.js" || true)
        if [ -n "$NODE_PIDS" ]; then
            echo -e "   Trạng thái hiện tại: \033[32m[✅ ĐANG CHẠY THỦ CÔNG]\033[0m"
        else
            echo -e "   Trạng thái hiện tại: \033[31m[❌ ĐÃ DỪNG]\033[0m"
        fi
    fi
    echo "======================================================"
    echo ""
    echo "Hãy chọn chức năng (Nhập số):"
    echo "  1) 📥 Cài đặt hệ thống chạy ngầm (Khuyên dùng)"
    echo "  2) 🗑️  Gỡ cài đặt hoàn toàn"
    echo "  3) 🚀 Khởi chạy thủ công (Xem trực tiếp trên Terminal)"
    echo "  4) 🛑 Dừng mọi tiến trình đang chạy"
    echo "  5) 📊 Xem chi tiết trạng thái hệ thống"
    echo "  6) 📄 Xem log hoạt động theo thời gian thực"
    echo "  7) 🧪 Kiểm tra hoạt động (Test Script)"
    echo "  0) 🚪 Thoát Menu"
    echo ""
}

while true; do
    show_menu
    read -p "Lựa chọn của bạn: " choice
    echo ""
    
    case $choice in
        1)
            bash "$SCRIPT_DIR/install.sh"
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        2)
            bash "$SCRIPT_DIR/uninstall.sh"
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        3)
            echo "Đang khởi chạy thủ công (Nhấn Ctrl+C để thoát chế độ này)..."
            bash "$SCRIPT_DIR/start.sh"
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        4)
            bash "$SCRIPT_DIR/stop.sh"
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        5)
            bash "$SCRIPT_DIR/status.sh"
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        6)
            LOG_FILE="$HOME/Library/Logs/AntigravityAutoRetry/stdout.log"
            if [ -f "$LOG_FILE" ]; then
                echo "Đang theo dõi log (Nhấn Ctrl+C để thoát)..."
                tail -f "$LOG_FILE"
            else
                echo "Chưa có file log nào được tạo ra."
            fi
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        7)
            echo "Đang gửi lệnh test đến Antigravity..."
            node "$SCRIPT_DIR/trigger-test.js"
            read -p "Nhấn Enter để tiếp tục..."
            ;;
        0)
            echo "👋 Tạm biệt!"
            exit 0
            ;;
        *)
            echo "❌ Lựa chọn không hợp lệ, vui lòng thử lại."
            sleep 1
            ;;
    esac
done
