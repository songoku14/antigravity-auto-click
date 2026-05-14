# Antigravity Auto-Click (Retry & Accept)

Bộ công cụ tự động hóa thao tác click cho Antigravity IDE: Tự động thử lại khi lỗi và Tự động chấp nhận đề xuất từ Agent.

## 1. Bài Toán & Giải Pháp

| Đặc điểm | Chi tiết |
| :--- | :--- |
| **Vấn đề** | Lỗi "High Traffic" yêu cầu click thủ công hoặc các đề xuất Agent cần Accept liên tục. |
| **Công nghệ** | Chrome DevTools Protocol (CDP). Daemon tự dò `--remote-debugging-port` từ tiến trình Antigravity đang chạy. |
| **Giao diện chính** | **Extension (Control Center)**: Tích hợp trực tiếp vào IDE, điều khiển bằng GUI hiện đại, hỗ trợ cài đặt chi tiết và chẩn đoán hệ thống. |
| **Giao diện phụ** | **CLI Menu**: Dùng cho quản trị, cài đặt daemon, developer tools và chạy regression tests. |
| **Tính năng** | **Auto-Retry**: Click "Retry" khi gặp lỗi High Traffic.<br>**Auto-Accept**: Nhận diện nút "Run", "Accept", "Proceed"... theo category: `terminal`, `reviewChange`, `systemReview`. |
| **Bảo vệ** | **Blacklist** chặn các lệnh Terminal nguy hiểm; **Visibility checks** & **Rate-limit** đảm bảo an toàn. |
| **Ưu điểm** | Chính xác cao, linh hoạt, an toàn, hỗ trợ Shadow DOM traversal và đa dạng môi trường (IDE + CLI). |

## 2. Giao diện Vận hành (Control Center)

Extension Antigravity Auto-Click hiện là **bề mặt vận hành chính**, cho phép bạn:
- **Status Bar**: Theo dõi nhanh trạng thái daemon (ON/OFF) và các tính năng đang bật (`R` cho Retry, `A:t,r,s` cho Accept categories).
- **Control Center (QuickPick)**: 
    - Bật/tắt nhanh toàn bộ hệ thống hoặc từng tính năng.
    - Xem thống kê hoạt động (Activity Summary) và lý do Skip gần nhất.
    - Truy cập **System Diagnostics** để kiểm tra sức khỏe hệ thống (CDP port, Config validity, Logs).
- **Settings UI**: Cấu hình chi tiết Auto Retry (Timing, Patterns) và Auto Accept (Categories, Blacklist) thông qua các menu tương tác, có validation dữ liệu.

## 3. Cấu Trúc Dự Án

```text
antigravity-auto-click/
├── src/                   # Mã nguồn chính
│   ├── extension/         # Giao diện Control Center (VS Code Extension)
│   ├── core/              # Daemon kết nối CDP & Điều phối injection
│   └── payload/           # JavaScript inject vào IDE (Detection Logic)
├── scripts/               # Bộ công cụ điều khiển & Script tiện ích
│   ├── core/              # Start, Stop, Status scripts
│   ├── tests/             # Bộ kiểm thử TDD & Regression (JSDOM)
│   ├── tools/             # Dump DOM, Live Analyzer
│   └── menu.sh            # Giao diện CLI (Fallback & Dev Tools)
├── config.json            # Cấu hình (Source of Truth)
├── config.schema.json     # Schema định nghĩa cấu hình hợp lệ
└── tutorial.md            # Hướng dẫn sử dụng chi tiết
```

## 4. Hướng Dẫn Nhanh

**Bước 1: Bật chế độ Debug cho IDE**
Chạy lệnh sau để IDE luôn mở với port debug:
```bash
echo 'alias antigravity="open -a Antigravity --args --remote-debugging-port=31905"' >> ~/.zshrc && source ~/.zshrc
```

**Bước 2: Cài đặt Extension**
```bash
ln -s $(pwd) ~/.antigravity/extensions/auto-retry
```
Sau đó khởi động lại Antigravity.

**Bước 3: Sử dụng**
- Click vào biểu tượng **Antigravity** ở Status Bar (góc dưới phải) để mở **Control Center**.
- Dùng CLI (`./scripts/menu.sh`) nếu cần cài đặt LaunchAgent hoặc chạy Regression Tests.

## 5. Kiểm thử & Phát triển (TDD & Regression)

Chúng tôi áp dụng quy trình **Test-Driven Development (TDD)** cho các tính năng mới:
- **Regression Tests**: `node scripts/tests/regression.js [pattern]` - Kiểm tra logic trên hàng chục mẫu DOM thực tế (Retry, Terminal, Review...).
- **Extension Tests**: Các script trong `scripts/tests/extension-phase*.js` đảm bảo tính ổn định của giao diện điều khiển.
- **Dump DOM**: `node scripts/tools/dump-dom.js` - Chụp snapshot IDE để tạo test case mới.

---
*Xem thêm chi tiết tại [tutorial.md](tutorial.md).*
