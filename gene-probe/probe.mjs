#!/usr/bin/env node
// probe.mjs — 基因符号假空探针：第四个学科
//
// 判据在 PREREG.md，运行前冻结。
//
// 与前三次同构：
//   材料：库里**恰好**含这 3 种元素 = 0 → 从未合成       （Fe-Cr-Ni）
//   天文：库里**恰好**这个名字 = 0     → 未编目          （Crab Nebula → "M 1"）
//   组合：输出合法 = 好结果                              （贪心从没赢过随机重启）
//   基因：库里**恰好**这个符号 = 0     → 未知基因/注释缺失（本轮）
//
// 对照集由我列出，**由权威源裁决**——这一点是设计而非偷懒：
//   我以为改名了其实没改的 → exact_hit（自动成为 R1 正向对照）
//   我编造的               → unresolved（自动成为 R2 反向对照）
//   真改名的               → alias_only（= 假空）
// 所以清单的正确性不影响结论，只影响三档的分布。**判断在 mygene.info 那边，不在我这边。**
//
// 用法：node demo/gene-probe/probe.mjs
// 退出码：0 = 跑完　2 = 检索口径坏了，本轮作废

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(here, 'cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 候选：文献里被大量使用过的旧符号 / 俗名。真假由 mygene 裁决。
const CANDIDATES = [
  // 癌基因 / 抑癌基因
  'MLL', 'MLL2', 'MLL3', 'HER2', 'NEU', 'C-MYC', 'K-RAS', 'N-RAS',
  'p16', 'p21', 'p53', 'Rb', 'BCL-2', 'ABL', 'FAM134B', 'C11orf30',
  // CD 系列表面标记
  'CD11B', 'CD11A', 'CD18', 'CD25', 'CD31', 'CD62L', 'CD95', 'CD117',
  // SEPT / MARCH 家族（Excel 自动纠正导致的改名）
  'SEPT1', 'SEPT2', 'SEPT9', 'SEPT11', 'MARCH1', 'MARCH5', 'DEC1',
  // 细胞因子 / 趋化因子俗名
  'MCP-1', 'RANTES', 'IL-8', 'SDF-1', 'VEGF', 'GM-CSF',
  // 干细胞 / 受体 / 其他
  'OCT4', 'GPR30', 'ICAM-1', 'TNFSF2', 'CD133', 'PD-L1',
  // 阳性对照：现行官方符号，应当 exact_hit
  'TP53', 'BRCA1', 'EGFR', 'KRAS', 'MYC', 'PTEN',
  // R2 反向用例：故意编造
  'ZZQX9', 'FAKEGENE7',
];

async function mygene(url) {
  if (cache[url] !== undefined) return cache[url];
  let out = null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) { await sleep(1200 * (i + 1)); continue; }
      out = await r.json(); break;
    } catch { await sleep(1200 * (i + 1)); }
  }
  cache[url] = out; fs.writeFileSync(CACHE, JSON.stringify(cache)); await sleep(300);
  return out;
}
const F = 'fields=symbol,name,alias&species=human&size=3';
// mygene 的 alias 只有一个时返回字符串而不是数组 —— 不归一会当场抛错（实测）
const aliases = h => { const a = h?.alias; return a == null ? [] : Array.isArray(a) ? a : [a]; };

