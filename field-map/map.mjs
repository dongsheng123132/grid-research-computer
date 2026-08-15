#!/usr/bin/env node
// map.mjs — 对照纪律地图：哪些领域在自己的话语里带对照，哪些不带
//
// 判据在 PREREG.md，本次运行之前冻结。这里只取读数。
// 仪器必须先过三道阳性对照（见 PREREG「仪器阳性对照」），不过就整轮作废、退出码 2。
//
// 用法：node demo/field-map/map.mjs
// 需要 .secrets/apikeys.env 的 OPENALEX_API_KEY

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const KEY = (fs.readFileSync(path.join(ROOT, '.secrets/apikeys.env'), 'utf8')
  .match(/OPENALEX_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) { console.error('缺 OPENALEX_API_KEY'); process.exit(1); }

const CACHE = path.join(here, 'cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let errors = 0, calls = 0;

async function count(filter, wantTop = 0) {
  const qs = `filter=${filter}&per-page=${wantTop || 1}` + (wantTop ? '&sort=cited_by_count:desc' : '');
  if (cache[qs] !== undefined) return cache[qs];
  let out = null;
  for (let i = 0; i < 4; i++) {
    calls++;
    try {
      const r = await fetch(`https://api.openalex.org/works?${qs}&api_key=${KEY}`,
        { signal: AbortSignal.timeout(35000) });
      if (!r.ok) { await sleep(1200 * (i + 1)); continue; }
      const j = await r.json();
      out = { n: j.meta?.count ?? null, top: (j.results || []).map(w => w.display_name) };
      break;
    } catch { await sleep(1200 * (i + 1)); }
  }
  if (out === null) errors++;
  cache[qs] = out; fs.writeFileSync(CACHE, JSON.stringify(cache)); await sleep(300);
  return out;
}
const TA = s => `title_and_abstract.search:${encodeURIComponent(`"${s}"`)}`;

// ── 仪器阳性对照（PREREG 三关，先跑）──
console.log('仪器自检…');
const g1 = await count(`title.search:${encodeURIComponent('"aspirin"')},title.search:${encodeURIComponent('"headache"')}`, 1);
const gate1 = g1 && g1.n >= 20 && /aspirin|acetaminophen|analgesic/i.test(g1.top[0] || '');
console.log(` ${gate1 ? '✔' : '✘'} G1 aspirin∩headache = ${g1?.n} 篇　首条「${(g1?.top[0] || '').slice(0, 46)}」`);

// ── 领域与纪律词（PREREG 要求：全部多词短语，逐词报数）──
//
// ⚠ 每个领域必须再加**学科归属过滤**。第一版没加，G3 当场报红——诊断发现：
// 数论那 21 篇「negative control」里前 5 篇有 4 篇根本不是数学论文
// （环境科学×2、物理天文、计算机），短语 "number theory" 出现在别的学科的论文里，
// 把它们的对照词汇一起带进来了。加过滤后 21 → 6 篇。
// **这是「口径决定结论」的第六次实例，也是 G3 这道闸门的第一次实弹。**
const F = { MED: 27, PHARM: 30, IMMU: 24, BIO: 13, MAT: 25, CHEM: 16, CS: 17, PHYS: 31, MATH: 26, EARTH: 19 };
const FIELDS = [
  ['中', 'clinical trial', F.MED], ['中', 'drug discovery', F.PHARM],
  ['中', 'vaccine efficacy', F.IMMU], ['中', 'systematic review', F.MED],
  ['生', 'gene expression', F.BIO], ['生', 'protein structure prediction', F.BIO],
  ['生', 'single cell', F.BIO],
  ['材', 'materials discovery', F.MAT], ['材', 'crystal structure prediction', F.MAT],
  ['材', 'catalyst design', F.CHEM],
  ['机', 'machine learning', F.CS], ['机', 'deep learning', F.CS],
  ['机', 'recommender system', F.CS], ['机', 'large language model', F.CS],
  ['物', 'dark matter', F.PHYS], ['物', 'gravitational wave', F.PHYS],
  ['天', 'transient survey', F.PHYS],
  ['数', 'combinatorial optimization', F.MATH], ['数', 'number theory', F.MATH],
  ['地', 'climate model', F.EARTH],
].map(([tag, name, field]) => ({ tag, name, field }));
const FLD = f => `primary_topic.field.id:fields/${f}`;

const TERMS = ['positive control', 'negative control', 'control experiment',
  'false negative', 'false positive', 'cross-validation',
  'ablation study', 'sanity check', 'replication study', 'pre-registration'];

const rows = [];
for (const f of FIELDS) {
  const s = await count(`${TA(f.name)},${FLD(f.field)}`);
  const size = s?.n ?? null;
  const rec = { ...f, size, status: size === null ? 'error' : size < 500 ? 'too_narrow' : 'measured', hits: {} };
  if (rec.status === 'measured') {
    for (const t of TERMS) {
      const h = await count(`${TA(f.name)},${TA(t)},${FLD(f.field)}`);
      rec.hits[t] = h?.n ?? null;
    }
    const ctrl = ['positive control', 'negative control', 'control experiment']
      .reduce((a, t) => a + (rec.hits[t] || 0), 0);
    const all = TERMS.reduce((a, t) => a + (rec.hits[t] || 0), 0);
    rec.control_hits = ctrl;
    rec.control_density = ctrl / size;
    rec.rigor_density = all / size;
  }
  rows.push(rec);
  process.stderr.write(`\r${rows.length}/${FIELDS.length}  ${f.name}                         `);
}
process.stderr.write('\n');

// ── PREREG 失败判据 ──
const measured = rows.filter(r => r.status === 'measured');
const dens = measured.map(r => r.control_density).sort((a, b) => a - b);
const median = dens[Math.floor(dens.length / 2)];
const ct = measured.find(r => r.name === 'clinical trial');
const math = measured.filter(r => r.tag === '数');
const gate2 = ct && ct.control_density > median * 2;
const gate3 = math.length > 0 && math.every(r => r.control_density < median);
const errRate = errors / Math.max(1, calls);
const failures = [];
if (!gate1) failures.push('G1 不成立：AND 语义或检索口径坏了');
if (!gate2) failures.push(`G2 不成立：clinical trial 的对照密度未显著高于中位数（${ct?.control_density?.toExponential(2)} vs ${median?.toExponential(2)}）—— 该指标测的可能不是对照纪律`);
if (!gate3) failures.push('G3 不成立：形式学科的对照密度未低于中位数 —— 指标可能在乱匹配');
if (errRate > 0.15) failures.push(`API 失败率 ${(errRate * 100).toFixed(0)}% > 15%`);

const prereg = crypto.createHash('sha256').update(fs.readFileSync(path.join(here, 'PREREG.md'))).digest('hex');
fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify({
  spec: 'field-map/0.1', prereg_sha: prereg, source: 'OpenAlex',
  measured: measured.length, too_narrow: rows.filter(r => r.status === 'too_narrow').length,
  error: rows.filter(r => r.status === 'error').length,
  gates: { G1_aspirin: gate1, G2_clinical_high: gate2, G3_formal_low: gate3 },
  median_control_density: median, failures, rows
}, null, 1));

console.log(` ${gate2 ? '✔' : '✘'} G2 clinical trial 对照密度 ${ct?.control_density?.toExponential(2)}  中位数 ${median?.toExponential(2)}`);
console.log(` ${gate3 ? '✔' : '✘'} G3 形式学科低于中位数`);
console.log(`\n可测 ${measured.length}　口径过窄 ${rows.filter(r => r.status === 'too_narrow').length}　失败 ${rows.filter(r => r.status === 'error').length}\n`);

console.log('领域                          规模   对照词  对照密度   pos  neg  ctrlExp  假阴  假阳  消融');
for (const r of [...measured].sort((a, b) => b.control_density - a.control_density)) {
  const h = r.hits;
  console.log('  ' + (r.tag + ' ' + r.name).padEnd(30)
    + String(r.size).padStart(7)
    + String(r.control_hits).padStart(7)
    + (r.control_density * 1000).toFixed(2).padStart(10) + '‰'
    + String(h['positive control']).padStart(5)
    + String(h['negative control']).padStart(5)
    + String(h['control experiment']).padStart(8)
    + String(h['false negative']).padStart(6)
    + String(h['false positive']).padStart(6)
    + String(h['ablation study']).padStart(6));
}
const narrow = rows.filter(r => r.status !== 'measured');
if (narrow.length) console.log('\n未进排名：' + narrow.map(r => `${r.name}(${r.status},size=${r.size})`).join('、'));

if (failures.length) { console.log('\n本轮作废：'); failures.forEach(f => console.log('  ✘ ' + f)); process.exit(2); }
