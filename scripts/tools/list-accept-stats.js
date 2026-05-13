/**
 * scripts/tools/list-accept-stats.js
 * 
 * Thống kê chi tiết số lượng click thực tế (Auto-Accept) theo từng
 * category từ file activity-log.json.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const ACTIVITY_FILE = path.join(PROJECT_ROOT, 'logs', 'activity-log.json');

function main() {
  console.log('\x1b[32m======================================================\x1b[0m');
  console.log('\x1b[32m📊 THỐNG KÊ CHI TIẾT AUTO-ACCEPT (BY CATEGORY)\x1b[0m');
  console.log('\x1b[32m======================================================\x1b[0m');

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

  const acceptData = activity.accept || {};
  const clickedByCategory = acceptData.clickedByCategory || {};
  const totalDetected = acceptData.detected || 0;
  const totalClicked = acceptData.clicked || 0;
  const invalidCategoryClicks = Object.entries(clickedByCategory)
    .filter(([cat, count]) => !/^[a-z0-9_-]+$/i.test(cat) && Number(count) > 0)
    .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);

  console.log(`\n   Tổng số nhận diện (Qua lọc): \x1b[1m\x1b[36m${totalDetected}\x1b[0m`);
  console.log(`   Tổng số Click thực tế     : \x1b[1m\x1b[32m${totalClicked}\x1b[0m\n`);

  const entries = Object.entries(clickedByCategory)
    .filter(([cat, count]) => /^[a-z0-9_-]+$/i.test(cat) && Number(count) > 0);

  if (entries.length === 0) {
    if (totalClicked > 0) {
      console.log('   ℹ️ Đã click nhưng chưa phân loại được category.');
    } else if (totalDetected > 0) {
      console.log('   ℹ️ Đã nhận diện nhưng chưa có click Auto-Accept thực tế.');
    } else {
      console.log('   ℹ️ Chưa có dữ liệu nào cho Auto-Accept.');
    }
    console.log('\x1b[32m------------------------------------------------------\x1b[0m');
    return;
  }

  // Sort by count descending
  entries.sort((a, b) => b[1] - a[1]);

  console.log('   \x1b[1mPHÂN LOẠI CHI TIẾT (CLICK THỰC TẾ):\x1b[0m');
  console.log('   ------------------------------------------------------');
  
  entries.forEach(([cat, count]) => {
    let color = '';
    let label = cat.toUpperCase();
    
    // Aesthetic colors for different categories
    if (cat === 'terminal') color = '\x1b[36m'; // Cyan
    else if (cat === 'review') color = '\x1b[33m';   // Yellow
    else if (cat === 'system') color = '\x1b[35m';   // Magenta
    else color = '\x1b[37m'; // White
    
    const countStr = count.toString().padStart(5, ' ');
    const pct = totalClicked > 0 ? ((count / totalClicked) * 100).toFixed(1) : '0.0';
    
    const paddedLabel = label.padEnd(15, ' ');
    console.log(`   - ${color}${paddedLabel}\x1b[0m : \x1b[1m${countStr}\x1b[0m lượt (${pct}%)`);
  });

  if (invalidCategoryClicks > 0) {
    console.log(`\n   ⚠️ Bỏ qua \x1b[33m${invalidCategoryClicks}\x1b[0m click category lỗi từ dữ liệu cũ.`);
  }

  console.log('\x1b[32m------------------------------------------------------\x1b[0m');
}

main();
