# Kế hoạch Cải tiến: Tối ưu hóa quét Nút bấm

Tài liệu này chi tiết các hành động cải tiến logic tự động click để đạt hiệu năng cao nhất và độ an toàn tuyệt đối.

---

## 🚀 Action 1: Thu hẹp phạm vi quét vào Agent Window

*   **Hiện tại**: Hệ thống quét rất nhiều loại container (`.monaco-dialog-box`, `.notification-toast`...) và fallback về toàn bộ `document.body` nếu không tìm thấy vùng cụ thể.
*   **Cách cải thiện**: Chỉ thực hiện quét duy nhất bên trong `.antigravity-agent-side-panel`. Bỏ qua mọi loại Dialog hệ thống khác.
*   **Lý do & Mục đích**: 
    - Qua phân tích 100% mẫu (samples) đều nằm trong Agent Window.
    - Loại bỏ hoàn toàn rủi ro click nhầm vào các nút hệ thống của IDE (như hộp thoại xác nhận xóa file).
    - Giảm thiểu khối lượng công việc cho bộ quét DOM.
*   **DOD (Definition of Done)**:
    - [x] `DEFAULT_DIALOG_CONTAINER_SELECTORS` chỉ còn chứa `.antigravity-agent-side-panel`.
    - [x] Logic fallback về `document.body` được xóa bỏ.
    - [x] Hệ thống vẫn nhận diện và click đúng các nút trong cửa sổ Agent Side Panel.
*   **Chi tiết triển khai**:
    - **`src/core/config-schema.js`**: Thay toàn bộ mảng `DEFAULT_DIALOG_CONTAINER_SELECTORS` chỉ còn 1 phần tử:
      ```js
      // Từ:
      const DEFAULT_DIALOG_CONTAINER_SELECTORS = [
        '.antigravity-mock-dialog',
        '.monaco-dialog-box',
        // ... (16 selectors)
      ];
      // Thành:
      const DEFAULT_DIALOG_CONTAINER_SELECTORS = [
        '.antigravity-agent-side-panel'
      ];
      ```
    - **`src/payload/injection-payload.js` (L808-L810)**: Xóa 2 dòng fallback:
      ```js
      // Xóa bỏ 2 dòng này:
      const useFallback = containers.length === 0 && (isAutoAcceptEnabled() || RETRY_CONFIG.enabled !== false);
      if (useFallback) containers = [document.body];
      ```
    - **`src/payload/injection-payload.js`**: Biến `useFallback` sau đó được dùng tại L864 và L874 — xóa luôn 2 nánh context-check có điều kiện `useFallback`/`!useFallback`, gộp thành 1 context-check duy nhất.

---

## 🚀 Action 2: Loại bỏ Quy tắc Phía bên phải (Right Side Rule)

*   **Hiện tại**: Hệ thống yêu cầu nút bấm phải nằm ở tọa độ `x > 40%` chiều rộng cửa sổ để tránh click nút "Cancel".
*   **Cách cải thiện**: Xóa bỏ hoàn toàn bước kiểm tra tọa độ `x`.
*   **Lý do & Mục đích**:
    - Khi đã giới hạn phạm vi vào Agent Window, mọi nút khớp pattern (Retry/Accept) đều là hành động mong muốn.
    - Tránh việc tính toán sai khi người dùng thu nhỏ cửa sổ side panel.
    - Làm gọn mã nguồn Giai đoạn 3.
*   **DOD (Definition of Done)**:
    - [x] Hàm kiểm tra tọa độ x được gỡ bỏ khỏi luồng xử lý chính.
    - [x] Các nút nằm sát lề trái của Agent Window vẫn được click bình thường.
*   **Chi tiết triển khai**:
    - **`src/payload/injection-payload.js` — RETRY (L846-L856)**: Xóa khối `isRightSide` + `if` block:
      ```js
      // Xóa toàn bộ khối này:
      const isRightSide = btnObj.rect.left > window.innerWidth * 0.4;
      if (!USER_CONFIG.testMode && !isAgentWindow && !isRightSide) {
        if (dryRun) { ... }
        if (!dryRun) logSkippedStat('RETRY', 'not_right_side');
        debug(...);
        continue;
      }
      ```
    - **`src/payload/injection-payload.js` — ACCEPT (L960-L970)**: Xóa khối tương tự cho ACCEPT.
    - **`src/payload/injection-payload.js`**: Biến `isAgentWindow` (L813) và `isRightSide` sau khi xóa 2 khối trên sẽ không còn được dùng trong luồng chính — xóa luôn khai báo `isAgentWindow` trong `scanAndAction` (giữ lại trong `buttonDiagnostic` vì dùng cho báo cáo dryRun).

