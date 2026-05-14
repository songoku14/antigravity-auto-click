# 🤖 Antigravity Auto-Click: Hướng Dẫn Toàn Tập

Chào mừng bạn đến với bộ công cụ tự động hóa mạnh mẽ dành cho **Antigravity IDE**. Công cụ này giúp bạn loại bỏ sự phiền toái từ các thông báo "High Traffic" và các yêu cầu xác nhận lặp đi lặp lại.

---

## 🛠️ Bước 1: Thiết lập Bắt buộc (Chỉ làm 1 lần)

Để công cụ có thể giao tiếp với Antigravity, bạn **bắt buộc** phải mở IDE ở chế độ Debug. Ví dụ bên dưới dùng cổng `31905`, nhưng daemon thực tế sẽ tự dò port CDP từ tiến trình Antigravity.

### ⌨️ Thiết lập Alias (Khuyên dùng)
Dán lệnh này vào Terminal để tạo phím tắt `antigravity`:
```bash
echo 'alias antigravity="open -a Antigravity --args --remote-debugging-port=31905"' >> ~/.zshrc && source ~/.zshrc
```

> [!IMPORTANT]
> Từ bây giờ, hãy luôn khởi động IDE bằng cách gõ `antigravity` trong Terminal hoặc sử dụng tính năng **Bật CDP (Debug)** trong CLI/Extension.

---

## 💻 Giao diện 1: Dòng lệnh (CLI Interactive Menu)

Phù hợp cho việc quản trị hệ thống, cài đặt chạy ngầm và kiểm tra log chi tiết.

### 🎮 Cách truy cập
```bash
cd /đường/dẫn/đến/antigravity-auto-click
./scripts/menu.sh
```

### 📋 Giải thích Menu Quản lý
Giao diện Menu thực tế sẽ trông như thế này:
```text
======================================================
         🤖 ANTIGRAVITY AUTO-CLICK MENU 🤖          
======================================================
   Tổng quan:  [✅ HỆ THỐNG ĐANG HOẠT ĐỘNG]  |  CDP Debug: ACTIVE
   Auto Retry: ACTIVE (5)  |  Auto Accept: ACTIVE [trs] (12)
======================================================
 1) ⚙️ Cài đặt
 2) 🛠️ Developer Tools (Debug & Analysis)
 3) 🚀 Start/Restart All Features (Khởi chạy hệ thống)
------------------------------------------------------
 4) 🛑 Stop All Features  (Dừng hoàn toàn)
------------------------------------------------------
 5) 🐛 Bật CDP (Chrome DevTools Protocol)
 0) 🚪 Thoát
======================================================
```

| Mục | Chức năng | Chi tiết |
|:---:|:---|:---|
| **1** | **Settings** | Bật/tắt Auto-Retry, Auto-Accept, cài tự khởi động cùng macOS và bật `autoAccept.performClick`. |
| **2** | **Dev Tools** | Xem log, Dump DOM, Chạy Regression Test (Retry/Accept/All) hoặc Phân tích Live DOM. |
| **3** | **Start/Restart** | Kích hoạt hoặc khởi động lại toàn bộ tính năng chạy ngầm. |
| **4** | **Stop All** | Dừng toàn bộ tiến trình daemon ngay lập tức. |
| **5** | **Bật CDP** | Tự động copy lệnh và hướng dẫn bạn mở IDE ở chế độ Debug. |

> [!TIP]
> Khi chạy **Regression Test** (từ menu hoặc CLI), bạn có thể dùng các pattern lọc:
> - `Retry`: Chỉ kiểm tra các ca thử lại.
> - `Run`, `Proceed`, `Accept_all`, `System`: Kiểm tra theo từng nhóm Auto-Accept.


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
Bạn sẽ thấy biểu tượng dấu tích (Check) hoặc gạch chéo (Circle-slash) kèm theo trạng thái:
- `(R)` : **Auto-Retry** đang Bật.
- `(A[tr])` : **Auto-Accept** đang Bật với các nhóm (t: terminal, r: review).
- `(A[trs])` : **Auto-Accept** đang Bật với đủ 3 nhóm `terminal`, `review`, `system`.
- `(R/A[tr])` : Cả hai đều đang Bật.
- Khi daemon dừng, status bar chỉ hiển thị trạng thái `STOPPED`.

### ⚡ Thao tác nhanh (Quick Actions)
Click vào biểu tượng Status Bar để mở menu:
- **Enable/Disable Features**: Bật/Tắt nhanh Retry hoặc từng category của Accept.
- **Restart Antigravity (Debug Mode)**: IDE sẽ tự đóng và copy lệnh vào Clipboard để bạn dán vào Terminal.
- **Edit Blacklist / Settings**: Mở trực tiếp file `config.json`.
- **Start/Stop All Features**: Điều khiển daemon trực tiếp từ IDE.

---

## ⚙️ Cấu hình Nâng cao (`config.json`)

Bạn có thể tùy chỉnh hành vi của công cụ trong file `config.json` ở thư mục gốc:

```json
{
  "autoRetry": {
    "enabled": true,
    "timing": {
      "clickDelay": 800
    }
  },
  "autoAccept": {
    "enabled": true,
    "performClick": false,
    "blacklist": ["rm ", "sudo ", "delete "],
    "categories": {
      "terminal": { "enabled": true, "context": ["run\\s*this\\s*command"] },
      "review": { "enabled": true, "context": ["agent\\s*prompt"] },
      "system": { "enabled": true, "context": ["security\\s*confirmation"] }
    }
  }
}
```

- **autoAccept.performClick**: Nếu `false`, hệ thống vẫn nhận diện và ghi thống kê Auto-Accept theo Category nhưng không click thực tế. Đây là trạng thái an toàn để kiểm tra độ chính xác của việc phân loại trước khi bật hẳn.
- **autoAccept.blacklist**: Danh sách các lệnh **không bao giờ** được tự động click "Accept". Công cụ sẽ bỏ qua nếu phát hiện nội dung lệnh chứa các từ khóa này.
- **autoRetry.timing.clickDelay**: Khoảng thời gian chờ (ms) trước khi thực hiện cú click để đảm bảo an toàn.

---

## ❓ Xử lý sự cố (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách xử lý |
|:---|:---|:---|
| **Status báo "Lỗi/Chưa sẵn sàng"** | IDE chưa bật chế độ hỗ trợ (CDP). | Dùng chức năng trong **Developer Tools** (Menu CLI) hoặc Extension. |
| **Không tự click "Accept"** | Lệnh nằm trong Blacklist. | Kiểm tra mục `autoAccept.blacklist` trong `config.json`. |
| **Extension không hiện** | Link extension bị sai. | Chạy lại lệnh `ln -s` với đường dẫn tuyệt đối. |
| **Công cụ không tự chạy khi login** | Chưa cài LaunchAgent. | Vào `CLI > Cài đặt > Toggle Khởi động cùng macOS`. |

---
*Chúc bạn có trải nghiệm lập trình mượt mà cùng Antigravity!*
