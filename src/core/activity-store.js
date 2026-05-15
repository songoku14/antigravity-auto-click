const fs = require('fs');
const path = require('path');

const CATEGORY_KEY_RE = /^[a-z0-9_-]+$/i;
const SKIP_REASON_RE = /^[a-z0-9_:-]+$/i;

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
        const skipReasons = parsed.skipReasons || {};
        const retrySkipped = Object.entries(skipReasons)
          .filter(([key]) => key.startsWith('retry:'))
          .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
        const acceptSkipped = Object.entries(skipReasons)
          .filter(([key]) => key.startsWith('accept:'))
          .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
        // Merge with initial to ensure all fields exist
        return {
          ...activity,
          ...parsed,
          accept: {
            ...activity.accept,
            ...(parsed.accept || {}),
            skipped: parsed.accept?.skipped ?? acceptSkipped,
            candidates: parsed.accept?.candidates ?? ((parsed.accept?.detected || 0) + acceptSkipped),
            clickedByCategory: this._sanitizeCategoryMap(parsed.accept?.clickedByCategory),
            detectedByCategory: this._sanitizeCategoryMap(parsed.accept?.detectedByCategory),
            clickedByButton: parsed.accept?.clickedByButton || {}
          },
          retry: {
            ...activity.retry,
            ...(parsed.retry || {}),
            skipped: parsed.retry?.skipped ?? retrySkipped,
            candidates: parsed.retry?.candidates ?? ((parsed.retry?.detected || 0) + retrySkipped),
            clickedByCategory: this._sanitizeCategoryMap(parsed.retry?.clickedByCategory),
            detectedByCategory: this._sanitizeCategoryMap(parsed.retry?.detectedByCategory),
            clickedByButton: parsed.retry?.clickedByButton || {}
          },
          skipReasons
        };
      }
    } catch (e) {
      console.error(`[ActivityStore] Failed to load: ${e.message}`);
    }
    return activity;
  }

  _getInitialActivity() {
    return {
      retry: { candidates: 0, skipped: 0, detected: 0, clicked: 0, clickedByCategory: {}, detectedByCategory: {}, clickedByButton: {} },
      accept: { candidates: 0, skipped: 0, detected: 0, clicked: 0, blocked: 0, clickedByCategory: {}, detectedByCategory: {}, clickedByButton: {} },
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

    const skipMatch = text.match(/\[STAT\] (RETRY|ACCEPT)_SKIPPED: ([a-z0-9_:-]+)/i);
    if (skipMatch) {
      const type = skipMatch[1].toLowerCase();
      const reason = String(skipMatch[2]).toLowerCase();
      const key = `${type}:${reason}`;

      if (SKIP_REASON_RE.test(reason)) {
        activity[type].candidates++;
        activity[type].skipped++;
        if (!activity.skipReasons) activity.skipReasons = {};
        activity.skipReasons[key] = (activity.skipReasons[key] || 0) + 1;
        changed = true;
      }
    }

    if (text.includes('RETRY_DETECTED')) {
      activity.retry.candidates++;
      activity.retry.detected++;
      const cat = this._extractCategory(text, 'RETRY_DETECTED');
      if (cat) {
        if (!activity.retry.detectedByCategory) activity.retry.detectedByCategory = {};
        activity.retry.detectedByCategory[cat] = (activity.retry.detectedByCategory[cat] || 0) + 1;
      }
      changed = true;
    } else if (text.includes('RETRY_CLICKED')) {
      activity.retry.clicked++;
      const cat = this._extractCategory(text, 'RETRY_CLICKED');
      if (cat) {
        if (!activity.retry.clickedByCategory) activity.retry.clickedByCategory = {};
        activity.retry.clickedByCategory[cat] = (activity.retry.clickedByCategory[cat] || 0) + 1;
      }
      const button = this._extractButton(text);
      if (button) {
        if (!activity.retry.clickedByButton) activity.retry.clickedByButton = {};
        activity.retry.clickedByButton[button] = (activity.retry.clickedByButton[button] || 0) + 1;
      }
      changed = true;
    } else if (text.includes('ACCEPT_DETECTED')) {
      activity.accept.candidates++;
      activity.accept.detected++;
      const cat = this._extractCategory(text, 'ACCEPT_DETECTED');
      if (cat) {
        if (!activity.accept.detectedByCategory) activity.accept.detectedByCategory = {};
        activity.accept.detectedByCategory[cat] = (activity.accept.detectedByCategory[cat] || 0) + 1;
      }
      changed = true;
    } else if (text.includes('ACCEPT_CLICKED')) {
      activity.accept.clicked++;
      const cat = this._extractCategory(text, 'ACCEPT_CLICKED');
      if (cat) {
        if (!activity.accept.clickedByCategory) activity.accept.clickedByCategory = {};
        activity.accept.clickedByCategory[cat] = (activity.accept.clickedByCategory[cat] || 0) + 1;
      }
      const button = this._extractButton(text);
      if (button) {
        if (!activity.accept.clickedByButton) activity.accept.clickedByButton = {};
        activity.accept.clickedByButton[button] = (activity.accept.clickedByButton[button] || 0) + 1;
      }
      changed = true;
    } else if (text.match(/\[STAT\] ACCEPT_BLOCKED(?::[a-z0-9_-]+)?/i)) {
      activity.accept.blocked++;
      changed = true;
    }

    if (changed) {
      this.save(activity);
    }
    return changed;
  }

  _extractCategory(text, eventName) {
    const match = text.match(new RegExp(`\\[STAT\\] ${eventName}:([a-z0-9_-]+)`, 'i'));
    if (!match) return null;
    const category = String(match[1]).toLowerCase();
    return CATEGORY_KEY_RE.test(category) ? category : null;
  }

  _extractButton(text) {
    const match = text.match(/button=([^ ]+)/i);
    return match ? match[1] : null;
  }

  _sanitizeCategoryMap(categoryMap) {
    if (!categoryMap || typeof categoryMap !== 'object') return {};
    return Object.fromEntries(
      Object.entries(categoryMap)
        .map(([key, count]) => [String(key).toLowerCase(), Number(count) || 0])
        .filter(([key, count]) => CATEGORY_KEY_RE.test(key) && count > 0)
    );
  }
}

module.exports = ActivityStore;
