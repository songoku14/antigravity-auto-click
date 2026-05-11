/**
 * scripts/debug-buttons.js
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

async function debug() {
  const port = findCDPPort();
  if (!port) return;
  const targets = await getTargets(port);
  const pageTargets = filterPageTargets(targets);

  for (const target of pageTargets) {
    console.log(`\n🔍 Debugging target: "${target.title}"`);
    const results = await runDebugCommand(target);
    console.log(results);
  }
}

function runDebugCommand(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    
    const code = `
      (function() {
        const logs = [];
        function scan(root, depth=0) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let el;
          while (el = walker.nextNode()) {
            const text = (el.textContent || "").trim();
            if (text.includes("Accept all")) {
              const style = window.getComputedStyle(el);
              logs.push({
                tag: el.tagName,
                text: text.substring(0, 50),
                classes: el.className,
                cursor: style.cursor,
                isClickable: el.tagName === 'BUTTON' || style.cursor === 'pointer' || el.classList.contains('cursor-pointer'),
                depth: depth
              });
            }
            if (el.shadowRoot) {
              scan(el.shadowRoot, depth + 1);
            }
          }
        }
        scan(document);
        return logs;
      })()
    `;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: code, returnByValue: true }
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === 1) {
        ws.terminate();
        resolve(msg.result?.result?.value);
      }
    });

    ws.on('error', () => resolve("Error"));
    setTimeout(() => { ws.terminate(); resolve("Timeout"); }, 5000);
  });
}

debug();
