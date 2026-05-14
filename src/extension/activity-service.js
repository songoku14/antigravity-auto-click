const fs = require('fs');
const path = require('path');

function getActivityLogPath() {
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

function summarizeActivity(data = readActivityLog()) {
  const summary = {
    total: 0,
    retryClicks: 0,
    acceptClicks: 0,
    byCategory: {
      terminal: 0,
      reviewChange: 0,
      systemReview: 0
    },
    skipReasons: {}
  };

  if (!data) return summary;

  summary.retryClicks = data.retry?.clicked || 0;
  summary.acceptClicks = data.accept?.clicked || 0;
  summary.total = summary.retryClicks + summary.acceptClicks;
  
  // Normalize categories
  const rawCategories = data.accept?.clickedByCategory || {};
  for (const [key, value] of Object.entries(rawCategories)) {
    const normalizedKey = key.toLowerCase() === 'reviewchange' ? 'reviewChange' :
                         key.toLowerCase() === 'systemreview' ? 'systemReview' :
                         key.toLowerCase() === 'terminal' ? 'terminal' : key;
    
    if (summary.byCategory[normalizedKey] !== undefined) {
      summary.byCategory[normalizedKey] += value;
    } else {
      summary.byCategory[normalizedKey] = value;
    }
  }

  summary.skipReasons = data.skipReasons || {};

  return summary;
}

module.exports = {
  readActivityLog,
  summarizeActivity
};
