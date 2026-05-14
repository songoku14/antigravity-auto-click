const fs = require('fs');
const path = require('path');

function getActivityLogPath() {
  return path.join(__dirname, '..', '..', 'activity-log.json');
}

function readActivityLog() {
  const logPath = getActivityLogPath();
  if (!fs.existsSync(logPath)) return [];

  const rawText = fs.readFileSync(logPath, 'utf8').trim();
  if (!rawText) return [];

  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function summarizeActivity(entries = readActivityLog()) {
  const summary = {
    total: entries.length,
    retryClicks: 0,
    acceptClicks: 0,
    byCategory: {}
  };

  for (const entry of entries) {
    const action = String(entry.action || '').toLowerCase();
    const category = entry.category || 'unknown';

    if (action.includes('retry')) summary.retryClicks += 1;
    if (action.includes('accept') || action.includes('click')) summary.acceptClicks += 1;

    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
  }

  return summary;
}

module.exports = {
  readActivityLog,
  summarizeActivity
};
