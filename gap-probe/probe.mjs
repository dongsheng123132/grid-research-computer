#!/usr/bin/env node
// probe.mjs — 空格探针 v0.1
//
// 要回答的问题不是「有哪些 gap」，而是**「空」这件事能不能被机械地举证**。
//
// 门捷列夫的逻辑不是「这里是空的」，是「这里在满格的包围里是空的」。
// 孤立的空白只说明没人关心；稠密邻域里的洞，要么该有人做，要么有个理由做不了。
// 所以判据是：三元系在实验层为空 ∧ 它的三条二元边在实验层都非空。
//
// 两层表，两个独立来源：
//   COD   (crystallography.net) — 实验观测到的晶体结构。这是「谁真的做出来过」。
//   AFLOW (aflow.org/API/aflux) — 高通量 DFT。这是「算出来应该稳定」。
// 二者之差 = 「算着稳定但没人做出来」= 可证伪的定量预测。
//
// **邻域密度同时是数据库覆盖偏差的对照**：COD 对金属间化合物的收录弱于 ICSD，
// 若某三元系为空只是因为 COD 不收这类物质，那它的三条二元边也会是空的。
// 要求三条边都稠密，就把「库不收」和「没人做」分开了。这是本探针唯一的控制手段，
// 它不完备 —— 局限写在 REPORT 的「已知未覆盖」一节，不藏。
//
// 用法：
//   node demo/gap-probe/probe.mjs            # 跑（带缓存，可断点续跑）
//   node demo/gap-probe/probe.mjs --report   # 只从缓存出报告，不发请求
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, 'cache.json');
const REPORT_ONLY = process.argv.includes('--report');

// 元素调色板：常见金属 + 常见主族。选它们是因为二元边大概率稠密——
// 稠密邻域是本判据成立的前提，调色板选稀有元素会让整张表退化成「全是空的」。
const PALETTE = ['Fe', 'Co', 'Ni', 'Mn', 'Cr', 'Ti', 'V', 'Al', 'Cu', 'Zn', 'Mg', 'Sn'];

const UA = 'gap-probe/0.1 (research; mailto:HEFANGSHENG@gmail.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const saveCache = () => fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));

// 失败必须与「查到 0 条」区分开。把它们混为一谈，就是用检索失败冒充全称否定——
// 那正是本仓库反复抓的那个病（存在性检查冒充验证的镜像版本）。
const FAILED = Symbol('failed');

async function codCount(elements) {
  const key = 'cod:' + elements.join(',');
  if (key in cache) return cache[key];
  const qs = elements.map((e, i) => `el${i + 1}=${e}`).join('&');
  const url = `https://www.crystallography.net/cod/result.php?${qs}`
    + `&strictmin=${elements.length}&strictmax=${elements.length}&format=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) { await sleep(3000 * (attempt + 1)); continue; }
      const txt = await r.text();
      // COD 无命中时返回空串或空数组，两者都是「真的 0 条」，与网络失败不同。
      if (txt.trim() === '' || txt.trim() === '[]') { cache[key] = 0; return 0; }
      const j = JSON.parse(txt);
      if (!Array.isArray(j)) { await sleep(3000); continue; }
      const formulas = [...new Set(j.map(x => (x.formula || '').trim()).filter(Boolean))];
      cache[key] = formulas.length;
      cache[key + ':entries'] = j.length;
      cache[key + ':sample'] = formulas.slice(0, 3);
      return cache[key];
    } catch { await sleep(3000 * (attempt + 1)); }
  }
  return FAILED;
}

const pairs = [], triples = [];
for (let i = 0; i < PALETTE.length; i++) {
  for (let j = i + 1; j < PALETTE.length; j++) {
    pairs.push([PALETTE[i], PALETTE[j]]);
    for (let k = j + 1; k < PALETTE.length; k++) triples.push([PALETTE[i], PALETTE[j], PALETTE[k]]);
  }
}

const stats = { attempted: 0, ok: 0, failed: 0, cached: 0 };
async function run(list, label) {
  const out = new Map();
  for (const [idx, els] of list.entries()) {
    const key = 'cod:' + els.join(',');
    const wasCached = key in cache;
    if (REPORT_ONLY && !wasCached) { out.set(els.join('-'), FAILED); continue; }
    const n = wasCached ? cache[key] : await codCount(els);
    stats.attempted++;
    if (wasCached) stats.cached++;
    if (n === FAILED) stats.failed++; else stats.ok++;
    out.set(els.join('-'), n);
    if (!wasCached) { await sleep(1100); if (stats.attempted % 20 === 0) saveCache(); }
    if ((idx + 1) % 25 === 0) process.stderr.write(`  ${label} ${idx + 1}/${list.length}\n`);
  }
  saveCache();
  return out;
}

process.stderr.write(`调色板 ${PALETTE.length} 元素 → 二元 ${pairs.length} 条、三元 ${triples.length} 条\n`);
const binCount = await run(pairs, '二元');
const terCount = await run(triples, '三元');

// ── 判据：三元为空 ∧ 三条边都非空 ────────────────────────────────────────
const holes = [], notHoles = { ternaryFilled: 0, edgeSparse: 0, unresolved: 0 };
for (const els of triples) {
  const t = terCount.get(els.join('-'));
  const edges = [[els[0], els[1]], [els[0], els[2]], [els[1], els[2]]].map(p => binCount.get(p.join('-')));
  if (t === FAILED || edges.some(e => e === FAILED)) { notHoles.unresolved++; continue; }
  if (t > 0) { notHoles.ternaryFilled++; continue; }
  if (edges.some(e => e === 0)) { notHoles.edgeSparse++; continue; }
  holes.push({ system: els.join('-'), edges: Object.fromEntries(
    [[els[0], els[1]], [els[0], els[2]], [els[1], els[2]]].map(p => [p.join('-'), binCount.get(p.join('-'))]) ),
    edgeMin: Math.min(...edges), edgeSum: edges.reduce((a, b) => a + b, 0) });
}
holes.sort((a, b) => b.edgeMin - a.edgeMin || b.edgeSum - a.edgeSum);

const report = {
  palette: PALETTE,
  queried: { binaries: pairs.length, ternaries: triples.length },
  coverage: stats,
  verdict: {
    holes: holes.length,
    ternaryAlreadyFilled: notHoles.ternaryFilled,
    rejectedBecauseAnEdgeIsAlsoEmpty: notHoles.edgeSparse,
    unresolvedDueToQueryFailure: notHoles.unresolved
  },
  holes
};
fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(report, null, 2));

console.log(`\n调色板：${PALETTE.join(' ')}`);
console.log(`查询：二元 ${pairs.length} 条、三元 ${triples.length} 条　成功 ${stats.ok}　失败 ${stats.failed}`);
console.log(`\n三元系判决：`);
console.log(`  已被实验观测（非空）           ${notHoles.ternaryFilled}`);
console.log(`  空，但至少一条边也空（不算格子） ${notHoles.edgeSparse}`);
console.log(`  查询失败，无法判定             ${notHoles.unresolved}   ← 这不是 0，是不知道`);
console.log(`  ✦ 格子（空 ∧ 三边皆非空）      ${holes.length}`);
if (holes.length) {
  console.log(`\n按最弱边排序的前 15 个格子（最弱边越高＝邻域越稠密＝洞越可疑）：`);
  for (const h of holes.slice(0, 15)) {
    console.log(`  ${h.system.padEnd(12)} 最弱边=${String(h.edgeMin).padStart(3)}  三边=${Object.values(h.edges).join('/')}`);
  }
}
console.log(`\n完整结果 → demo/gap-probe/result.json`);
