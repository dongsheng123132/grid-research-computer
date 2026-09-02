#!/usr/bin/env node
// probe.mjs — LBD 假空探针：量 ABC 模型「A-C 查不到 → 未被发现的连接」的假阳性率
//
// 判据在 PREREG.md，本次运行之前已冻结。这里只取读数，不改规则。
//
// 被复刻的错误，与前三次同构：
//   材料：数据库里**恰好**含这 3 种元素 = 0 → 从未合成          （击穿者 Fe-Cr-Ni）
//   天文：库里**恰好**这个名字 = 0        → 未编目               （击穿者 Crab Nebula）
//   文献：库里 A 与 C **恰好**共现 = 0     → 未被发现的连接        （击穿者见 controls-raw.json）
//
// 三态必须分开（PREREG 承重点）：
//   co_occurs        查到共现 ≥1 篇        → 朴素判据说「已知连接」
//   no_co_occurrence 查到 0 篇             → **朴素判据说「新发现」= 假空**
//   unresolved       A 或 C 本身查不到      → 单独计数，**绝不并入假空**
//   error            网络/接口失败          → 单独计数，绝不并入任何结论
//
// 用法：node demo/lbd-probe/probe.mjs [--smoke N] [--key <s2-api-key>]
// 退出码：0 = 跑完　2 = 检索口径坏了，本轮作废（见 PREREG 失败判据）

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const SMOKE = arg('--smoke') ? +arg('--smoke') : null;
const KEY = arg('--key') || process.env.S2_API_KEY || null;
const CACHE_PATH = path.join(here, 'cache.json');
const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};

// Semantic Scholar 无 key 时被全额限流（实测 8/8 error，本轮按 PREREG 作废）。
// 换 Europe PMC：免费、无需 key、覆盖 PubMed+，且对照集全是药物↔疾病，正对口。
// 关键：Europe PMC 默认 `synonym=false` —— **不展开同义词，正是被测的那个口径**。
// 展开了就不是在测朴素判据，而是在测一个更好的判据（PREREG 已写死这一条）。
const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

/**
 * 查一次共现。**只观察，不判断**——判断在下面第二步。
 * 退避是必须的：撞限流时静默失败会把「我被限流了」写成「文献里没有」，
 * 那正是本探针要抓的那个病。上一版就是靠这一条把整轮正确作废的。
 */
async function cooccur(a, c) {
  const q = a === c ? `"${a}"` : `"${a}" AND "${c}"`;
  if (cache[q] !== undefined) return cache[q];
  let rec = { status: 'error' };
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const url = `${EPMC}?query=${encodeURIComponent(q)}&format=json&pageSize=2&resultType=lite`;
      const r = await fetch(url, {
        headers: { 'User-Agent': '2Origin-lbd-probe/0.1 (research prototype)' },
        signal: AbortSignal.timeout(30000)
      });
      if (!r.ok) { await sleep(1500 * (attempt + 1)); continue; }
      const j = await r.json();
      if (typeof j.hitCount !== 'number') { await sleep(1500 * (attempt + 1)); continue; }
      rec = {
        status: 'ok', total: j.hitCount,
        synonym_expansion: j.request?.synonym ?? null,   // 必须记下来：口径要可复核
        sample: (j.resultList?.result || []).slice(0, 2).map(p => ({ t: p.title, y: p.pubYear }))
      };
      break;
    } catch { await sleep(1500 * (attempt + 1)); }
  }
  cache[q] = rec;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 1));
  await sleep(400);
  return rec;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 单个实体在库里存不存在——用来区分「没共现」和「我这个词根本查不着」 */
async function entityExists(x) {
  const r = await cooccur(x, x);   // 复用缓存与退避；查 "x" "x" 等价于查 x
  return r.status === 'ok' ? r.total > 0 : null;
}

// ── 对照集 ──
let controls = JSON.parse(fs.readFileSync(path.join(here, 'controls-raw.json'), 'utf8'));
// PREREG R3：Swanson 鱼油↔雷诺氏今天必须判为已知连接，否则检索口径坏了
const R3 = { a: 'fish oil', c: "Raynaud's syndrome", relation: 'Swanson 1986 · 已被临床证实', _r3: true };
// PREREG R2：故意编造的一对，必须落进 unresolved / no_co_occurrence，不得被当成重大发现
const R2 = { a: 'Zorbaxine', c: 'Kleptophagia', relation: '故意编造，用于反向判据', _r2: true };
if (SMOKE) controls = controls.slice(0, SMOKE);
const items = [...controls, R3, R2];

