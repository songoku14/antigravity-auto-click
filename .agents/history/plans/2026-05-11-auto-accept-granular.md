# Implementation Plan: Nâng cấp Auto Accept: Phân loại Context & Cấu hình Chi tiết

**Ngày lập**: 2026-05-11
**Trạng thái**: Chờ phê duyệt (Pending)

## 1. Mục tiêu
Cải tiến chức năng Auto Accept để hỗ trợ phân loại dialog (Terminal, Review, System), cho phép bật/tắt từng loại và gán bộ lọc context riêng cho từng nhóm, nâng cao độ an toàn và chính xác tương tự như Auto Retry.

## 2. Thay đổi đề xuất

### A. Cấu trúc Cấu hình (`config.json`)
Chuyển đổi `autoAccept` từ boolean sang object cấu trúc:
```json
{
  "autoAccept": {
    "enabled": true,
    "categories": {
      "terminal": { 
        "enabled": true, 
        "patterns": ["allow\\s*the\\s*following\\s*command", "run\\s*this\\s*command"] 
      },
      "review": { 
        "enabled": true, 
        "patterns": ["review\\s*the\\s*changes", "agent\\s*prompt"] 
      },
      "system": { 
        "enabled": true, 
        "patterns": ["security\\s*confirmation", "allow\\s*this\\s*action"] 
      }
    }
  }
}
```

### B. Logic Injection (`src/injection-payload.js`)
- Cập nhật `CONFIG` để chứa các patterns mặc định cho từng category.
- Hàm `scanAndAction` sẽ duyệt qua từng category được bật:
  1. Kiểm tra `containerText` hoặc `surroundingText` có khớp với `patterns` của category đó không.
  2. Nếu khớp, mới tiến hành tìm nút bấm tương ứng.
  3. Riêng `terminal` vẫn duy trì check `blacklist` cho lệnh bên trong.

### C. Giao diện điều khiển (`src/extension.js` & `scripts/menu.sh`)
- Cập nhật menu để người dùng có thể bật/tắt từng category (`Terminal: ON`, `Review: OFF`,...).

## 3. Các bước thực hiện
1. [ ] Cập nhật file `config.json` với cấu trúc mới.
2. [ ] Sửa `src/injection-payload.js` để xử lý logic phân loại.
3. [ ] Cập nhật `src/extension.js` để hiển thị menu phân cấp cho Auto Accept.
4. [ ] Kiểm thử với các mẫu dialog giả lập (scripts/trigger-accept-test.js).

## 4. Ghi chú cho ngày mai
- Cần chuẩn bị thêm các mẫu chuỗi (regex) thực tế cho nhóm `review` và `system`.
- Kiểm tra tính tương thích ngược (Backward Compatibility) để không làm hỏng config cũ của người dùng.
