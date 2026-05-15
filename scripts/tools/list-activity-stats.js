/**
 * scripts/tools/list-activity-stats.js
 *
 * Thống kê hoạt động tổng hợp:
 * - Retry / Accept counts
 * - Skip reasons cho cả Retry và Accept
 * - Chi tiết Auto-Accept theo category
 */

const fs = require('fs');
const { getStoragePaths } = require('../../src/core/storage-paths');

const ACTIVITY_FILE = getStoragePaths().activityLogPath;

function padText(text, width, align = 'left') {
  const str = String(text);
  if (str.length > width) {
    return width > 3 ? `${str.slice(0, width - 3)}...` : str.slice(0, width);
  }
  const pad = Math.max(0, width - str.length);
  if (pad === 0) return str;
  return align === 'right' ? `${' '.repeat(pad)}${str}` : `${str}${' '.repeat(pad)}`;
}

function color(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function sectionTitle(text, code = '36') {
  console.log(color('======================================================', code));
  console.log(color(text, code));
  console.log(color('======================================================', code));
}

function printRatioTable(items, total, reasonWidth = 30) {
  if (items.length === 0) {
    console.log('   (Không có)');
    return;
  }

  console.log('   ┌────────────────────────────────┬──────────┬──────────┐');
  console.log('   │ ' + padText('REASON', reasonWidth) + ' │ ' + padText('COUNT', 8, 'right') + ' │ ' + padText('SHARE', 8, 'right') + ' │');
  console.log('   ├────────────────────────────────┼──────────┼──────────┤');

  items
    .slice()
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
      const reason = key.split(':')[1] || key;
      let colorCode = '37';
      if (reason.includes('rate_limit')) colorCode = '33';
      else if (reason.includes('visibility_covered')) colorCode = '31';
      else if (reason.includes('not_right_side')) colorCode = '2';

      const countNum = Number(count) || 0;
      const pct = total > 0 ? ((countNum / total) * 100).toFixed(1) : '0.0';

      console.log(
        `   │ ${color(padText(reason, reasonWidth), colorCode)} │ ${color(padText(countNum, 8, 'right'), '1')} │ ${color(padText(`${pct}%`, 8, 'right'), '2')} │`
      );
    });

  console.log('   └────────────────────────────────┴──────────┴──────────┘');
}

function printCategoryTable(entries, totalClicked) {
  if (entries.length === 0) {
    console.log('   ℹ️ Đã nhận diện nhưng chưa có click Auto-Accept thực tế.');
    return;
  }

  console.log('   ┌────────────────┬──────────┬──────────┐');
  console.log('   │ ' + padText('CATEGORY', 14) + ' │ ' + padText('CLICKS', 8, 'right') + ' │ ' + padText('SHARE', 8, 'right') + ' │');
  console.log('   ├────────────────┼──────────┼──────────┤');

  entries
    .slice()
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      let colorCode = '37';
      if (cat === 'terminal') colorCode = '36';
      else if (cat === 'review') colorCode = '33';
      else if (cat === 'system') colorCode = '35';

      const normalizedCount = Number(count) || 0;
      const pct = totalClicked > 0 ? ((normalizedCount / totalClicked) * 100).toFixed(1) : '0.0';

      let displayName = cat.toUpperCase();
      if (cat === 'review' || cat === 'system' || cat === 'systemreview') displayName = 'SYSTEM REVIEW';
      else if (cat === 'reviewchange') displayName = 'REVIEW CHANGE';

      console.log(
        `   │ ${color(padText(displayName, 14), colorCode)} │ ${color(padText(normalizedCount, 8, 'right'), '1')} │ ${color(padText(`${pct}%`, 8, 'right'), '2')} │`
      );
    });

  console.log('   └────────────────┴──────────┴──────────┘');
}

