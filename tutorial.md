# 🤖 Antigravity Auto-Click: Hướng Dẫn Toàn Tập

Chào mừng bạn đến với bộ công cụ tự động hóa mạnh mẽ dành cho **Antigravity IDE**. Công cụ này giúp bạn loại bỏ sự phiền toái từ các thông báo "High Traffic" và các yêu cầu xác nhận lặp đi lặp lại.

---

## 🛠️ Bước 1: Thiết lập Bắt buộc (Chỉ làm 1 lần)

Để công cụ có thể giao tiếp với Antigravity, bạn **bắt buộc** phải mở IDE ở chế độ Debug (cổng 9222).

### ⌨️ Thiết lập Alias (Khuyên dùng)
Dán lệnh này vào Terminal để tạo phím tắt `antigravity`:
```bash
echo 'alias antigravity="open -a Antigravity --args --remote-debugging-port=9222"' >> ~/.zshrc && source ~/.zshrc
```

> [!IMPORTANT]
> Từ bây giờ, hãy luôn khởi động IDE bằng cách gõ `antigravity` trong Terminal hoặc sử dụng tính năng **Bật CDP (Debug)** trong Extension.

---

## 💻 Giao diện 1: Dòng lệnh (CLI Interactive Menu)

Phù hợp cho việc quản trị hệ thống, cài đặt chạy ngầm và kiểm tra log chi tiết.

### 🎮 Cách truy cập
```bash
cd /đường/dẫn/đến/antigravity-auto-click
./scripts/menu.sh
```

### 📋 Giải thích Menu Quản lý
Giao diện Menu sẽ trông như thế này:
```text
======================================================
         🤖 ANTIGRAVITY AUTO-CLICK MENU 🤖          
======================================================
   Trạng thái: [✅ HỆ THỐNG ĐANG HOẠT ĐỘNG]
======================================================
 1) 📊 Xem Trạng thái & Logs chi tiết
 2) 🔄 Test Auto-Retry (Giả lập High Traffic)
 3) ✅ Test Auto-Accept (Giả lập Agent Prompt)
 4) 🚀 Start All Features (Bắt đầu chạy)
 5) 🛑 Stop All Features  (Dừng hoàn toàn)
 6) 📥 Cài đặt chạy tự động khi khởi động PC
 7) 🗑️ Gỡ bỏ cài đặt chạy tự động
 8) 🔄 Bật CDP (Antigravity sẽ tự tắt để bạn mở lại)
 0) 🚪 Thoát
======================================================
```

| Mục | Chức năng | Chi tiết |
|:---:|:---|:---|
| **1** | **Status & Logs** | Kiểm tra daemon có đang chạy không, kết nối CDP có ổn định không và xem log thời gian thực. |
| **2** | **Test Retry** | Hiện một hộp thoại "High Traffic" giả để xem công cụ có tự click "Retry" không. |
| **3** | **Test Accept** | Hiện một yêu cầu "Run Command" giả để xem công cụ có tự click "Accept/Execute" không. |
| **4** | **Start All** | Kích hoạt cả Auto-Retry và Auto-Accept ngay lập tức (chế độ thủ công). |
| **5** | **Stop All** | Dừng toàn bộ tiến trình chạy ngầm, giải phóng tài nguyên. |
| **6** | **Auto-Start** | Cài đặt để công cụ tự động chạy mỗi khi bạn mở máy tính. |
| **7** | **Uninstall** | Gỡ bỏ tính năng tự động chạy cùng máy tính. |
| **8** | **Bật CDP** | Auto-Click yêu cầu phải bật chế độ CDP (Chromium Debugging Protocol) trong Antigravity IDE. Antigravity sẽ tự đóng. Sau đó bạn chỉ cần mở Terminal, **Paste (Dán) và Enter** |

---

## 🧩 Giao diện 2: Extension IDE (GUI)

Phù hợp cho việc bật/tắt nhanh các tính năng trong lúc đang code mà không cần rời IDE.

### 📥 Cài đặt
1. Mở Terminal tại thư mục dự án và chạy:
   ```bash
   ln -s $(pwd) ~/.antigravity/extensions/auto-retry
   ```
2. Khởi động lại Antigravity.

### 🛰️ Chỉ số tại Status Bar (Góc dưới phải)
Bạn sẽ thấy biểu tượng ⚡ kèm theo các ký tự trạng thái:
- `(R)` : **Auto-Retry** đang Bật.
- `(A)` : **Auto-Accept** đang Bật.
- `(R/A)` : Cả hai đều đang Bật.
- `(OFF)` : Hệ thống đang tạm dừng.

### ⚡ Thao tác nhanh (Quick Actions)
Click vào biểu tượng Status Bar để mở menu:
- **Toggle Auto-Retry**: Bật/Tắt tính năng tự click thử lại.
- **Toggle Auto-Accept**: Bật/Tắt tính năng tự chấp nhận lệnh.
- **Bật CDP (Debug Mode)**: Antigravity sẽ tự tắt. Bạn chỉ cần mở Terminal, **Paste (Dán) và Enter** để khởi động lại ở chế độ hỗ trợ Auto-Click.
- **Open Settings**: Mở file cấu hình để chỉnh sửa danh sách đen (Blacklist).

---

## ⚙️ Cấu hình Nâng cao (`config.json`)

Bạn có thể tùy chỉnh hành vi của công cụ trong file `config.json` ở thư mục gốc:

```json
{
  "autoRetry": true,
  "autoAccept": true,
  "blacklist": ["rm -rf", "sudo", "docker rm"],
  "clickDelay": 500
}
```

- **Blacklist**: Danh sách các lệnh **không bao giờ** được tự động click "Accept". Công cụ sẽ bỏ qua nếu phát hiện nội dung lệnh chứa các từ khóa này.
- **clickDelay**: Khoảng thời gian chờ (ms) trước khi thực hiện cú click để đảm bảo an toàn.

---

## ❓ Xử lý sự cố (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách xử lý |
|:---|:---|:---|
| **Status báo "Lỗi/Chưa sẵn sàng"** | IDE chưa bật chế độ hỗ trợ (CDP). | Dùng Option 8 trong Menu hoặc Extension, sau đó Paste -> Enter vào Terminal. |
| **Không tự click "Accept"** | Lệnh nằm trong Blacklist. | Kiểm tra mục `blacklist` trong `config.json`. |
| **Extension không hiện** | Link extension bị sai. | Chạy lại lệnh `ln -s` với đường dẫn tuyệt đối. |
| **Công cụ không tự chạy** | Chưa cài đặt tự động. | Sử dụng Option 6 trong Menu CLI. |

---
*Chúc bạn có trải nghiệm lập trình mượt mà cùng Antigravity!*
