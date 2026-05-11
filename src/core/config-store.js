const fs = require('fs');
const path = require('path');

class ConfigStore {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.load();
    this.watchCallbacks = [];
    this.setupWatcher();
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (e) {
      console.error(`[ConfigStore] Failed to load: ${e.message}`);
    }
    return { blacklist: [], autoAccept: true, autoRetry: true };
  }

  setupWatcher() {
    if (!fs.existsSync(this.configPath)) return;

    fs.watch(this.configPath, (event) => {
      if (event === 'change') {
        // Small delay to ensure file is written
        setTimeout(() => {
          this.config = this.load();
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
