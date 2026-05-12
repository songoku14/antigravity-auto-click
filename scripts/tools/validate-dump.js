/**
 * scripts/tools/validate-dump.js
 * 
 * Kiểm tra logic nhận diện nút bấm offline trên một file DOM dump cụ thể.
 * Giúp xác minh nhanh độ chính xác của regex trước khi đưa vào regression suite.
 */

const fs = require('fs');
const path = require('path');

function validate(filePath) {
  console.log(`\n🧪 Testing detection logic on: ${path.basename(filePath)}`);
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Check for "Accept all" text
  const hasText = content.includes('Accept all');
  console.log(`   - "Accept all" text present: ${hasText ? '✅' : '❌'}`);
  
  // 2. Simulate Shadow DOM traversal
  // Our dump uses <shadow-root> tags. We can count how many we have to traverse.
  const shadowCount = (content.match(/<shadow-root>/g) || []).length;
  console.log(`   - Shadow Roots to traverse: ${shadowCount}`);

  // 3. Find the specific button using regex that simulates our logic
  // We look for tags containing "Accept all" and having cursor-pointer or similar
  const buttonRegex = /<([a-z0-9]+)[^>]*class="[^"]*(cursor-pointer|bg-ide-button-background)[^"]*"[^>]*>([^<]*Accept all[^<]*)<\/\1>/gi;
  
  let match;
  let foundCount = 0;
  while ((match = buttonRegex.exec(content)) !== null) {
    foundCount++;
    console.log(`\n   ✅ FOUND MATCH #${foundCount}:`);
    console.log(`      Tag: ${match[1]}`);
    console.log(`      Text: "${match[3].trim()}"`);
    console.log(`      Snippet: ${match[0].substring(0, 100)}...`);
  }

  if (foundCount === 0) {
    // Try even more loose regex
    const looseRegex = /<([a-z0-9]+)[^>]*>([^<]*Accept all[^<]*)<\/\1>/gi;
    console.log('\n   ⚠️ No clickable buttons found with strict regex. Searching for any element with "Accept all"...');
    while ((match = looseRegex.exec(content)) !== null) {
      console.log(`      Found potential element: <${match[1]}> containing "${match[2].trim()}"`);
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`Kết luận: ${foundCount > 0 ? 'Hệ thống nhận diện TỐT' : 'Cần tinh chỉnh thêm bộ lọc'}`);
}

// Find latest implementation plan dump
const samplesDir = path.join(__dirname, '..', '..', 'samples');
const files = fs.readdirSync(samplesDir)
  .filter(f => f.startsWith('full_dom_antigravity_auto_click') && f.endsWith('.html'))
  .sort()
  .reverse();

if (files.length > 0) {
  validate(path.join(samplesDir, files[0]));
} else {
  console.log('❌ Không tìm thấy file dump nào.');
}
