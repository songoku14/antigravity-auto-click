const fs = require('fs');
const path = require('path');

class ActivityStore {
  constructor(logsDir) {
    this.logsDir = logsDir;
    this.activityFile = path.join(logsDir, 'activity-log.json');
    this.oldActivityFile = path.join(logsDir, '..', 'activity-log.json');
    
    this.ensureDirectory();
    this.migrateIfNeeded();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  migrateIfNeeded() {
    // If new file doesn't exist but old one does, migrate it
    if (!fs.existsSync(this.activityFile) && fs.existsSync(this.oldActivityFile)) {
      try {
        console.log(`[ActivityStore] Migrating legacy activity log from ${this.oldActivityFile}`);
        fs.copyFileSync(this.oldActivityFile, this.activityFile);
        // We keep the old file for now to avoid breaking other things until we're sure
      } catch (e) {
        console.error(`[ActivityStore] Migration failed: ${e.message}`);
      }
    }
  }
  load() {
    const activity = this._getInitialActivity();
    try {
      if (fs.existsSync(this.activityFile)) {
        const data = fs.readFileSync(this.activityFile, 'utf8');
        const parsed = JSON.parse(data);
        // Merge with initial to ensure all fields exist
        return {
          ...activity,
          ...parsed,
          retry: { ...activity.retry, ...(parsed.retry || {}) },
          accept: { ...activity.accept, ...(parsed.accept || {}) },
          skipReasons: parsed.skipReasons || {}
        };
      }
    } catch (e) {
      console.error(`[ActivityStore] Failed to load: ${e.message}`);
    }
    return activity;
  }

  _getInitialActivity() {
    return {
      retry: { detected: 0, clicked: 0 },
      accept: { detected: 0, clicked: 0, blocked: 0 },
      skipReasons: {}
    };
  }

  save(activity) {
    try {
      fs.writeFileSync(this.activityFile, JSON.stringify(activity, null, 2));
    } catch (e) {
      console.error(`[ActivityStore] Failed to save: ${e.message}`);
    }
  }

  update(text) {
    const activity = this.load();
    let changed = false;

    if (text.includes('RETRY_DETECTED')) {
      activity.retry.detected++;
      changed = true;
    } else if (text.includes('RETRY_CLICKED')) {
      activity.retry.clicked++;
      changed = true;
    } else if (text.includes('ACCEPT_DETECTED')) {
      activity.accept.detected++;
      changed = true;
    } else if (text.includes('ACCEPT_CLICKED')) {
      activity.accept.clicked++;
      changed = true;
    } else if (text.includes('ACCEPT_BLOCKED')) {
      activity.accept.blocked++;
      changed = true;
    }

    // Handle skip reasons: "[STAT] RETRY_SKIPPED: reason"
    const skipMatch = text.match(/\[STAT\] (RETRY|ACCEPT)_SKIPPED: ([\w_:]+)/);
    if (skipMatch) {
      const type = skipMatch[1].toLowerCase(); // retry or accept
      const reason = skipMatch[2];
      const key = `${type}:${reason}`;
      
      if (!activity.skipReasons) activity.skipReasons = {};
      activity.skipReasons[key] = (activity.skipReasons[key] || 0) + 1;
      changed = true;
    }

    if (changed) {
      this.save(activity);
    }
    return changed;
  }
}

module.exports = ActivityStore;
