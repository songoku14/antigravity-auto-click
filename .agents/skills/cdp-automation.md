# Skill: CDP Automation

## Chrome DevTools Protocol (CDP) Usage in Electron
Electron exposes CDP via the `--remote-debugging-port` flag. This allows us to interact with the underlying Chromium instance.

### Connection
- **Endpoint**: Retrieve targets via `http://localhost:<PORT>/json`.
- **WebSocket**: Connect to the `webSocketDebuggerUrl` provided in the JSON target list.
- **Library**: We use `ws` instead of `chrome-remote-interface` to minimize dependencies.

### Command Execution
- Messages must be JSON objects: `{ id: 1, method: "Domain.method", params: {} }`.
- Always implement a timeout mechanism for promises awaiting CDP responses.

### Injection
- Use `Runtime.evaluate`.
- **Crucial**: Set `returnByValue: true` if you need the script to return a string/object back to Node.js.
- **Safety**: Always scope injected variables inside an IIFE `(function(){ ... })();` to prevent conflicts with the host page.

### Reconnection
- Use the `Page` domain to listen for navigation events.
- `Page.enable` must be called to receive `Page.loadEventFired` or `Page.domContentEventFired`.
- Re-inject the script when a reload is detected.