---

## 🚀 Action 3: Triển khai Lớp lọc nhanh (Fast Path) cho Giai đoạn 2

*   **Hiện tại**: Hệ thống luôn dùng `TreeWalker` để duyệt từng node trong DOM ngay khi tìm thấy container.
*   **Cách cải thiện**: Thêm bước kiểm tra sơ bộ bằng `container.textContent.includes()`.
*   **Lý do & Mục đích**:
    - Tận dụng tốc độ thực thi Native (C++) cực nhanh của trình duyệt để tìm văn bản.
    - Nếu không thấy từ khóa mục tiêu, hệ thống thoát ngay lập tức, tiết kiệm 99% tài nguyên JavaScript trong trạng thái chờ.
*   **DOD (Definition of Done)**:
    - [x] Thêm logic `if (!container.textContent.includes(...)) return;` trước khi khởi tạo `TreeWalker`.
    - [x] Kiểm tra thực tế: Khi không có lỗi, tài nguyên CPU tiêu thụ bởi payload giảm xuống mức tối thiểu.
*   **Chi tiết triển khai**:
    - **`src/payload/injection-payload.js` — hàm `findButtonsIn` (sau L511)**:
      ```js
      function findButtonsIn(root, patterns, typeLabel) {
        let buttons = [];
        const isRetryScan = patterns === CONFIG.retryButtonPatterns;

        // ✔ THÊM: Fast Path — thoát sớm nếu không có keyword nào cần tìm
        if (patterns && patterns.length > 0) {
          const text = (root.textContent || '').toLowerCase();
          const hasKeyword = patterns.some(p => {
            // Chỉ extract literal từ regex dạng /^keyword$/i — bỏ qua regex phức tạp
            const src = p.source.replace(/[\^\$\\]/g, '').replace(/\\s\*/g, ' ').trim().toLowerCase();
            return src && text.includes(src);
          });
          if (!hasKeyword) return buttons;
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        // ... (giữ nguyên phần còn lại)
      }
      ```
    - **Lưu ý**: Fast path chạy trước `TreeWalker`. Nếu `patterns` là `null` (gọi từ `resolveLiveButton`) thì bỏ qua fast path hoàn toàn.

---

## 🚀 Action 4: Xóa Dead Code `antigravity-mock-dialog`

*   **Bối cảnh**: Tính năng bật mock dialog cho người dùng đã bị xóa. Toàn bộ code liên quan đến `MOCK_MARKER_CLASS` hiện là dead code, không còn phục vụ luồng detection thật.
*   **Cách cải thiện**: Xóa sạch 4 vị trí dead code trong `injection-payload.js`:
    1.  Constant `MOCK_MARKER_CLASS = 'antigravity-mock-dialog'` (L23)
    2.  Logic prepend mock vào `CONFIG.dialogContainerSelectors` (L59-60)
    3.  Hàm `cleanupMocks()` (L223-233)
    4.  Nhánh `if (isMock)` trong `performClick` (L1126-1138)
*   **Lý do & Mục đích**:
    - Giảm kích thước payload inject vào DOM.
    - Tránh nhầm lẫn khi đọc code — không còn path xử lý giả.
    - **Điều kiện tiên quyết cho Action 1**: Xóa mock trước để `DEFAULT_DIALOG_CONTAINER_SELECTORS` trong `config-schema.js` không còn `.antigravity-mock-dialog` → Action 1 mới thực sự sạch.
*   **DOD (Definition of Done)**:
    - [x] `MOCK_MARKER_CLASS` constant bị xóa khỏi payload.
    - [x] `cleanupMocks()` bị xóa.
    - [x] Nhánh `if (isMock)` trong `performClick` bị xóa.
    - [x] `.antigravity-mock-dialog` bị xóa khỏi `DEFAULT_DIALOG_CONTAINER_SELECTORS` trong `config-schema.js`.
    - [x] Grep toàn project không còn kết quả nào cho `antigravity-mock-dialog` hoặc `MOCK_MARKER_CLASS`.

---

## ✅ Trạng thái: HOÀN THÀNH (Action 1, 2, 3, 4)
