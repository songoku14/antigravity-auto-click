# Tối ưu hóa Phát hiện Button trong Agent Window

Kế hoạch này nhằm mục đích tăng độ chính xác khi tự động click các nút "Retry" và "Accept" bằng cách tập trung vào "Agent Window" (bảng bên phải) và xử lý các trường hợp các nút bị chồng lấp hoặc nằm ngoài vùng tương tác mong muốn.

## User Review Required

> [!IMPORTANT]
> Việc giới hạn phạm vi quét vào `.antigravity-agent-side-panel` sẽ giúp giảm thiểu rủi ro click nhầm trong Editor, nhưng cần đảm bảo class này là duy nhất và ổn định trong các phiên bản Antigravity.

## Proposed Changes

### Core Logic (src)

#### [MODIFY] [injection-payload.js](file:///Users/lehoangthang/Documents/antigravity-auto-click/src/injection-payload.js)

1. **Cập nhật `CONFIG.dialogContainerSelectors`**:
   - Thêm `.antigravity-agent-side-panel` vào đầu danh sách các container hợp lệ.
   - Thêm `#antigravity.agentSidePanelInputBox` để quét sâu hơn vào vùng input.

2. **Cải tiến `findButtonsIn`**:
   - Trả về thông tin tọa độ (`getBoundingClientRect`) cho mỗi button.
   - Gắn nhãn cho các button nằm trong thẻ `<footer>` để ưu tiên (vì dialog thường đặt button ở footer).

3. **Thêm Logic Lọc Tọa độ (Spatial Filtering)**:
   - Một button được coi là "Agent Button" hợp lệ nếu:
     - Nó nằm bên trong `.antigravity-agent-side-panel`.
     - HOẶC (nếu quét fallback) nó nằm ở nửa phải màn hình (`rect.left > window.innerWidth / 2`) và nửa dưới màn hình (`rect.top > window.innerHeight / 2`).

4. **Xử lý Chồng lấp (Overlap Handling)**:
   - Trước khi click, sử dụng `document.elementFromPoint(x, y)` tại tâm của button.
   - Nếu phần tử trả về không phải là chính button đó (hoặc con của nó), nghĩa là button đang bị che khuất bởi một dialog khác đè lên trên. Trong trường hợp này, ta sẽ bỏ qua button bị che và tìm button ở lớp trên cùng.

5. **Cập nhật `scanAndAction`**:
   - Ưu tiên container `.antigravity-agent-side-panel` trước các container khác.

## Verification Plan

### Automated Tests
- Sử dụng `trigger-test.js` để tạo dialog giả lập.
- Chạy `scripts/trigger-accept-test.js` để kiểm tra các dialog "Accept".
- **Test mới**: Tạo 2 dialog giả lập chồng lên nhau để xác nhận script click đúng vào dialog ở trên cùng.

### Manual Verification
- Mở Antigravity, kích hoạt chế độ Auto-Click.
- Ép lỗi "High Traffic" hoặc "Agent Terminated" (thường xuất hiện ở bảng bên phải).
- Quan sát xem script có target đúng vào nút trong Agent Window hay không.
