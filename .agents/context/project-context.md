# Project Context: Antigravity Auto-Click

## Overview
This project provides a background daemon for macOS that connects to a local Antigravity instance (Electron-based IDE) via the Chrome DevTools Protocol (CDP) and injects a DOM automation payload. The payload currently supports two flows:
- **Auto-Retry**: detect error dialogs such as "High Traffic" / overloaded / rate-limited states and click retry-style actions.
- **Auto-Accept**: detect selected Agent confirmation dialogs and optionally click action buttons such as `Run`, `Accept`, or `Proceed`, with category-based controls and a terminal-command blacklist.

## Tech Stack
- **Node.js**: The daemon that orchestrates the CDP connection and payload injection.
- **Chrome DevTools Protocol (CDP)**: Used to control and inspect the Electron renderer process. Specifically utilizing `ws` to connect directly to the WebSocket endpoint.
- **Vanilla JavaScript**: The payload that gets injected into the DOM. Uses passive polling (interval-based) for detection.
- **macOS LaunchAgent (launchd)**: Used to ensure the Node.js daemon starts automatically when the user logs in.


## Key Design Decisions
- **Target Filtering**: Only inject into `page` targets that look like the main Antigravity UI (`workbench`, `Launchpad`, `Antigravity`), not arbitrary webviews.
- **Dynamic CDP Port Detection**: The daemon reads the active `--remote-debugging-port=...` from the running Electron process instead of assuming a single fixed port.
- **Container Scoping**: DOM scanning is limited to dialog / notification / agent-panel style containers such as `.monaco-dialog-box`, `.notification-toast`, `.bg-agent-convo-background`, and `.antigravity-agent-side-panel` to reduce false positives.
- **Shadow DOM Traversal**: The payload walks into shadow roots because Antigravity UI elements are not always exposed in the light DOM.
- **Safety Gates**: Auto-Accept is protected by category matching, visibility checks, rate limiting, and a blacklist for dangerous terminal commands. By default, `performClickAutoAccept` can be kept `false` to collect detection stats without performing real clicks.
- **Passive Polling Detection**: Detection is interval-based (defined by `pollInterval`) rather than event-driven (`MutationObserver`). This reduces CPU overhead and avoids race conditions during rapid DOM mutations.
- **Versioned Injection**: The injected script uses a version marker and cleanup hook so newer payloads can disable old timers and avoid duplicate clicks or leaks during reinjection.
