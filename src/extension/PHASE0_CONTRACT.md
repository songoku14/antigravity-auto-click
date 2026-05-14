# Phase 0 Contract

## Source of truth

- Runtime/domain config dùng `config.json`.
- Extension chỉ đọc/ghi thông qua `config-service.js`.
- Mọi giá trị trước khi hiển thị hoặc lưu đều đi qua `normalizeConfig()`.

## Canonical category keys

- `terminal`
- `reviewChange`
- `systemReview`

## Legacy migration rules

- `review` -> `reviewChange`
- `system` -> `systemReview`
- `patterns` -> giữ như nguồn legacy và map sang `context` khi normalize
- `performClickAutoAccept` -> `autoAccept.performClick`
- flat timing/rate-limit keys -> map vào nested `autoRetry.*`

## UI contract direction

- Phase 2:
  - status bar
  - control center
  - command palette actions
- Phase 3:
  - auto retry settings
- Phase 4:
  - auto accept settings
  - per-category controls
- Phase 5:
  - activity
  - diagnostics

## Guardrails

- Không thêm category mới trong loạt phase hiện tại.
- Không đổi semantics core detection chỉ để phục vụ UI.
- Không ghi config trực tiếp từ UI ngoài `config-service.js`.