const rows = [];
for (const it of items) {
  const r = await cooccur(it.a, it.c);
  let verdict;
  if (r.status !== 'ok') verdict = 'error';
  else if (r.total > 0) verdict = 'co_occurs';
  else {
    // 0 篇共现：先分清「没共现」还是「这个词本身查不着」
    const ea = await entityExists(it.a), ec = await entityExists(it.c);
    verdict = (ea === false || ec === false) ? 'unresolved' : 'no_co_occurrence';
  }
  rows.push({ ...it, verdict, total: r.total ?? null, sample: r.sample || [] });
  process.stderr.write(`\r${rows.length}/${items.length}  ${it.a} × ${it.c} → ${verdict}                    `);
}
process.stderr.write('\n');

const n = k => rows.filter(x => x.verdict === k).length;
const denom = n('co_occurs') + n('no_co_occurrence');
const falseEmpty = denom ? n('no_co_occurrence') / denom : null;

// ── PREREG 失败判据 ──
const failures = [];
const errRate = n('error') / rows.length;
if (errRate > 0.20) failures.push(`error 占比 ${(errRate * 100).toFixed(0)}% > 20%，网络不可靠，读数不可用`);
const r3 = rows.find(x => x._r3);
if (r3 && r3.verdict !== 'co_occurs') failures.push(`R3 不成立：Swanson 鱼油↔雷诺氏被判为 ${r3.verdict}，检索口径坏了`);
if (n('co_occurs') === 0) failures.push('R1 不成立：一对都没判为 co_occurs，探针可能对任何输入都报「查不到」');
const r2 = rows.find(x => x._r2);
const r2ok = !r2 || r2.verdict === 'unresolved' || r2.verdict === 'no_co_occurrence';

const prereg = crypto.createHash('sha256').update(fs.readFileSync(path.join(here, 'PREREG.md'))).digest('hex');
fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify({
  spec: 'lbd-probe/0.1', prereg_sha: prereg, smoke: SMOKE, used_api_key: !!KEY,
  question: 'ABC 模型「A-C 查不到 → 未被发现的连接」在教科书级已知关系上的假阳性率',
  counts: { co_occurs: n('co_occurs'), no_co_occurrence: n('no_co_occurrence'), unresolved: n('unresolved'), error: n('error') },
  false_empty_rate: falseEmpty,
  denominator_note: '分母只含成功解析的（co_occurs + no_co_occurrence）；unresolved 与 error 不进分母',
  reverse_cases: { R2_fabricated_pair: r2 ? r2.verdict : null, R2_ok: r2ok, R3_swanson: r3 ? r3.verdict : null },
  failures, rows
}, null, 1));

console.log(`\n对照 ${controls.length} 对（另加 R2 编造对、R3 Swanson 对）　PREREG ${prereg.slice(0, 16)}…`);
console.log(`  共现（朴素判据说「已知」）      ${n('co_occurs')}`);
console.log(`  0 篇（朴素判据说「新发现」）    ${n('no_co_occurrence')}  ← 假空`);
console.log(`  实体本身查不着                  ${n('unresolved')}  ← 不并入假空`);
console.log(`  接口失败                        ${n('error')}  ← 不并入任何结论`);
console.log(`\n假空率 = ${n('no_co_occurrence')}/${denom} = ${falseEmpty === null ? 'n/a' : (falseEmpty * 100).toFixed(1) + '%'}`);
console.log(`反向判据 R2（编造对）→ ${r2 ? r2.verdict : 'n/a'} ${r2ok ? '✔' : '✘ 被当成了新发现'}`);
console.log(`反向判据 R3（Swanson）→ ${r3 ? r3.verdict : 'n/a'}`);
if (failures.length) { console.log('\n本轮作废：'); failures.forEach(f => console.log('  ✘ ' + f)); process.exit(2); }
