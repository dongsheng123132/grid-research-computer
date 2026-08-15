#!/usr/bin/env node
// probe.mjs — 天文版「假空格」探针：把材料那个错误原样搬到另一个学科
//
// 被复刻的错误（demo/gap-probe，2026-08-11）：
//   「COD 里**恰好**含这三种元素的条目数 = 0 → 判定该三元系从未被合成」
//   击穿它的是 Fe-Cr-Ni ——304/316 不锈钢的基体。错因不是代码，是**操作化定义**：
//   不锈钢以多组分固溶体存在，永远不会「恰好三元」。
//
// 同构的天文错误：
//   「参考库里**恰好**这个名字的条目数 = 0 → 判定该源未编目、是新发现候选」
//   错因同型：同一天体有 N 个名字，你手里那个写法未必是库里的主名。
//
// 这不是稻草人。暂现源搜寻里「新源」其实是已知变星，是真实且常见的事故类型。
//
// 三态判决（**这是本探针的承重点**，与 gap-probe 的 UNKNOWN/FAILED/NEGATIVE 同构）：
//   resolved_exact      SIMBAD 认识，且主名与查询串逐字相同 → 朴素口径也判「已编目」✓
//   resolved_different  SIMBAD 认识，但主名 ≠ 查询串       → **朴素口径误判为「未编目」= 假空**
//   unresolved          SIMBAD 不认识                       → **单独计数，绝不并入假空**
//
// 最后一档为什么必须单独：它有两种成因——别名是 hermes 编的，或 SIMBAD 覆盖不到。
// 把「我问错了」混进「世界上没有」，正是本项目要抓的那个病。混进去就等于自己复发一次。
//
// 用法：node demo/sky-probe/probe.mjs [--limit N]
// 退出码：0 = 跑完（判决由 verify-sky-probe.mjs 给）　1 = 前提不成立

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(here, 'cache.json');
const OUT = path.join(here, 'result.json');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? +process.argv[i + 1] : Infinity; })();

const controls = JSON.parse(fs.readFileSync(path.join(here, 'controls-raw.json'), 'utf8'));
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};

/** SIMBAD 按标识符查询。只观察，不判断——判断在下面第二步做。 */
async function simbad(ident) {
  if (cache[ident] !== undefined) return cache[ident];
  const url = 'https://simbad.u-strasbg.fr/simbad/sim-id?output.format=ASCII&Ident='
    + encodeURIComponent(ident);
  let text = null;
  for (let attempt = 0; attempt < 3 && text === null; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000) });
      text = await r.text();
    } catch { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
  }
  // 网络失败与「库里没有」是两回事，前者返回 null 让上层记成 error 而不是 unresolved
  const rec = text === null ? null : parse(text);
  cache[ident] = rec;
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  await new Promise(r => setTimeout(r, 350));   // 对公共服务克制一点
  return rec;
}

function parse(text) {
  if (/not found in the database|Identifier not found/i.test(text)) return { found: false };
  const m = text.match(/^Object\s+(.+?)\s+---/m);
  if (!m) return { found: false, note: 'no Object line' };
  const type = (text.match(/^Object\s+.+?\s+---\s+(\S+)\s+---/m) || [])[1] || '';
  return { found: true, main_id: m[1].trim(), type };
}

/** 朴素流水线的判据：**逐字相同才算找到**。归一化只做大小写与空白折叠——
 *  再宽就不是「恰好」了，那会把被测的错误偷偷修掉。 */
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const naiveFound = (query, main_id) => norm(query) === norm(main_id);

// 主名方向检验：不是别名，是**两个目录编号互相当主名**的一对。
// M 44 的主名是 NGC 2632，而 NGC 7078 的主名是 M 15 —— 方向相反。
// 这意味着「主名会是哪种编号」没有可依赖的规则，于是精确匹配的失败**不可预测**。
// 单独列出来是因为它不是覆盖率问题，是规则一致性问题。
const DIRECTION_CHECK = [
  { canonical: 'M 44', alias: 'M 44' },
  { canonical: 'M 15', alias: 'NGC 7078' },
];

const rows = [];
for (const d of DIRECTION_CHECK) {
  const r = await simbad(d.alias);
  if (r && r.found) rows.push({
    canonical: d.canonical, alias: d.alias, main_id: r.main_id, type: r.type,
    probe: 'direction',
    verdict: naiveFound(d.alias, r.main_id) ? 'resolved_exact' : 'resolved_different'
  });
}

let n = 0;
for (const c of controls) {
  if (n++ >= LIMIT) break;
  for (const alias of c.aliases || []) {
    const r = await simbad(alias);
    if (r === null) { rows.push({ canonical: c.canonical, alias, verdict: 'error' }); continue; }
    if (!r.found) { rows.push({ canonical: c.canonical, alias, verdict: 'unresolved' }); continue; }
    rows.push({
      canonical: c.canonical, alias, main_id: r.main_id, type: r.type,
      verdict: naiveFound(alias, r.main_id) ? 'resolved_exact' : 'resolved_different'
    });
  }
  process.stderr.write(`\r核到 ${n}/${controls.length}  查询 ${rows.length} 次   `);
}
process.stderr.write('\n');

const tally = k => rows.filter(r => r.verdict === k).length;
const coverage = {
  attempted: rows.length,
  ok: rows.length - tally('error'),
  error: tally('error'),
  cached: Object.keys(cache).length
};
const verdict = {
  resolved_exact: tally('resolved_exact'),
  resolved_different: tally('resolved_different'),   // ← 假空：朴素口径会判「未编目」
  unresolved: tally('unresolved'),                   // ← 不并入假空
};
// 假空率的分母只能是**成功解析的**那些：把 unresolved 和 error 算进分母，
// 等于用「我没查着」去撑「流水线会误判」这个结论。分母不老实，比率就是装饰。
const denom = verdict.resolved_exact + verdict.resolved_different;
const falseEmptyRate = denom ? verdict.resolved_different / denom : null;

fs.writeFileSync(OUT, JSON.stringify({
  spec: 'sky-probe/0.1',
  question: '「参考库里恰好这个名字查不到 → 未编目/新发现候选」这个朴素判据，在教科书级天体上的假空率',
  controls: controls.length, coverage, verdict,
  false_empty_rate: falseEmptyRate,
  denominator_note: '分母只含成功解析的查询；unresolved / error 单独计数，不并入',
  rows
}, null, 1));

console.log(`对照天体 ${controls.length} 个，别名查询 ${coverage.attempted} 次（成功 ${coverage.ok}，网络失败 ${coverage.error}）`);
console.log(`  逐字命中          ${verdict.resolved_exact}`);
console.log(`  SIMBAD 认识但主名不同 ${verdict.resolved_different}  ← 朴素口径会判「未编目」`);
console.log(`  SIMBAD 不认识      ${verdict.unresolved}  ← 单独计数，不并入假空`);
console.log(`假空率 = ${verdict.resolved_different}/${denom} = ${falseEmptyRate === null ? 'n/a' : (falseEmptyRate * 100).toFixed(1) + '%'}`);
