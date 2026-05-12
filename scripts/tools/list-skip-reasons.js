/**
 * scripts/tools/list-skip-reasons.js
 * 
 * Display statistics of detection skip reasons from activity-log.json
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ACTIVITY_FILE = path.join(PROJECT_ROOT, 'logs', 'activity-log.json');

function main() {
  console.log('\x1b[36m======================================================\x1b[0m');
  console.log('\x1b[36m📊 THỐNG KÊ LÝ DO BỎ QUA (SKIP REASONS)\x1b[0m');
  console.log('\x1b[36m======================================================\x1b[0m');

  if (!fs.existsSync(ACTIVITY_FILE)) {
    console.log('   ❌ Chưa có dữ liệu thống kê (activity-log.json không tồn tại).');
    return;
  }

  let activity;
  try {
    activity = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf8'));
  } catch (e) {
    console.error(`   ❌ Lỗi đọc file activity: ${e.message}`);
    return;
  }

  const reasons = activity.skipReasons || {};
  const entries = Object.entries(reasons);

  if (entries.length === 0) {
    console.log('   ℹ️ Chưa có trường hợp nào bị bỏ qua được ghi nhận.');
    return;
  }

  // Phân loại
  const retryReasons = entries.filter(([k]) => k.startsWith('retry:'));
  const acceptReasons = entries.filter(([k]) => k.startsWith('accept:'));

  console.log('\n \x1b[1m🔄 AUTO RETRY SKIPS:\x1b[0m');
  if (retryReasons.length === 0) {
    console.log('   (Không có)');
  } else {
    displayTable(retryReasons);
  }

  console.log('\n \x1b[1m⚡ AUTO ACCEPT SKIPS:\x1b[0m');
  if (acceptReasons.length === 0) {
    console.log('   (Không có)');
  } else {
    displayTable(acceptReasons);
  }

  console.log('\x1b[36m------------------------------------------------------\x1b[0m');
}

function displayTable(items) {
  // Sort by count descending
  items.sort((a, b) => b[1] - a[1]);

  items.forEach(([key, count]) => {
    const reason = key.split(':')[1];
    let color = '';
    
    // Highlight important reasons
    if (reason.includes('rate_limit')) color = '\x1b[33m'; // Yellow
    else if (reason.includes('visibility_covered')) color = '\x1b[31m'; // Red
    else if (reason.includes('not_right_side')) color = '\x1b[2m'; // Dim
    
    const label = reason.padEnd(30, ' ');
    const countStr = count.toString().padStart(5, ' ');
    
    console.log(`   - ${color}${label}\x1b[0m : \x1b[1m${countStr}\x1b[0m lần`);
  });
}

main();
