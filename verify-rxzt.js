// 验证脚本：解析 RXZT.html 中的内联 <script>，做语法检查与结构断言
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, 'public/webhqchart.demo/demo/RXZT.html');
const html = fs.readFileSync(file, 'utf8');

// 提取所有没有 src 属性的内联 script 块
const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0, errors = 0;

while ((m = scriptRe.exec(html)) !== null) {
  const attrs = m[1] || '';
  const code = m[2] || '';
  if (/\bsrc\s*=/.test(attrs)) continue; // 跳过外部脚本
  if (!code.trim()) continue;
  idx++;
  try {
    // 用 Script 编译做语法检查（不执行）
    new vm.Script(code, { filename: `inline-script-${idx}.js` });
    console.log(`[OK]  内联脚本块 #${idx} 语法通过 (${code.length} 字符)`);
  } catch (e) {
    errors++;
    console.error(`[FAIL] 内联脚本块 #${idx} 语法错误: ${e.message}`);
  }
}

// 结构断言
function assert(cond, msg) {
  if (cond) {
    console.log(`[OK]  ${msg}`);
  } else {
    errors++;
    console.error(`[FAIL] ${msg}`);
  }
}

// 1. 不应再存在错误的赋值写法
assert(!/this\.GetCustomVariantData\s*\([^)]*\)\s*=/.test(html),
  '不存在 "this.GetCustomVariantData(...) =" 的非法赋值');

// 2. JSSymbolData 分支应恰好出现一次
const jsSymCount = (html.match(/'JSSymbolData::GetCustomVariantData'/g) || []).length;
assert(jsSymCount === 1, `JSSymbolData 分支只出现一次 (实际 ${jsSymCount})`);

// 3. JSSymbolData 分支内应包含 data.PreventDefault 与 callback(hqchartData)
assert(/JSSymbolData::GetCustomVariantData'\)\s*\{[\s\S]*?data\.PreventDefault\s*=\s*true[\s\S]*?callback\(hqchartData\)/.test(html),
  'JSSymbolData 分支包含 PreventDefault 与 callback(hqchartData)');

// 4. REQUEST_INTERVAL 应为 250
assert(/var\s+REQUEST_INTERVAL\s*=\s*250\b/.test(html), 'REQUEST_INTERVAL = 250');

// 5. finish() 不应包含去重逻辑（方案A：实测腾讯分页无重复，不加去重）
assert(!/function\s+finish\s*\(\)\s*\{[\s\S]*?var\s+seen\s*=/.test(html),
  'finish() 不包含去重逻辑（方案A）');

// 6. APIScriptIndex 块仍然保留（未被破坏）
assert(/'APIScriptIndex::ExecuteScript'/.test(html), 'APIScriptIndex 分支仍存在');
assert(/Promise\.all\(indicatorTypes\.map/.test(html), 'indicator Promise.all 仍存在');

// 7. 基本标签平衡
const ifCount = (html.match(/\bif\s*\(\s*data\.Name/g) || []).length;
assert(ifCount >= 2, `存在多个 data.Name 分支判断 (${ifCount})`);

console.log('\n==== 结果 ====');
if (errors === 0) {
  console.log('全部检查通过 ✅');
  process.exit(0);
} else {
  console.error(`${errors} 项检查失败 ❌`);
  process.exit(1);
}

