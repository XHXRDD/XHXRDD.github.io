// 方案B：用 Node 真实请求腾讯接口，复刻 fetchAllKlinePaged 的分页+去重逻辑
// 目的：1) 验证分页/去重逻辑正确性  2) 实测分页耗时

const https = require('https');
const { performance } = require('perf_hooks');

const MAX_TOTAL = 2000;
const PAGE_SIZE = 640;
const REQUEST_INTERVAL = 250; // 与改后代码一致

// 复刻 toTencentSymbol
function toTencentSymbol(internalSymbol) {
  const parts = internalSymbol.split('.');
  const market = parts[0];
  const code = parts[1];
  const suffix = (market === '1') ? 'sh' : 'sz';
  return suffix + code;
}

function getTencentPeriod(period) {
  const map = { 0: 'day', 1: 'week', 2: 'month' };
  return map[period] || 'day';
}

function buildTencentUrl(fullSymbol, period, endDate, count, adj) {
  const param = fullSymbol + ',' + getTencentPeriod(period) + ',,' + endDate + ',' + count + ',' + adj;
  return 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + param;
}

function extractKlineArray(stockData, adj) {
  let keys;
  if (adj === 'qfq') keys = ['qfqday', 'qfqweek', 'qfqmonth', 'day', 'week', 'month'];
  else if (adj === 'hfq') keys = ['hfqday', 'hfqweek', 'hfqmonth', 'day', 'week', 'month'];
  else keys = ['day', 'week', 'month', 'qfqday', 'hfqday'];
  for (let i = 0; i < keys.length; i++) {
    if (stockData[keys[i]] && stockData[keys[i]].length > 0) {
      return stockData[keys[i]];
    }
  }
  return [];
}

function previousDay(dateStr) {
  const d = new Date(Date.parse(dateStr));
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

// 用 https 请求（带超时）
function httpGetJson(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('JSON 解析失败: ' + raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('请求超时')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 复刻 fetchAllKlinePaged（含计时）
async function fetchAllKlinePaged(fullSymbol, period, adj) {
  let allKlines = [];
  let endDate = '';
  let requestCount = 0;
  const pageLog = [];
  const t0 = performance.now();

  while (allKlines.length < MAX_TOTAL) {
    const url = buildTencentUrl(fullSymbol, period, endDate, PAGE_SIZE, adj);
    const pt0 = performance.now();
    let json;
    try {
      json = await httpGetJson(url);
    } catch (e) {
      console.error(`[分页] 第 ${requestCount + 1} 次请求失败:`, e.message);
      break;
    }
    const pageMs = performance.now() - pt0;
    requestCount++;

    if (!json || !json.data) break;
    const dataKey = Object.keys(json.data)[0];
    const stockData = json.data[dataKey];
    if (!stockData) break;

    const batch = extractKlineArray(stockData, adj);
    if (!batch || batch.length === 0) break;

    allKlines = batch.concat(allKlines);

    const earliest = batch[0][0];
    const latest = batch[batch.length - 1][0];
    pageLog.push({ page: requestCount, size: batch.length, earliest, latest, ms: Math.round(pageMs) });
    console.log(`[分页] 第 ${requestCount} 次: 返回 ${batch.length} 根, 区间 ${earliest} ~ ${latest}, 耗时 ${Math.round(pageMs)}ms, 累计 ${allKlines.length}`);

    if (batch.length < PAGE_SIZE) break;

    endDate = previousDay(earliest);
    await sleep(REQUEST_INTERVAL); // 遵守间隔
  }

  const totalMs = performance.now() - t0;

  // 排序
  allKlines.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  // 去重
  const seen = {};
  const dedup = [];
  for (let k = 0; k < allKlines.length; k++) {
    const key = allKlines[k][0];
    if (!seen[key]) { seen[key] = true; dedup.push(allKlines[k]); }
  }

  const result = dedup.slice(-MAX_TOTAL);
  return { result, totalMs, requestCount, pageLog, beforeDedup: allKlines.length, afterDedup: dedup.length };
}

// 数据合法性检查
function validate(klines) {
  const issues = [];
  const dates = new Set();
  let prevDate = null;
  for (let i = 0; i < klines.length; i++) {
    const item = klines[i];
    if (!item || item.length < 6) { issues.push(`第${i}根字段不足`); continue; }
    const [date, open, close, high, low] = item;
    if (dates.has(date)) issues.push(`重复日期 ${date}`);
    dates.add(date);
    if (prevDate && !(prevDate < date)) issues.push(`日期非升序: ${prevDate} -> ${date}`);
    prevDate = date;
    const o = parseFloat(open), c = parseFloat(close), h = parseFloat(high), l = parseFloat(low);
    if ([o, c, h, l].some(v => isNaN(v))) { issues.push(`第${i}根价格非数字`); continue; }
    if (h < l) issues.push(`第${i}根 high<low (${h}<${l})`);
    if (o > h || o < l) issues.push(`第${i}根 open 越界 (${o} 不在 ${l}~${h})`);
    if (c > h || c < l) issues.push(`第${i}根 close 越界 (${c} 不在 ${l}~${h})`);
  }
  return issues;
}

(async () => {
  // 测试用例：上证指数 + 平安银行 + 贵州茅台
  const cases = [
    { name: '上证指数(999999->1.000001)', internal: '1.000001' },
    { name: '平安银行(000001)', internal: '0.000001' },
    { name: '贵州茅台(600519)', internal: '1.600519' },
  ];

  for (const c of cases) {
    console.log('\n========================================');
    console.log('测试: ' + c.name);
    console.log('========================================');
    const fullSymbol = toTencentSymbol(c.internal);
    const { result, totalMs, requestCount, pageLog, beforeDedup, afterDedup } = await fetchAllKlinePaged(fullSymbol, 0, 'qfq');

    console.log('--- 汇总 ---');
    console.log(`请求次数: ${requestCount}`);
    console.log(`总耗时: ${Math.round(totalMs)}ms`);
    console.log(`去重前根数: ${beforeDedup}, 去重后根数: ${afterDedup}, 去重删除: ${beforeDedup - afterDedup}`);
    console.log(`最终交付根数: ${result.length} (MAX_TOTAL=${MAX_TOTAL})`);
    if (result.length > 0) {
      console.log(`日期范围: ${result[0][0]} ~ ${result[result.length - 1][0]}`);
    }

    const issues = validate(result);
    if (issues.length === 0) {
      console.log('✅ 数据合法性检查通过（无重复/升序/价格区间正常）');
    } else {
      console.log(`⚠️ 数据合法性问题 ${issues.length} 条:`);
      issues.slice(0, 10).forEach(x => console.log('   - ' + x));
      if (issues.length > 10) console.log(`   ... 还有 ${issues.length - 10} 条`);
    }
  }
  console.log('\n======== 测试结束 ========');
})();
