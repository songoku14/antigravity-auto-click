# Project Context: Antigravity Auto-Click

## Overview
This project provides a background daemon for macOS that connects to a local Antigravity instance (Electron-based IDE) via the Chrome DevTools Protocol (CDP) and injects a DOM automation payload. The payload currently supports two flows:
- **Auto-Retry**: detect error dialogs such as "High Traffic" / overloaded / rate-limited states and click retry-style actions.
- **Auto-Accept**: detect selected Agent confirmation dialogs and optionally click action buttons such as `Run`, `Accept`, or `Proceed`, with category-based controls (`terminal`, `reviewChange`, `systemReview`) and a terminal-command blacklist.

The project originally exposed its operational UX primarily through a CLI menu. The current direction is to move day-to-day control into an Antigravity/VS Code extension while preserving the existing daemon, payload, config model, CLI tools, and regression assets.

## Tech Stack
- **Node.js**: The daemon that orchestrates the CDP connection and payload injection.
- **VS Code / Antigravity Extension API**: The new control surface for configuration, status, commands, and diagnostics.
- **Chrome DevTools Protocol (CDP)**: Used to control and inspect the Electron renderer process. Specifically utilizing `ws` to connect directly to the WebSocket endpoint.
- **Vanilla JavaScript**: The payload that gets injected into the DOM. Uses passive polling (interval-based) for detection.
- **macOS LaunchAgent (launchd)**: Used to ensure the Node.js daemon starts automatically when the user logs in.

## Current Product Direction
- **Extension-first UX**: The extension is being rebuilt as the main control center for everyday usage.
- **CLI as fallback/dev tools**: `scripts/menu.sh`, status scripts, regression scripts, and tooling remain important for diagnostics, maintenance, and validation.
- **Reuse core logic**: The daemon, payload, config normalization, and samples stay as the core runtime; the extension should not duplicate detection logic.
- **Safety-first controls**: Auto-Accept remains gated by category controls, blacklist rules, and `performClick` safety boundaries.

## Extension Architecture (Phase 0/1 Foundation)
- **Single source of truth**: `config.json` remains the primary runtime config file.
- **Normalization layer**: `src/core/config-schema.js` is the shared config normalization contract for CLI, daemon, and extension.
- **Canonical Auto-Accept categories**:
  - `terminal`
  - `reviewChange`
  - `systemReview`
- **Legacy migration support**:
  - `review` is normalized to `reviewChange`
  - `system` is normalized to `systemReview`
  - legacy flat keys such as `performClickAutoAccept`, `pollInterval`, `clickDelay`, `minClickInterval`, `maxRetriesPerMinute`, `cooldownMs`, and top-level `blacklist` are still normalized into the current nested config model
- **Extension module split**:
  - `src/extension/extension.js`: top-level bootstrap and command wiring
  - `src/extension/config-service.js`: config read/write/inspect gateway
  - `src/extension/daemon-service.js`: start/stop/reload orchestration with state management (`starting`, `running`, `stopping`, `reloading`)
  - `src/extension/status-service.js`: status-bar summary formatting
  - `src/extension/activity-service.js`: activity-log summary layer with category normalization
  - `src/extension/diagnostics-service.js`: system health diagnostics (CDP, Config, Files, Logs)
  - `src/extension/config-contract.js`: config-to-UI field contract and migration metadata
- **Current UI maturity**:
  - Phase 0/1: Foundation, command surface, migration-safe config handling.
  - Phase 2: Control Center UI (Codicons, Quick Toggles, Status Bar badges).
  - Phase 3/4: Detailed Settings UI for Auto Retry and Auto Accept (per-category controls, validation, safety warnings).
  - Phase 5: Activity & Diagnostics UI (detailed stats, skip reasons, system health check).
  - Phase 6: Robust Daemon Orchestration (pgrep protection, state transitions, stop.sh integration).
  - Phase 7/8: Regression, compatibility validation, and documentation rollout.

## Operational Boundaries
- **Do not move detection logic into the extension layer** unless a change is strictly required by product behavior.
- **Do not reintroduce legacy category names** into new UI or config-writing paths.
- **Do not break CLI compatibility** when changing config handling or extension orchestration.
- **Prefer service/module boundaries** in `src/extension/**` instead of growing `extension.js` into a monolith again.

## Key Design Decisions
- **Target Filtering**: Only inject into `page` targets that look like the main Antigravity UI (`workbench`, `Launchpad`, `Antigravity`), not arbitrary webviews.
- **Dynamic CDP Port Detection**: The daemon reads the active `--remote-debugging-port=...` from the running Electron process instead of assuming a single fixed port.
- **Container Scoping**: DOM scanning is limited to dialog / notification / agent-panel style containers such as `.monaco-dialog-box`, `.notification-toast`, `.bg-agent-convo-background`, and `.antigravity-agent-side-panel` to reduce false positives.
- **Shadow DOM Traversal**: The payload walks into shadow roots because Antigravity UI elements are not always exposed in the light DOM.
- **Safety Gates**: Auto-Accept is protected by category matching, visibility checks, rate limiting, and a blacklist for dangerous terminal commands. By default, `performClickAutoAccept` can be kept `false` to collect detection stats without performing real clicks.
- **Passive Polling Detection**: Detection is interval-based (defined by `pollInterval`) rather than event-driven (`MutationObserver`). This reduces CPU overhead and avoids race conditions during rapid DOM mutations.
- **Versioned Injection**: The injected script uses a version marker and cleanup hook so newer payloads can disable old timers and avoid duplicate clicks or leaks during reinjection.
- **Config Compatibility First**: New extension work must normalize and preserve existing user config instead of forcing a breaking config rewrite.
- **Daemon Orchestration Protection**: The extension uses `pgrep` to detect existing daemon processes before starting new ones, ensuring compatibility with LaunchAgent and CLI-initiated sessions.
- **Category Normalization**: Activity logs may contain legacy or lowercase category keys; the extension layer (`activity-service.js`) is responsible for normalizing these to the canonical camelCase format (`terminal`, `reviewChange`, `systemReview`) for UI display.
- **Diagnostics Layer**: System health is proactively monitored via `diagnostics-service.js`, which checks for active CDP ports, configuration schema violations, and log accessibility.
