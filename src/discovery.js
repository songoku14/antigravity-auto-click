/**
 * discovery.js - Auto-detect Antigravity's CDP (Chrome DevTools Protocol) port
 * 
 * Antigravity (Electron app) chạy với --remote-debugging-port=XXXXX
 * Module này tìm port đó từ running process và lấy danh sách targets.
 */

const { execSync } = require('child_process');
const http = require('http');

/**
 * Tìm CDP port từ process đang chạy
 * @returns {number|null} Port number hoặc null
 */
function findCDPPort() {
  try {
    const output = execSync(
      `ps aux | grep -i "Antigravity.app/Contents/MacOS/Electron" | grep -v grep | grep -oE '\\-\\-remote-debugging-port=[0-9]+'`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    const match = output.match(/--remote-debugging-port=(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } catch (e) {
    // Process not found or grep failed
  }
  return null;
}

/**
 * Kiểm tra Antigravity có đang chạy không
 * @returns {boolean}
 */
function isAntigravityRunning() {
  try {
    // pgrep doesn't work reliably for long macOS app paths, use ps aux instead
    const output = execSync(
      `ps aux | grep "Antigravity.app/Contents/MacOS/Electron" | grep -v grep`,
      { encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    return output.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Lấy danh sách CDP targets từ endpoint
 * @param {number} port - CDP port
 * @returns {Promise<Array>} Danh sách targets
 */
function getTargets(port) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}/json`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse CDP targets: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Failed to connect to CDP on port ${port}: ${e.message}`));
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`CDP connection timeout on port ${port}`));
    });
  });
}

/**
 * Lọc ra các page targets cần inject (Workbench + Launchpad)
 * @param {Array} targets - Danh sách tất cả targets
 * @returns {Array} Filtered targets (chỉ pages)
 */
function filterPageTargets(targets) {
  return targets.filter(t => 
    t.type === 'page' && 
    t.webSocketDebuggerUrl &&
    // Chỉ lấy workbench pages, bỏ qua webview iframes
    (t.url?.includes('workbench') || t.title === 'Launchpad' || t.title === 'Antigravity')
  );
}

module.exports = {
  findCDPPort,
  isAntigravityRunning,
  getTargets,
  filterPageTargets
};
