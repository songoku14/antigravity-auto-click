const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  blacklist: [],
  autoAccept: false,
  autoRetry: false,
  performClickAutoAccept: false
};

class ConfigStore {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.load(DEFAULT_CONFIG);
    this.watchCallbacks = [];
    this.setupWatcher();
  }

  load(fallbackConfig = this.config || DEFAULT_CONFIG) {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (e) {
      console.error(`[ConfigStore] Failed to load: ${e.message}`);
    }
    return fallbackConfig;
  }

  setupWatcher() {
    if (!fs.existsSync(this.configPath)) return;

    fs.watch(this.configPath, (event) => {
      if (event === 'change') {
        // Small delay to ensure file is written
        setTimeout(() => {
          this.config = this.load(this.config);
          console.log(`[AutoRetry] [ConfigStore] Config reloaded from ${this.configPath}`);
          this.watchCallbacks.forEach(cb => cb(this.config));
        }, 500);
      }
    });
  }

  onConfigChange(cb) {
    this.watchCallbacks.push(cb);
  }

  get() {
    return this.config;
  }
}

module.exports = ConfigStore;
