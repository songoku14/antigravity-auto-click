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
    byCategory: {},
    skipReasons: {}
  };

  if (!data) return summary;

  summary.retryClicks = data.retry?.clicked || 0;
  summary.acceptClicks = data.accept?.clicked || 0;
  summary.total = summary.retryClicks + summary.acceptClicks;
  summary.byCategory = data.accept?.clickedByCategory || {};
  summary.skipReasons = data.skipReasons || {};

  return summary;
}

module.exports = {
  readActivityLog,
  summarizeActivity
};
