#!/usr/bin/env node
// trend.mjs — 科研地形图：几条线的年度产出与口径敏感度
//
// 为什么这个脚本一定要同时报三种口径的计数（而不是挑一个好看的）：
//   实测 2026-08-11，同一个概念 "literature-based discovery" 在 OpenAlex 上——
//     search=…（全文，不加引号）            1,815,368
//     title_and_abstract.search:"…"（短语）        775
//     title.search:"…"（短语）                     223
//   **差 8000 倍。** 任何只报一个数的趋势曲线，读的人无从判断它讲的是哪件事。
//   这与 gap-probe 的「恰好三种元素」、sky-probe 的「恰好这个名字」是同一条：**口径决定结论**。
//
// 用法：node demo/trend-probe/trend.mjs
// 需要 .secrets/apikeys.env 里的 OPENALEX_API_KEY（该目录已 gitignore）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const env = fs.readFileSync(path.join(ROOT, '.secrets/apikeys.env'), 'utf8');
const KEY = (env.match(/OPENALEX_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) { console.error('缺 OPENALEX_API_KEY'); process.exit(1); }

const CACHE = path.join(here, 'cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(qs) {
  if (cache[qs] !== undefined) return cache[qs];
  let out = null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api.openalex.org/works?${qs}&api_key=${KEY}`,
        { signal: AbortSignal.timeout(35000) });
      if (!r.ok) { await sleep(1500 * (i + 1)); continue; }
      out = await r.json(); break;
    } catch { await sleep(1500 * (i + 1)); }
  }
  cache[qs] = out;
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  await sleep(350);
  return out;
}

const P = s => encodeURIComponent(`"${s}"`);

/** 三种口径各要一个数——**不许只报一个**，那正是本探针要防的 */
async function calibers(phrase) {
  const fulltext = await api(`search=${encodeURIComponent(phrase)}&per-page=1`);
  const ta = await api(`filter=title_and_abstract.search:${P(phrase)}&per-page=1`);
  const ti = await api(`filter=title.search:${P(phrase)}&per-page=1`);
  return {
    fulltext_loose: fulltext?.meta?.count ?? null,
    title_abstract_phrase: ta?.meta?.count ?? null,
    title_phrase: ti?.meta?.count ?? null,
  };
}

/** 年度曲线只用中间那个口径（短语 in 标题+摘要）——理由写进输出，不藏
 *
 *  ⚠ **不许带 per-page**：实测 `per-page=1` 会把 group_by 的**分组数**也截成 1，
 *  于是只返回最大的那一组（2026），其余年份全变成 0。
 *  第一版就是这么跑的，产出一张「所有线 2019-2025 全 0、2026 突然暴涨」的表——
 *  数字全是真的（340 确实是 2026 的计数），**结构是假的**。
 *  抓住它的不是判据，是一句常识：LBD 七年 0 篇不可能。这是今天第十次「看起来成功」。 */
async function byYear(phrase) {
  const j = await api(`filter=title_and_abstract.search:${P(phrase)}&group_by=publication_year`);
  const g = {};
  for (const x of (j?.group_by || [])) { const y = +x.key; if (y >= 2015 && y <= 2026) g[y] = x.count; }
  return g;
}

const LINES = [
  { name: '文献连接发现（LBD）', phrase: 'literature-based discovery', note: 'Swanson 1986 起' },
  { name: '实例空间分析', phrase: 'instance space analysis', note: '探矿仪的学名' },
  { name: '算法选择', phrase: 'algorithm selection', note: 'ISA 的上位领域，Rice 1976' },
  { name: 'AI 科学发现', phrase: 'AI for scientific discovery', note: '' },
  { name: '科研 agent 评测', phrase: 'scientific discovery agent', note: '' },
  { name: 'LLM agent 脚手架', phrase: 'LLM agent', note: '用户提的「最新最容易出成果」的地方' },
  { name: '可复现性危机', phrase: 'reproducibility crisis', note: '' },
];

const out = [];
for (const L of LINES) {
  const cal = await calibers(L.phrase);
  const yr = await byYear(L.phrase);
  const ys = Object.keys(yr).map(Number).sort();
  const recent = ys.filter(y => y >= 2023).reduce((s, y) => s + yr[y], 0);
  const older = ys.filter(y => y >= 2019 && y <= 2022).reduce((s, y) => s + yr[y], 0);
  out.push({ ...L, calibers: cal, by_year: yr, sum_2019_2022: older, sum_2023_2026: recent,
    growth: older ? +(recent / older).toFixed(2) : null });
  process.stderr.write(`\r${out.length}/${LINES.length}  ${L.name}                    `);
}
process.stderr.write('\n');

fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify({
  spec: 'trend-probe/0.1', source: 'OpenAlex', fetched: 'see cache.json',
  caliber_warning: '同一概念三种口径实测差 8000 倍（LBD: 1815368 / 775 / 223）。'
    + '年度曲线一律用 title_and_abstract 短语口径；三种口径的绝对数同时给出，供读者判断。',
  lines: out
}, null, 1));

console.log('\n口径敏感度（同一短语，三种检索方式的命中数）');
console.log('  线                    全文宽松      标题+摘要短语   标题短语   宽松/短语倍数');
for (const r of out) {
  const c = r.calibers;
  const ratio = c.title_abstract_phrase ? Math.round(c.fulltext_loose / c.title_abstract_phrase) : '-';
  console.log('  ' + r.name.padEnd(20)
    + String(c.fulltext_loose ?? '-').padStart(10)
    + String(c.title_abstract_phrase ?? '-').padStart(14)
    + String(c.title_phrase ?? '-').padStart(11)
    + String(ratio).padStart(12) + '×');
}
console.log('\n年度产出（标题+摘要短语口径）');
const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
console.log('  线                  ' + years.map(y => String(y).slice(2).padStart(6)).join('') + '   23-26/19-22');
for (const r of out) {
  console.log('  ' + r.name.padEnd(20)
    + years.map(y => String(r.by_year[y] ?? 0).padStart(6)).join('')
    + String(r.growth ?? '-').padStart(10) + '×');
}
console.log('\n⚠ 2026 年未过完，最后一列天然偏低；增长倍数按 2023-2026 / 2019-2022 计，同样受此影响。');
