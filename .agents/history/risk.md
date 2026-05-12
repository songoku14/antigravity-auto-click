## Đã kiểm tra rủi ro và đánh giá giải pháp của toàn bộ hệ thống

Lạc quan về mức “an toàn” của logic tìm button hiện tại. CDP là lựa chọn hợp lý, còn phần target-button detection cần siết lại.

**CDP Có Hợp Lý Không**
Có. Với Antigravity là Electron app, CDP + `Runtime.evaluate` phù hợp, có thể đi qua Shadow DOM và dùng `MutationObserver`. Implementation cũng đã có timeout WebSocket, cleanup, reinject sau reload theo chuẩn CDP.

Rủi ro chính của CDP là vận hành: Antigravity phải chạy với `--remote-debugging-port`, đây là một bề mặt điều khiển local khá mạnh. Target filtering hiện ở [src/core/discovery.js](/Users/lehoangthang/Documents/antigravity-auto-click/src/core/discovery.js:99) chỉ lọc `page` + title/url, chấp nhận được nhưng vẫn nên coi là heuristic, không phải boundary an toàn tuyệt đối.

**Rủi Ro Trong Cách Tìm Button Hiện Tại**
Có vài điểm đáng chú ý:

1. `actionCategories` được khai báo nhưng gần như chưa dùng để xác thực context category. Ở [src/payload/injection-payload.js](/Users/lehoangthang/Documents/antigravity-auto-click/src/payload/injection-payload.js:776), code loop qua category rồi tìm mọi action button, nhưng không check container text có match pattern của category đó. Vì vậy `Proceed` review có thể bị ghi/click dưới category `terminal`.

2. Auto-Accept dùng clickable khá rộng: `.cursor-pointer`, style cursor pointer, `.btn`, `.button` tại [src/payload/injection-payload.js](/Users/lehoangthang/Documents/antigravity-auto-click/src/payload/injection-payload.js:405). Điều này cần thiết cho `Accept all`, nhưng cũng dễ bắt nhầm wrapper div hoặc card cha.

3. Blacklist terminal chưa đủ tin cậy. `extractCommandText()` chỉ tìm `pre`, `code`, `.monaco-editor-background`, `.command-text` tại [src/payload/injection-payload.js](/Users/lehoangthang/Documents/antigravity-auto-click/src/payload/injection-payload.js:344). Trong sample `Run(when_black_list_with_rm_command)...`, command `rm ".../Test Space File.html"` nằm trong span cùng hàng với nút Run, nên dry-run mô phỏng hiện tại trả command rỗng và không block được.

4. Visibility gate ở real run hiện chỉ log khi fail, chưa `continue`. Trong nhánh non-dry-run tại [src/payload/injection-payload.js](/Users/lehoangthang/Documents/antigravity-auto-click/src/payload/injection-payload.js:736) và accept tại line 805, nếu `visibility.ok === false`, code vẫn đi tiếp đến click. Đây là mismatch với mô tả “visibility checks” trong context.

5. Regression script chưa test các sample hiện tại. `node scripts/tests/regression.js` báo không tìm thấy mẫu `full_dom_`, trong khi samples đang là `Retry(...)`, `Run(...)`, `Accept_all...`. Vì vậy bộ regression hiện không bảo vệ các DOM snapshot quan trọng này.

**Điểm Chung Từ Samples**
Tôi phân tích 6 file trong `samples/`:

- `Retry(...)`: target là `button` thật, text đúng `Retry`, nằm trong `.bg-agent-convo-background`, thường trong `footer`, context có `Agent terminated due to error` hoặc retry/error text. Logic hiện tại phù hợp nhất với nhóm này.
- `Proceed(WhenReview)...`: target là `button` thật, text `Proceed`, nằm trong `.antigravity-agent-side-panel`, context là card “Implementation Plan...”. Nên phân loại `review`, không phải terminal.
- `Run(...)`: target tốt nhất là `button` con text `Run⌥Enter`, nằm trong `#antigravity.agentSidePanelInputBox`. Có wrapper div cũng match `Run...keyboard_arrow_up`, nhưng click wrapper rủi ro hơn click button chính.
- `Run(blacklist rm...)`: command nguy hiểm nằm trong text cùng hàng với prompt Run, không nằm trong `pre/code`, nên blacklist hiện tại dễ miss.
- `Accept_all...`: target là `span.cursor-pointer.bg-ide-button-background`, text exact `Accept all`, nằm trong `.antigravity-agent-side-panel`, cùng cụm với `Reject all` và “File With Changes”. Đây là lý do Auto-Accept cần hỗ trợ loose clickable, nhưng nên chỉ bật loose mode cho detector riêng của changes UI.

**Giải Pháp Tốt Hơn**
Nên chuyển từ “scan chung mọi action button” sang detector theo intent:

1. `detectRetryCard(container)`: chỉ nhận `.bg-agent-convo-background` hoặc dialog/toast có error context, button exact `Retry`, ưu tiên `footer button`.

2. `detectTerminalRun(container)`: chỉ scope vào `#antigravity\\.agentSidePanelInputBox`, lấy command từ cùng hàng prompt `Run ... ?`, click đúng `button` chính có text bắt đầu `Run`, bỏ qua wrapper và arrow split button. Blacklist phải chạy trên full row text, không chỉ `pre/code`.

3. `detectReviewProceed(container)`: context phải có `Implementation Plan`, `review`, `changes`, hoặc workflow/review markers; button exact `Proceed`; category phải là `review`.

4. `detectAcceptAllChanges(container)`: scope vào block có `File With Changes` + sibling `Reject all`; target exact `Accept all`; category `review`.

5. Generic fallback chỉ nên dùng ở dry-run/debug hoặc khi `performClickAutoAccept=false`.

Ngoài ra nên sửa regression để tự chạy tất cả `samples/*.html`, dùng từ đầu tiên của filename làm expected target như bạn mô tả. Hiện samples có giá trị nhưng chưa được test suite sử dụng.