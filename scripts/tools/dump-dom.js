/**
 * scripts/dump-dom.js
 * 
 * Utility to dump the entire DOM of the active page into a file.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { findCDPPort, getTargets, filterPageTargets } = require('../../src/core/discovery');

async function dumpDom() {
  const port = findCDPPort();
  if (!port) {
    console.error('❌ CDP port not found.');
    return;
  }

  const targets = await getTargets(port);
  const pageTargets = filterPageTargets(targets);

  if (pageTargets.length === 0) {
    console.error('❌ No active pages found.');
    return;
  }

  const samplesDir = path.join(__dirname, '..', 'samples');
  if (!fs.existsSync(samplesDir)) fs.mkdirSync(samplesDir);

  for (const target of pageTargets) {
    console.log(`\n📦 Dumping DOM for: "${target.title}"`);
    const html = await runDumpCommand(target);
    
    if (html) {
      const safeTitle = target.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `full_dom_${safeTitle}_${Date.now()}.html`;
      const filePath = path.join(samplesDir, filename);
      fs.writeFileSync(filePath, html);
      console.log(`✅ Saved to: samples/${filename}`);
    } else {
      console.log('❌ Failed to dump DOM.');
    }
  }
}

function runDumpCommand(target) {
  return new Promise((resolve) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    
    // Recursive function to get full HTML including Shadow DOMs
    const code = `
      (function() {
        function getFullHTML(node) {
          if (node.nodeType === Node.TEXT_NODE) return node.textContent;
          if (node.nodeType !== Node.ELEMENT_NODE) return "";
          
          let html = "<" + node.tagName.toLowerCase();
          for (let i = 0; i < node.attributes.length; i++) {
            const attr = node.attributes[i];
            html += " " + attr.name + '="' + attr.value.replace(/"/g, '&quot;') + '"';
          }
          html += ">";
          
          if (node.shadowRoot) {
            html += "<shadow-root>";
            for (let i = 0; i < node.shadowRoot.childNodes.length; i++) {
              html += getFullHTML(node.shadowRoot.childNodes[i]);
            }
            html += "</shadow-root>";
          }
          
          for (let i = 0; i < node.childNodes.length; i++) {
            html += getFullHTML(node.childNodes[i]);
          }
          
          html += "</" + node.tagName.toLowerCase() + ">";
          return html;
        }
        return getFullHTML(document.documentElement);
      })()
    `;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression: code, returnByValue: true, maxStringLength: 10000000 }
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
    setTimeout(() => { ws.terminate(); resolve(null); }, 15000);
  });
}

dumpDom();