const rows = [];
for (const sym of CANDIDATES) {
  // ① 朴素口径：按官方符号精确查
  const ex = await mygene(`https://mygene.info/v3/query?q=symbol:${encodeURIComponent(sym)}&${F}`);
  // ② 权威解析：通用查询（会走别名）
  const ge = await mygene(`https://mygene.info/v3/query?q=${encodeURIComponent(sym)}&${F}`);
  if (ex === null || ge === null) { rows.push({ sym, verdict: 'error' }); continue; }

  const exHit = (ex.hits || []).find(h => (h.symbol || '').toUpperCase() === sym.toUpperCase());
  const geHit = (ge.hits || [])[0];
  // 通用查询命中，且该基因的别名里确实含这个符号 → 说明这是个合法旧符号/俗名
  const aliasMatch = geHit && aliases(geHit).some(a => String(a).toUpperCase() === sym.toUpperCase());

  let verdict;
  if (exHit) verdict = 'exact_hit';
  else if (geHit && aliasMatch) verdict = 'alias_only';
  else if (geHit) verdict = 'fuzzy_only';        // 通用查询给了东西但别名对不上——不算假空，单独记
  else verdict = 'unresolved';

  rows.push({
    sym, verdict,
    official: geHit?.symbol ?? null, name: (geHit?.name ?? '').slice(0, 54),
    alias_count: aliases(geHit).length
  });
  process.stderr.write(`\r${rows.length}/${CANDIDATES.length}  ${sym} → ${verdict}            `);
}
process.stderr.write('\n');

const n = k => rows.filter(r => r.verdict === k).length;
const denom = n('exact_hit') + n('alias_only');
const falseEmpty = denom ? n('alias_only') / denom : null;

const r2 = rows.filter(r => ['ZZQX9', 'FAKEGENE7'].includes(r.sym));
const r2ok = r2.every(r => r.verdict === 'unresolved' || r.verdict === 'fuzzy_only');
const r3 = rows.find(r => r.sym === 'TP53');
const failures = [];
if (n('exact_hit') === 0) failures.push('R1 不成立：一条 exact_hit 都没有，探针可能对任何输入都报查不到');
if (!r3 || r3.verdict !== 'exact_hit') failures.push(`R3 不成立：TP53 被判为 ${r3?.verdict}，检索口径坏了`);
if (n('error') / rows.length > 0.20) failures.push('error 占比 > 20%');

const prereg = crypto.createHash('sha256').update(fs.readFileSync(path.join(here, 'PREREG.md'))).digest('hex');
fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify({
  spec: 'gene-probe/0.1', prereg_sha: prereg, source: 'mygene.info (HGNC/NCBI)',
  counts: { exact_hit: n('exact_hit'), alias_only: n('alias_only'), fuzzy_only: n('fuzzy_only'), unresolved: n('unresolved'), error: n('error') },
  false_empty_rate: falseEmpty,
  denominator_note: '分母只含 exact_hit + alias_only；fuzzy_only / unresolved / error 不进分母',
  reverse: { R2_fabricated: r2.map(r => `${r.sym}:${r.verdict}`), R2_ok: r2ok, R3_TP53: r3?.verdict },
  failures, rows
}, null, 1));

console.log(`\n候选 ${CANDIDATES.length} 个　PREREG ${prereg.slice(0, 16)}…`);
console.log(`  精确命中（朴素判据说「已知」）    ${n('exact_hit')}`);
console.log(`  仅别名命中（说「未知基因」）      ${n('alias_only')}  ← 假空`);
console.log(`  模糊命中（别名对不上）            ${n('fuzzy_only')}  ← 不并入假空`);
console.log(`  完全查不到                        ${n('unresolved')}  ← 不并入假空`);
console.log(`  接口失败                          ${n('error')}`);
console.log(`\n假空率 = ${n('alias_only')}/${denom} = ${falseEmpty === null ? 'n/a' : (falseEmpty * 100).toFixed(1) + '%'}`);
console.log(`R2 编造符号 → ${r2.map(r => r.sym + ':' + r.verdict).join(', ')} ${r2ok ? '✔' : '✘ 被当成了新基因'}`);
console.log(`R3 TP53 → ${r3?.verdict}`);

console.log('\n被朴素判据判成「未知基因」的（假空）：');
rows.filter(r => r.verdict === 'alias_only').forEach(r =>
  console.log(`   ${r.sym.padEnd(11)} → 官方 ${String(r.official).padEnd(10)} ${r.name}`));

if (failures.length) { console.log('\n本轮作废：'); failures.forEach(f => console.log('  ✘ ' + f)); process.exit(2); }
