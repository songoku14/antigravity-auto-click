const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG, normalizeConfig } = require('./config-schema');

class ConfigStore {
  constructor(configPath) {
    this.configPath = configPath;
    this.configDir = path.dirname(configPath);
    this.configFileName = path.basename(configPath);
    this.config = this.load(DEFAULT_CONFIG);
    this.watchCallbacks = [];
    this.reloadTimer = null;
    this.watcher = null;
    this.setupWatcher();
  }

  load(fallbackConfig = this.config || DEFAULT_CONFIG) {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return normalizeConfig(JSON.parse(data));
      }
    } catch (e) {
      console.error(`[ConfigStore] Failed to load: ${e.message}`);
    }
    return fallbackConfig;
  }

  setupWatcher() {
    if (!fs.existsSync(this.configDir)) return;

    this.watcher = fs.watch(this.configDir, (_event, filename) => {
      if (filename && filename !== this.configFileName) return;
      this.scheduleReload();
    });
    this.watcher.on('error', (err) => {
      console.error(`[ConfigStore] Watcher error: ${err.message}`);
    });
  }

  scheduleReload() {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    // Debounce to let mv/write complete before re-reading.
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      const nextConfig = this.load(this.config);
      this.config = nextConfig;
      console.log(`[AutoRetry] [ConfigStore] Config reloaded from ${this.configPath}`);
      this.watchCallbacks.forEach(cb => cb(this.config));
    }, 300);
  }

  onConfigChange(cb) {
    this.watchCallbacks.push(cb);
  }

  get() {
    return this.config;
  }
}

module.exports = ConfigStore;
