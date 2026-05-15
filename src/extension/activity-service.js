const fs = require('fs');
const path = require('path');

let storagePath = null;

function initialize(p) {
  storagePath = p;
  const targetDir = path.join(storagePath, 'logs');
  const targetPath = path.join(targetDir, 'activity-log.json');
  const legacyDir = path.join(__dirname, '..', '..', 'logs');
  const legacyPath = path.join(legacyDir, 'activity-log.json');

  // Migration: If target doesn't exist but legacy does, copy it
  if (!fs.existsSync(targetPath) && fs.existsSync(legacyPath)) {
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(legacyPath, targetPath);
    } catch (e) {
      console.error(`[ActivityService] Migration failed: ${e.message}`);
    }
  }
}

function getActivityLogPath() {
  if (storagePath) {
    return path.join(storagePath, 'logs', 'activity-log.json');
  }
  return path.join(__dirname, '..', '..', 'logs', 'activity-log.json');
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

function summarizeActivity(data) {
  // If no data provided and we have a cache, use it to avoid disk I/O
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

  if (!logData) {
    cachedSummary = summary;
    return summary;
  }

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
      summary.byCategory[normalizedKey] += value;
    } else {
      summary.byCategory[normalizedKey] = value;
    }
  }

  // Normalize categories for Retry
  const rawRetryCategories = logData.retry?.clickedByCategory || {};
  for (const [key, value] of Object.entries(rawRetryCategories)) {
    const normalizedKey = key.toLowerCase() === 'reviewchange' ? 'reviewChange' :
                         key.toLowerCase() === 'systemreview' ? 'systemReview' :
                         key.toLowerCase() === 'terminal' ? 'terminal' : key;
    
    if (summary.retryByCategory[normalizedKey] !== undefined) {
      summary.retryByCategory[normalizedKey] += value;
    } else {
      summary.retryByCategory[normalizedKey] = value;
    }
  }

  summary.skipReasons = logData.skipReasons || {};

  // Merge button stats
  const retryButtons = logData.retry?.clickedByButton || {};
  const acceptButtons = logData.accept?.clickedByButton || {};
  
  for (const [btn, count] of Object.entries(retryButtons)) {
    summary.byButton[btn] = (summary.byButton[btn] || 0) + count;
  }
  for (const [btn, count] of Object.entries(acceptButtons)) {
    summary.byButton[btn] = (summary.byButton[btn] || 0) + count;
  }

  cachedSummary = summary;
  return summary;
}

function resetActivity(targetPath = getActivityLogPath()) {
  const initial = {
    retry: { candidates: 0, skipped: 0, detected: 0, clicked: 0, clickedByButton: {} },
    accept: { candidates: 0, skipped: 0, detected: 0, clicked: 0, blocked: 0, clickedByCategory: {}, detectedByCategory: {}, clickedByButton: {} },
    skipReasons: {}
  };
  fs.writeFileSync(targetPath, JSON.stringify(initial, null, 2));
  cachedSummary = summarizeActivity(initial);
  return initial;
}

module.exports = {
  initialize,
  readActivityLog,
  summarizeActivity,
  resetActivity
};
