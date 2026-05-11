# Project Context: Antigravity Auto-Click

## Overview
This project provides a daemon that runs in the background on macOS, connects to the local Antigravity instance (an Electron-based AI editor) via the Chrome DevTools Protocol (CDP), and injects a script. The injected script monitors the DOM for "High Traffic" error dialogs and automatically clicks the "Retry" button.

## Tech Stack
- **Node.js**: The daemon that orchestrates the CDP connection and payload injection.
- **Chrome DevTools Protocol (CDP)**: Used to control and inspect the Electron renderer process. Specifically utilizing `ws` to connect directly to the WebSocket endpoint.
- **Vanilla JavaScript**: The payload that gets injected into the DOM. Uses `MutationObserver` for real-time detection.
- **macOS LaunchAgent (launchd)**: Used to ensure the Node.js daemon starts automatically when the user logs in.


## Key Design Decisions
- **Target Filtering**: We only inject into `page` targets that resemble the main UI (Workbench or Launchpad).
- **Container Scoping**: The injected script specifically scopes its search to `.monaco-dialog-box`, `.notification-toast`, and similar containers. This prevents false positives where the script might click a word like "retry" that happens to be inside a file currently being edited.
- **Versioning (v3)**: The injected script handles versioning to ensure that if a new version is injected during development, it disables the `MutationObserver` and `setInterval` of older versions to avoid memory leaks and duplicate clicks.