function main() {
  sectionTitle('📊 THỐNG KÊ', '36');

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
  const retryReasons = entries.filter(([key]) => key.startsWith('retry:'));
  const acceptReasons = entries.filter(([key]) => key.startsWith('accept:'));

  const retrySkippedFromReasons = retryReasons.reduce((sum, [, count]) => sum + (Number(count) || 0), 0);
  const acceptSkippedFromReasons = acceptReasons.reduce((sum, [, count]) => sum + (Number(count) || 0), 0);

  const retryDetected = Number(activity.retry?.detected || 0);
  const retryClicked = Number(activity.retry?.clicked || 0);
  const acceptDetected = Number(activity.accept?.detected || 0);
  const acceptClicked = Number(activity.accept?.clicked || 0);
  const acceptBlocked = Number(activity.accept?.blocked || 0);

  const retrySkipped = Number(activity.retry?.skipped ?? retrySkippedFromReasons);
  const acceptSkipped = Number(activity.accept?.skipped ?? acceptSkippedFromReasons);
  const retryCandidates = Number(activity.retry?.candidates ?? (retryDetected + retrySkipped));
  const acceptCandidates = Number(activity.accept?.candidates ?? (acceptDetected + acceptSkipped));

  console.log('   📈 BẢNG THỐNG KÊ HOẠT ĐỘNG:');
  console.log('   ┌────────┬──────────┬────────┬─────────┬────────┬───────────┐');
  console.log('   │ Loại   │ Ứng viên │ Skip   │ Qua lọc │ Click  │ Blacklist │');
  console.log('   ├────────┼──────────┼────────┼─────────┼────────┼───────────┤');
  console.log(
    `   │ ${padText('Retry', 6)} │ ${color(padText(retryCandidates, 8, 'right'), '1')} │ ${color(padText(retrySkipped, 6, 'right'), '33')} │ ${color(padText(retryDetected, 7, 'right'), '36')} │ ${color(padText(retryClicked, 6, 'right'), '32')} │ ${padText('', 9)} │`
  );
  console.log(
    `   │ ${padText('Accept', 6)} │ ${color(padText(acceptCandidates, 8, 'right'), '1')} │ ${color(padText(acceptSkipped, 6, 'right'), '33')} │ ${color(padText(acceptDetected, 7, 'right'), '36')} │ ${color(padText(acceptClicked, 6, 'right'), '32')} │ ${color(padText(acceptBlocked, 9, 'right'), '31')} │`
  );
  console.log('   └────────┴──────────┴────────┴─────────┴────────┴───────────┘');

  console.log('\n   📊 AUTO ACCEPT THEO CATEGORY:');
  const acceptData = activity.accept || {};
  const clickedByCategory = acceptData.clickedByCategory || {};
  const totalDetected = Number(acceptData.detected || 0);
  const totalClicked = Number(acceptData.clicked || 0);
  const invalidCategoryClicks = Object.entries(clickedByCategory)
    .filter(([cat, count]) => !/^[a-z0-9_-]+$/i.test(cat) && Number(count) > 0)
    .reduce((sum, [, count]) => sum + (Number(count) || 0), 0);

  console.log(`   Tổng số nhận diện (Qua lọc): \x1b[1m\x1b[36m${totalDetected}\x1b[0m`);
  console.log(`   Tổng số Click thực tế     : \x1b[1m\x1b[32m${totalClicked}\x1b[0m\n`);

  const categoryEntries = Object.entries(clickedByCategory)
    .filter(([cat, count]) => /^[a-z0-9_-]+$/i.test(cat) && Number(count) > 0);

  if (categoryEntries.length > 0) {
    printCategoryTable(categoryEntries, totalClicked);
  } else {
    if (totalClicked > 0) {
      console.log('   ℹ️ Đã click nhưng chưa phân loại được category.');
    } else {
      console.log('   ℹ️ Chưa có dữ liệu nào cho Auto-Accept.');
    }
  }

  if (invalidCategoryClicks > 0) {
    console.log(`\n   ⚠️ Bỏ qua \x1b[33m${invalidCategoryClicks}\x1b[0m click category lỗi từ dữ liệu cũ.`);
  }

  console.log('\n   🔄 AUTO RETRY SKIPS:');
  console.log(`   Tổng skip: \x1b[1m${retrySkipped}\x1b[0m / Ứng viên: \x1b[1m${retryCandidates}\x1b[0m`);
  printRatioTable(retryReasons, retrySkipped);

  console.log('\n   ⚡ AUTO ACCEPT SKIPS:');
  console.log(`   Tổng skip: \x1b[1m${acceptSkipped}\x1b[0m / Ứng viên: \x1b[1m${acceptCandidates}\x1b[0m`);
  printRatioTable(acceptReasons, acceptSkipped);

  console.log(color('\n------------------------------------------------------', '32'));
}

main();
