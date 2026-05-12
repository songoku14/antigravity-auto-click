/**
 * scripts/tools/find-text.js
 * 
 * Tìm kiếm văn bản cụ thể trong toàn bộ các frame/shadow DOM của Antigravity.
 * Hữu ích để tìm selector cho các nút bấm ẩn sâu trong shadow DOM.
 */

const WebSocket = require('ws');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

async function findText(searchText) {
  const port = findCDPPort();
  if (!port) {
    console.error('❌ CDP port not found.');
    return;
  }

  const targets = await getTargets(port);
  const pageTargets = filterPageTargets(targets);

  for (const target of pageTargets) {
    console.log(`\n🔍 Scanning target: "${target.title}"`);
    const results = await runFindCommand(target, searchText);
    if (results && results.length > 0) {
      console.log(`✅ Found ${results.length} matches:`);
      results.forEach((res, i) => {
        console.log(`\n--- Match #${i+1} ---`);
        console.log(`Tag: ${res.tag}`);
        console.log(`Classes: ${res.className}`);
        console.log(`HTML: ${res.html}`);
        console.log(`Ancestors: ${res.ancestors.join(' > ')}`);
      });
    } else {
      console.log('❌ No matches found.');
    }
  }
}

function runFindCommand(target, text) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    
    const code = `
      (function() {
        function findInShadows(root, text) {
          let results = [];
          
          // Search in current root
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let el;
          while (el = walker.nextNode()) {
            if (el.textContent && el.textContent.includes(text) && el.children.length === 0) {
              const ancestors = [];
              let p = el.parentElement;
              for(let i=0; i<5 && p; i++) {
                ancestors.push(p.tagName + (p.className ? "." + p.className.split(" ").join(".") : ""));
                p = p.parentElement;
              }
              results.push({
                tag: el.tagName,
                className: el.className,
                html: el.outerHTML.substring(0, 500),
                ancestors: ancestors
              });
            }
            if (el.shadowRoot) {
              results = results.concat(findInShadows(el.shadowRoot, text));
            }
          }
          return results;
        }
        return findInShadows(document, "${text}");
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

    ws.on('error', () => resolve(null));
    setTimeout(() => { ws.terminate(); resolve(null); }, 5000);
  });
}

const args = process.argv.slice(2);
findText(args[0] || 'Accept all');
