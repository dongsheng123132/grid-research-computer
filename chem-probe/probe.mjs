#!/usr/bin/env node
// probe.mjs — 化合物名假空探针：第五个学科
//
// 朴素判据（与前四次逐条同构）：
//   「用手头这个名字去精确匹配数据库的**标准名**，对不上 → 判为未收录 / 新化合物」
//
//   材料：库里恰好含这 3 种元素 = 0 → 从未合成        （Fe-Cr-Ni，不锈钢基体）
//   天文：库里恰好这个名字 = 0     → 未编目           （Crab Nebula → 主名 "M 1"）
//   基因：库里恰好这个符号 = 0     → 未知基因         （HER2 → ERBB2，假空率 78.6%）
//   化学：恰好这个名字 ≠ IUPAC 名  → 未收录/新化合物  （本轮）
//
// 三态（承重点，绝不合并）：
//   exact_hit    查询名与 IUPAC 标准名逐字相同        → 朴素判据说「已收录」
//   alias_only   解析器认识它，但标准名不同           → **朴素判据说「新化合物」= 假空**
//   unresolved   解析器也不认识                        → 单独计数，**不并入假空**
//   error        接口失败                              → 单独计数，不并入任何结论
//
// 反向判据 R2：故意编造的名字必须落进 unresolved，不得被写成「新化合物」
// 反向判据 R3：`2-acetyloxybenzoic acid`（阿司匹林的 IUPAC 名）必须 exact_hit，
//              否则说明连标准名都对不上，检索口径坏了，整轮作废。
//
// 用法：node demo/chem-probe/probe.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(here, 'cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PC = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

// 文献/教科书/工业里被大量使用的名字。真假与是否为标准名，由 PubChem 裁决。
const NAMES = [
  // 药物俗名 / 商品名
  'aspirin', 'Tylenol', 'ibuprofen', 'penicillin G', 'morphine', 'caffeine',
  'nicotine', 'insulin', 'warfarin', 'metformin',
  // 营养素俗名
  'vitamin C', 'vitamin D3', 'vitamin B12', 'folic acid', 'niacin',
  // 工业 / 日常俗名
  'table salt', 'baking soda', 'muriatic acid', 'quicklime', 'lye',
  'laughing gas', 'dry ice', 'wood alcohol', 'grain alcohol', 'battery acid',
  // 材料 / 无机
  'quartz', 'rutile', 'anatase', 'corundum', 'magnetite', 'graphite',
  'titanium dioxide', 'barium titanate', 'lithium cobalt oxide',
  // 生化
  'ATP', 'glucose', 'cholesterol', 'dopamine', 'serotonin',
  // R3 正向对照：IUPAC 标准名本身
  '2-acetyloxybenzoic acid',
  // R2 反向用例：编造
  'zorbaxinic acid', 'fakechemium oxide',
];

async function get(url) {
  if (cache[url] !== undefined) return cache[url];
  let out = null;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (r.status === 404) { out = { notfound: true }; break; }
      if (!r.ok) { await sleep(1200 * (i + 1)); continue; }
      out = await r.json(); break;
    } catch { await sleep(1200 * (i + 1)); }
  }
  cache[url] = out; fs.writeFileSync(CACHE, JSON.stringify(cache)); await sleep(320);
  return out;
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const rows = [];
for (const name of NAMES) {
  const cids = await get(`${PC}/name/${encodeURIComponent(name)}/cids/JSON`);
  if (cids === null) { rows.push({ name, verdict: 'error' }); continue; }
  if (cids.notfound || !cids.IdentifierList) { rows.push({ name, verdict: 'unresolved' }); continue; }
  const cid = cids.IdentifierList.CID[0];
  const prop = await get(`${PC}/cid/${cid}/property/IUPACName,MolecularFormula/JSON`);
  const p = prop?.PropertyTable?.Properties?.[0];
  const iupac = p?.IUPACName ?? null;
  rows.push({
    name, cid, iupac, formula: p?.MolecularFormula ?? null,
    verdict: iupac && norm(iupac) === norm(name) ? 'exact_hit' : 'alias_only'
  });
  process.stderr.write(`\r${rows.length}/${NAMES.length}  ${name}                    `);
}
process.stderr.write('\n');

const n = k => rows.filter(r => r.verdict === k).length;
const denom = n('exact_hit') + n('alias_only');
const fe = denom ? n('alias_only') / denom : null;
const r2 = rows.filter(r => ['zorbaxinic acid', 'fakechemium oxide'].includes(r.name));
const r2ok = r2.every(r => r.verdict === 'unresolved');
const r3 = rows.find(r => r.name === '2-acetyloxybenzoic acid');
const failures = [];
if (n('exact_hit') === 0) failures.push('R1 不成立：一条 exact_hit 都没有，探针可能对任何输入都报「新化合物」');
if (!r3 || r3.verdict !== 'exact_hit') failures.push(`R3 不成立：阿司匹林的 IUPAC 名被判为 ${r3?.verdict}（库里标准名是「${r3?.iupac}」），检索口径坏了`);
if (!r2ok) failures.push('R2 不成立：编造的名字被当成了新化合物');
if (n('error') / rows.length > 0.20) failures.push('error 占比 > 20%');

fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify({
  spec: 'chem-probe/0.1', source: 'PubChem PUG REST',
  counts: { exact_hit: n('exact_hit'), alias_only: n('alias_only'), unresolved: n('unresolved'), error: n('error') },
  false_empty_rate: fe,
  denominator_note: '分母只含 exact_hit + alias_only；unresolved 与 error 不进分母',
  reverse: { R2: r2.map(r => `${r.name}:${r.verdict}`), R2_ok: r2ok, R3: r3?.verdict },
  failures, rows
}, null, 1));

console.log(`\n候选 ${NAMES.length} 个`);
console.log(`  与标准名逐字相同                ${n('exact_hit')}`);
console.log(`  解析器认识但标准名不同          ${n('alias_only')}  ← 假空`);
console.log(`  解析器也不认识                  ${n('unresolved')}  ← 不并入假空`);
console.log(`  接口失败                        ${n('error')}`);
console.log(`\n假空率 = ${n('alias_only')}/${denom} = ${fe === null ? 'n/a' : (fe * 100).toFixed(1) + '%'}`);
console.log(`R2 编造名 → ${r2.map(r => r.name + ':' + r.verdict).join(', ')} ${r2ok ? '✔' : '✘'}`);
console.log(`R3 IUPAC 名 → ${r3?.verdict}`);
console.log('\n会被判成「新化合物」的（前 14）：');
rows.filter(r => r.verdict === 'alias_only').slice(0, 14).forEach(r =>
  console.log(`   ${r.name.padEnd(24)} CID ${String(r.cid).padEnd(10)} 标准名「${String(r.iupac).slice(0, 44)}」`));

if (failures.length) { console.log('\n本轮作废：'); failures.forEach(f => console.log('  ✘ ' + f)); process.exit(2); }
