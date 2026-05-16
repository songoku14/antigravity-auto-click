const fs = require('fs');
const path = require('path');
const {
  getLegacyActivityLogPaths,
  getStoragePaths
} = require('../core/storage-paths');

let storagePath = null;

function initialize(p) {
  storagePath = getStoragePaths().storageDir;
  const targetDir = getStoragePaths(storagePath).logsDir;
  const targetPath = getActivityLogPath();
  const legacyPaths = getLegacyActivityLogPaths(p ? [p] : []);

  if (!fs.existsSync(targetPath)) {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const legacyPath = legacyPaths.find((candidate) => fs.existsSync(candidate));
      if (legacyPath) {
        fs.copyFileSync(legacyPath, targetPath);
      }
    } catch (e) {
      console.error(`[ActivityService] Migration failed: ${e.message}`);
    }
  }
}

function getActivityLogPath() {
  return getStoragePaths(storagePath || undefined).activityLogPath;
}

function readActivityLog() {
  const logPath = getActivityLogPath();
  if (!fs.existsSync(logPath)) return null;

  const rawText = fs.readFileSync(logPath, 'utf8').trim();
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch (error) {
    return null;
  }
}

let cachedSummary = null;

function summarizeActivity(data, forceRefresh = false) {
  if (forceRefresh === true) {
    cachedSummary = null;
  }

  // If no data provided and we have a cache, use it to avoid disk I/O
  // IMPORTANT: We only use cache if data is explicitly undefined
  if (data === undefined && cachedSummary !== null) {
    return cachedSummary;
  }

  const logData = data === undefined ? readActivityLog() : data;

  const summary = {
    total: 0,
    retryClicks: 0,
    acceptClicks: 0,
    byCategory: {
      terminal: 0,
      reviewChange: 0,
      systemReview: 0
    },
    retryByCategory: {
      terminal: 0,
      reviewChange: 0,
      systemReview: 0
    },
    byButton: {},
    skipReasons: {}
  };

  if (!logData || typeof logData !== 'object') {
    // If we failed to read data, return the cache if we have one
    // to avoid flickering to 0 during daemon write locks.
    if (cachedSummary !== null) {
      return cachedSummary;
    }
    // Only return empty summary if we have absolutely no data yet
    cachedSummary = summary;
    return summary;
  }

  try {
    summary.retryClicks = logData.retry?.clicked || 0;
    summary.acceptClicks = logData.accept?.clicked || 0;
    summary.total = summary.retryClicks + summary.acceptClicks;
    
    // Normalize categories for Accept
    const rawAcceptCategories = logData.accept?.clickedByCategory || {};
    for (const [key, value] of Object.entries(rawAcceptCategories)) {
      const normalizedKey = key.toLowerCase() === 'reviewchange' ? 'reviewChange' :
                           key.toLowerCase() === 'systemreview' ? 'systemReview' :
                           key.toLowerCase() === 'terminal' ? 'terminal' : key;
      
      if (summary.byCategory[normalizedKey] !== undefined) {
        summary.byCategory[normalizedKey] += (Number(value) || 0);
      } else {
        summary.byCategory[normalizedKey] = (Number(value) || 0);
      }
    }

    // Normalize categories for Retry
    const rawRetryCategories = logData.retry?.clickedByCategory || {};
    for (const [key, value] of Object.entries(rawRetryCategories)) {
      const normalizedKey = key.toLowerCase() === 'reviewchange' ? 'reviewChange' :
                           key.toLowerCase() === 'systemreview' ? 'systemReview' :
                           key.toLowerCase() === 'terminal' ? 'terminal' : key;
      
      if (summary.retryByCategory[normalizedKey] !== undefined) {
        summary.retryByCategory[normalizedKey] += (Number(value) || 0);
      } else {
        summary.retryByCategory[normalizedKey] = (Number(value) || 0);
      }
    }

    summary.skipReasons = logData.skipReasons || {};
    
    // Merge button stats
    const retryButtons = logData.retry?.clickedByButton || {};
    const acceptButtons = logData.accept?.clickedByButton || {};
    
    for (const [btn, count] of Object.entries(retryButtons)) {
      summary.byButton[btn] = (summary.byButton[btn] || 0) + (Number(count) || 0);
    }
    for (const [btn, count] of Object.entries(acceptButtons)) {
      summary.byButton[btn] = (summary.byButton[btn] || 0) + (Number(count) || 0);
    }

    cachedSummary = summary;
  } catch (err) {
    console.error(`[ActivityService] Error summarizing activity: ${err.message}`);
    // If we have a cache, fallback to it
    if (cachedSummary !== null) return cachedSummary;
  }

  return summary;
}

function resetActivity(targetPath = getActivityLogPath()) {
  const initial = {
    retry: { candidates: 0, skipped: 0, detected: 0, clicked: 0, clickedByButton: {} },
    accept: { candidates: 0, skipped: 0, detected: 0, clicked: 0, blocked: 0, clickedByCategory: {}, detectedByCategory: {}, clickedByButton: {} },
    skipReasons: {}
  };
  
  const logsDir = path.dirname(targetPath);
  fs.mkdirSync(logsDir, { recursive: true });
  
  // Reset activity-log.json
  fs.writeFileSync(targetPath, JSON.stringify(initial, null, 2));
  
  // Clear other logs in the same directory (like daemon.log)
  try {
    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      if (filePath !== targetPath && fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (e) {
    console.error(`[ActivityService] Failed to clear logs: ${e.message}`);
  }

  cachedSummary = summarizeActivity(initial);
  return initial;
}

module.exports = {
  initialize,
  readActivityLog,
  summarizeActivity,
  resetActivity,
  getActivityLogPath
};
