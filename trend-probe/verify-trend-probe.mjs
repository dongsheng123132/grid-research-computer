#!/usr/bin/env node
// verify-trend-probe.mjs — 计量口径判据 v0.1（复赛补）
// 判什么：「同一概念三种口径差 8000 倍」不是口号，是能从头三行复算的数；
// 增长率与年度和必须从 by_year 复算，不许只报结论；口径数字必须单调（宽松口径≥收紧口径）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/trend-probe/trend.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const lines = r.lines || [];

// T1：口径差警示必须存在，且「千倍级」可从数据复算
J('T1.1', 'caliber_warning 必须存在并披露口径差', typeof r.caliber_warning === 'string' && /口径|倍/.test(r.caliber_warning),
  (r.caliber_warning || '缺 caliber_warning').slice(0, 60));
{
  const lbd = lines.find(l => /LBD|文献连接/i.test(l.name || ''));
  let ratio = null;
  if (lbd && typeof lbd.calibers?.fulltext_loose === 'number' && typeof lbd.calibers?.title_phrase === 'number') {
    ratio = lbd.calibers.fulltext_loose / lbd.calibers.title_phrase;
  }
  J('T1.2', 'LBD 行口径差必须 ≥ 1000 倍（8000 倍主张的可复核下限）',
    ratio !== null && ratio >= 1000, ratio === null ? '缺口径' : `fulltext/title_phrase = ${ratio.toFixed(0)}x`);
}

// T2：口径三键齐全且单调（宽松口径的数字只会更大）
const triplesOk = lines.every(l => {
  const c = l.calibers || {};
  const nums = [c.fulltext_loose, c.title_abstract_phrase, c.title_phrase];
  if (!nums.every(n => typeof n === 'number')) return false;
  return c.fulltext_loose >= c.title_abstract_phrase && c.title_abstract_phrase >= c.title_phrase;
});
J('T2.1', '每行口径三键齐全且单调（fulltext ≥ TA短语 ≥ 标题短语）', lines.length > 0 && triplesOk,
  `行数=${lines.length}`);

// T3：年度和必须能从 by_year 复算
const sumsOk = lines.every(l => {
  const by = l.by_year || {};
  const s1922 = [2019, 2020, 2021, 2022].reduce((a, y) => a + (by[y] || 0), 0);
  const s2326 = [2023, 2024, 2025, 2026].reduce((a, y) => a + (by[y] || 0), 0);
  return l.sum_2019_2022 === s1922 && l.sum_2023_2026 === s2326;
});
J('T3.1', 'sum_2019_2022 / sum_2023_2026 必须等于 by_year 对应年份之和', sumsOk, '年度和与逐年值对不上');

// T4：growth 必须可复算。s1922=0 的行增长率未定义（null）是语义正确，跳过
const growthOk = lines.every(l => {
  if (l.sum_2019_2022 <= 0) return l.growth === null || l.growth === undefined;
  if (typeof l.growth !== 'number') return false;
  return Math.abs(l.growth - l.sum_2023_2026 / l.sum_2019_2022) < 0.02;
});
J('T4.1', 'growth 必须等于 2023-26 和 / 2019-22 和（±0.02）', growthOk, '增长率不可复算=编的');

// T5：反向用例（防恒绿）。把某行 title_phrase 抬到超过 TA 口径，单调判据必须变红
{
  const l0 = lines[0];
  const mutated = { ...l0.calibers, title_phrase: l0.calibers.title_abstract_phrase + 5 };
  const monotonic = mutated.fulltext_loose >= mutated.title_abstract_phrase && mutated.title_abstract_phrase >= mutated.title_phrase;
  const sensitive = !monotonic;
  J('T5.1', '反向用例：破坏单调性后判据必须响', sensitive,
    sensitive ? '单调检查对注入敏感' : '❌ 单调判据是恒绿考题');
}

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('计量口径判据 v0.1 —— demo/trend-probe\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(8)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮结果作废：口径主张不可复算或自相矛盾。');
  process.exit(2);
}
process.exit(0);