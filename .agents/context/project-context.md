# Project Context: Antigravity Auto-Click

## Overview
This project provides a background daemon for macOS that connects to a local Antigravity instance (Electron-based IDE) via the Chrome DevTools Protocol (CDP) and injects a DOM automation payload. The payload supports two main flows:
- **Auto-Retry**: detect error dialogs such as "High Traffic" / overloaded / rate-limited states and click retry-style actions.
- **Auto-Accept**: detect selected Agent confirmation dialogs and click action buttons such as `Run`, `Accept`, or `Proceed`, with category-based controls (`terminal`, `reviewChange`, `systemReview`) and a terminal-command blacklist.

The primary user interface is now a **Webview Control Center** integrated into the VS Code bottom panel/sidebar, replacing the legacy QuickPick menu.

## Tech Stack
- **Node.js**: The daemon that orchestrates the CDP connection and payload injection.
- **VS Code Extension API**: The control surface using `WebviewViewProvider` for the Control Center.
- **Chrome DevTools Protocol (CDP)**: Used to control and inspect the Electron renderer process via WebSocket.
- **Vanilla JavaScript/CSS**: The payload injected into the DOM and the Webview UI components.
- **macOS LaunchAgent (launchd)**: Ensures the daemon starts automatically on login.

## Current Product Direction
- **Webview-first UX**: The "Control Center" webview is the main interface for toggling features, managing the blacklist, and viewing statistics.
- **Integrated Stats**: Real-time statistics (Retry/Accept counts) are displayed directly within the Control Center.
- **Compact Blacklist**: Tag-based blacklist management with instant add/remove capabilities.
- **Safety-first controls**: `systemReview` category requires explicit confirmation. Master toggles synchronize with sub-categories.
- **CLI as fallback**: Legacy scripts remain available for diagnostics and maintenance.

## Extension Architecture (Webview Control Center)
- **Single source of truth**: `config.json` remains the primary runtime config file.
- **Core Services**:
  - `src/extension/config-service.js`: Config read/write gateway.
  - `src/extension/daemon-service.js`: Daemon lifecycle management.
  - `src/extension/activity-service.js`: Activity log parsing and statistics summarization.
  - `src/extension/webview-provider.js`: Manages the Webview lifecycle and message passing.
- **UI Components (`src/extension/media/`)**:
  - `main.js`: Handles state sync, toggle logic, and blacklist UI interactions.
  - `main.css`: Modern dark theme with CSS-only toggle switches and responsive layout.

## Storage Architecture
- **Canonical Path**:
  - macOS: `~/Library/Application Support/Antigravity IDE/Auto Click/` (hoặc fallback `~/Library/Application Support/Antigravity/Auto Click/`)
  - Windows: `%APPDATA%\Antigravity IDE\Auto Click\` (hoặc fallback `%APPDATA%\Antigravity\Auto Click\`)
- **Logic**: Được triển khai tại `src/core/storage-paths.js`. Hệ thống kiểm tra xem IDE mới (`Antigravity IDE`) hoặc thư mục cấu hình của nó có tồn tại hay không để chọn đường dẫn tương ứng làm thư mục lưu trữ canonical. Nếu có biến môi trường `ANTIGRAVITY_AUTO_CLICK_HOME`, biến này sẽ được ưu tiên hàng đầu.
- **Synchronization**: Cả CLI và Extension đều dùng chung logic này để đảm bảo luôn trỏ về cùng một file `config.json` và `activity-log.json` dù chạy từ môi trường nào.

## Key Design Decisions
- **Passive Polling**: The payload uses interval-based polling to detect dialogs, minimizing CPU overhead.
- **Container Scoping**: DOM scanning is limited to specific dialog/notification containers (e.g., `.monaco-dialog-box`).
- **Category Normalization**: Legacy keys (e.g., `review`, `system`) are normalized to `reviewChange` and `systemReview` in the extension layer.
- **Logging Control**: Added `logging` configuration to mitigate large log files. `logging.enabled` silences daemon console output (controlling `daemon.log` size), while `logging.activityLog` controls `activity-log.json` persistence.
- **Dynamic Debugging**: `debug` mode is now a dynamic configuration that can be toggled without restarting the daemon.
- **Master Toggle Sync**: Toggling "Auto Accept" affects all sub-categories. Conversely, if all sub-categories are disabled, "Auto Accept" turns off; if one is enabled, it turns on.
- **Live UI Updates**: Cơ chế watcher đảm bảo đồng bộ hóa trạng thái giữa Daemon và Extension:
  - **Daemon**: `ConfigStore` dùng `fs.watch` trên thư mục config với debounce 300ms để tải lại `config.json`.
  - **Extension**: Sử dụng `fs.watch` (fallback `createFileSystemWatcher`) với debounce 300ms cho `config.json` và 1000ms (1s) cho `activity-log.json` để cập nhật Webview/StatusBar theo thời gian thực.
- **Theme Awareness**: The Webview CSS uses VS Code CSS variables (`var(--vscode-*)`) to match the user's theme.

## Operational Boundaries
- **Do not move detection logic** from the payload into the extension.
- **Do not break CLI/Daemon compatibility** when updating config schemas.
- **Maintain backward compatibility** with QuickPick commands while prioritizing the Webview UI.
