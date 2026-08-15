#!/usr/bin/env node
// probe2.mjs — 空格探针 v0.2（三元氧化物）
//
// 第一轮的两个死因，这一轮各改一处，且都改成**结构性**的，不是注释：
//
//  死因 1：口径错。「恰好 N 种元素」≠「这个系统被研究过」。
//          → 改为原子分数阈值：目标元素占全式原子数 ≥ θ。
//  死因 2：对照在结果之后。50 个格子先进了脑子，才想起来做对照。
//          → 对照前置。控制不通过就 process.exit，一个格子都不产出。
//
// 还有一个第一轮末尾才看清的死因，这一轮靠换表解决：
//  死因 3：范畴错误。COD 索引的是**化合物**（定比相），Ti-6Al-4V 这类固溶体合金
//          在衍射上就报成「Ti」，Al/V 不进化学式。拿晶体结构库问合金系覆盖度，问错对象。
//          → 换成三元氧化物：定比相，正是晶体结构库覆盖得好的东西。
//
// 阈值选择规则**先于数据写下**（否则就是调参到自己喜欢的结论）：
//   取「使全部阳性对照非空、且全部阴性对照仍为空」的**最严**阈值；
//   不存在这样的阈值 → 停止，不产出任何格子。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, 'cache2.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const save = () => fs.writeFileSync(CACHE, JSON.stringify(cache));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'gap-probe/0.2 (research; mailto:HEFANGSHENG@gmail.com)';

const THETAS = [0.995, 0.99, 0.95, 0.90, 0.80, 0.70];

// 阳性对照：每一个都有名字、有工业或教科书地位，入选理由与探针输出无关。
const POS = [
  ['Ba-Ti-O', 'BaTiO₃ 钛酸钡，铁电陶瓷的教科书物质'],
  ['Sr-Ti-O', 'SrTiO₃ 钛酸锶，氧化物电子学最常用衬底'],
  ['Li-Co-O', 'LiCoO₂ 钴酸锂，锂电池正极'],
  ['Zn-Fe-O', 'ZnFe₂O₄ 锌铁尖晶石'],
  ['La-Al-O', 'LaAlO₃，LAO/STO 界面二维电子气'],
  ['Mg-Al-O', 'MgAl₂O₄ 尖晶石本尊'],
  ['Ca-Ti-O', 'CaTiO₃ 钙钛矿本尊（perovskite 一词的来源）'],
  ['Na-Nb-O', 'NaNbO₃ 无铅压电'],
  ['Li-Mn-O', 'LiMn₂O₄ 锰酸锂正极'],
  ['Y-Al-O', 'YAG/YAlO₃ 激光晶体']
];
// 阴性对照：应当为空。若它们非空，说明阈值太松或解析有误。
const NEG = [
  ['He-Ti-O', '氦不成化合物'],
  ['Ne-Fe-O', '氖不成化合物'],
  ['Ar-Al-O', '氩不成化合物']
];

const CATIONS = ['Li', 'Na', 'Mg', 'Ca', 'Sr', 'Ba', 'Ti', 'V', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Al', 'Y'];

const parseFormula = f => {
  const m = {};
  for (const tok of (f || '').replace(/-/g, ' ').trim().split(/\s+/)) {
    const g = /^([A-Z][a-z]?)([0-9]*\.?[0-9]*)$/.exec(tok);
    if (!g) continue;
    m[g[1]] = (m[g[1]] || 0) + (g[2] === '' ? 1 : parseFloat(g[2]));
  }
  return m;
};

const FAILED = Symbol('failed');

// 返回：各阈值下「目标元素占比 ≥ θ」的不同化学式数量。一次请求供全部阈值使用，
// 所以阈值扫描是免费的 —— 免费的敏感性分析没有理由不做。
// 失败原因必须留下来。第一版这里是 `catch { }` —— 静默吞掉异常，
// 于是 Mg-Al-O 连挂两轮而我完全不知道为什么（curl 打同一 URL 是 4.3MB/4.6s/2808 条，正常）。
// 一个不报告自己为什么失败的探针，和一个不报告自己丢了什么的投影，是同一个病。
const lastError = {};
async function cell(elements) {
  const key = elements.join(',');
  if (cache[key]) return cache[key];
  const qs = elements.map((e, i) => `el${i + 1}=${e}`).join('&');
  const url = `https://www.crystallography.net/cod/result.php?${qs}&format=json`;
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90000) });
      if (!r.ok) { lastError[key] = `HTTP ${r.status}`; await sleep(4000 * (a + 1)); continue; }
      const txt = await r.text();
      const out = { entries: 0, byTheta: {}, best: 0, bestFormula: '' };
      if (txt.trim() && txt.trim() !== '[]') {
        const j = JSON.parse(txt);
        out.entries = j.length;
        const seen = {};
        for (const th of THETAS) seen[th] = new Set();
        for (const row of j) {
          const m = parseFormula(row.formula);
          const tot = Object.values(m).reduce((x, y) => x + y, 0);
          if (!tot) continue;
          const frac = elements.reduce((s, e) => s + (m[e] || 0), 0) / tot;
          if (frac > out.best) { out.best = frac; out.bestFormula = (row.formula || '').trim(); }
          for (const th of THETAS) if (frac >= th) seen[th].add((row.formula || '').trim());
        }
        for (const th of THETAS) out.byTheta[th] = seen[th].size;
      } else {
        for (const th of THETAS) out.byTheta[th] = 0;
      }
      cache[key] = out; save();
      return out;
    } catch (e) { lastError[key] = `${e.name}: ${e.message}` + (e.cause ? ` | cause=${e.cause.code||e.cause.message||e.cause}` : ""); await sleep(4000 * (a + 1)); }
  }
  console.error(`    ✗ ${key} 三次失败，最后一次原因：${lastError[key] || "(未记录)"}`);
  return FAILED;
}

// ── 阶段 0：对照。前置，不通过就退出 ─────────────────────────────────────
console.log('阶段 0 —— 仪器标定（对照前置：不过就不跑全表）\n');
const posRes = [], negRes = [];
for (const [sys, why] of POS) {
  const r = await cell(sys.split('-').concat('O').filter((v, i, a) => a.indexOf(v) === i));
  posRes.push({ sys, why, r });
  console.log(`  阳性 ${sys.padEnd(9)} 条目=${r === FAILED ? '失败' : String(r.entries).padStart(4)}`
    + (r === FAILED ? '' : `  最高占比=${(r.best * 100).toFixed(1)}%  ${r.bestFormula.slice(0, 40)}`));
  await sleep(1200);
}
console.log('');
for (const [sys, why] of NEG) {
  const r = await cell(sys.split('-'));
  negRes.push({ sys, why, r });
  console.log(`  阴性 ${sys.padEnd(9)} 条目=${r === FAILED ? '失败' : String(r.entries).padStart(4)}`
    + (r === FAILED ? '' : `  最高占比=${(r.best * 100).toFixed(1)}%`));
  await sleep(1200);
}

// 「查询失败」与「对照没通过」必须分开报。第一版把两者并成一个数，于是
// 一次网络失败被显示成「没有任何阈值能通过标定」—— 这正是本探针 v0.1 死于其上的
// 同一个病（检索失败冒充全称否定），在同一份代码里第二次复发。
const posUnresolved = posRes.filter(p => p.r === FAILED);
const negUnresolved = negRes.filter(n => n.r === FAILED);

console.log('\n阈值扫描（阳性须全部非空，阴性须全部为空）：');
let chosen = null;
const resolvedPos = posRes.filter(p => p.r !== FAILED);
for (const th of THETAS) {
  const posOk = resolvedPos.filter(p => p.r.byTheta[th] > 0).length;
  const negBad = negRes.filter(n => n.r !== FAILED && n.r.byTheta[th] > 0).length;
  const ok = posOk === resolvedPos.length && negBad === 0 && posUnresolved.length === 0 && negUnresolved.length === 0;
  console.log(`  θ=${String(th).padEnd(6)} 阳性通过 ${posOk}/${resolvedPos.length}　阴性误报 ${negBad}　${ok ? '✔ 可用' : '✘'}`);
  if (ok && chosen === null) chosen = th;   // THETAS 从严到松，第一个通过的即最严
}

if (posUnresolved.length || negUnresolved.length) {
  console.log(`\n✘ 标定无法完成：${posUnresolved.length + negUnresolved.length} 个对照**查询失败**`
    + `（${[...posUnresolved, ...negUnresolved].map(x => x.sys).join(', ')}）。`);
  console.log('  这不是「对照没通过」，是「不知道」。重跑即可（结果有缓存，只会重查失败的那几个）。');
  process.exit(3);
}

if (chosen === null) {
  console.log('\n✘ 没有任何阈值能同时通过阳性与阴性对照。');
  console.log('  按先于数据写下的规则：停止，不产出任何格子。');
  fs.writeFileSync(path.join(HERE, 'result2.json'), JSON.stringify(
    { stage: 'calibration-failed', thetas: THETAS, positives: posRes.map(p => ({ ...p, r: p.r === FAILED ? 'FAILED' : p.r })),
      negatives: negRes.map(n => ({ ...n, r: n.r === FAILED ? 'FAILED' : n.r })) }, null, 2));
  process.exit(2);
}
console.log(`\n✔ 标定通过，采用最严可用阈值 θ=${chosen}\n`);

// ── 阶段 1：全表 ─────────────────────────────────────────────────────────
const pairs = [];
for (let i = 0; i < CATIONS.length; i++)
  for (let j = i + 1; j < CATIONS.length; j++) pairs.push([CATIONS[i], CATIONS[j]]);

console.log(`阶段 1 —— 全表：${CATIONS.length} 种阳离子 → ${pairs.length} 个三元氧化物系`);
// ── 二元边：不查，写成显式假设 ────────────────────────────────────────────
// 两个理由，都要写下来，否则下一个人会以为这里偷懒了：
//  (1) 信息量为零。这 16 种阳离子全部形成二元氧化物（Li₂O MgO TiO₂ Al₂O₃ …），
//      是教科书事实，查询结果必然全部非空，判据不可能因它变红。
//  (2) 代价极高。COD 的 `el1=Al&el2=O` 是超集语义，会拉回所有含铝含氧的化合物
//      ——硅酸盐全中，几十 MB，实测把 v0.2 第一次全表跑挂在这一步。
//
// **代价必须披露**：邻域密度控制在氧化物这张表上是**空转**的。
// 于是挡在「产出格子」与「产出假格子」之间的，只剩标定集这一道闸。
const KNOWN_BINARY_OXIDE = { Li: 'Li₂O', Na: 'Na₂O', Mg: 'MgO', Ca: 'CaO', Sr: 'SrO', Ba: 'BaO',
  Ti: 'TiO₂', V: 'V₂O₅', Mn: 'MnO₂', Fe: 'Fe₂O₃', Co: 'CoO', Ni: 'NiO', Cu: 'CuO', Zn: 'ZnO',
  Al: 'Al₂O₃', Y: 'Y₂O₃' };
const missingOxide = CATIONS.filter(c => !KNOWN_BINARY_OXIDE[c]);
if (missingOxide.length) { console.error(`调色板含未声明二元氧化物的阳离子：${missingOxide}`); process.exit(1); }
const binaryOxide = Object.fromEntries(CATIONS.map(c => [c, 1]));  // 1 = 已知非空（未查询）
const stats = { ok: 0, failed: 0, edgesAssumedNotQueried: CATIONS.length };
console.log(`  二元边：${CATIONS.length} 条按教科书事实假定非空，未查询（理由见源码注释）`);
const holes = [], rej = { filled: 0, edgeEmpty: 0, unresolved: 0 };
for (const [i, [a, b]] of pairs.entries()) {
  const r = await cell([a, b, 'O']);
  if (r === FAILED) { stats.failed++; rej.unresolved++; await sleep(1200); continue; }
  stats.ok++;
  const n = r.byTheta[chosen];
  const ea = binaryOxide[a], eb = binaryOxide[b];
  if (ea === FAILED || eb === FAILED) rej.unresolved++;
  else if (n > 0) rej.filled++;
  else if (ea === 0 || eb === 0) rej.edgeEmpty++;
  else holes.push({ system: `${a}-${b}-O`, edges: { [`${a}-O`]: ea, [`${b}-O`]: eb },
                    edgeMin: Math.min(ea, eb), entriesSuperset: r.entries,
                    bestFraction: +(r.best * 100).toFixed(1), bestFormula: r.bestFormula });
  if ((i + 1) % 15 === 0) process.stderr.write(`  ${i + 1}/${pairs.length}\n`);
  await sleep(1200);
}
holes.sort((x, y) => y.edgeMin - x.edgeMin);

const out = { stage: 'complete', theta: chosen, cations: CATIONS, thetas: THETAS,
  calibration: { positives: posRes.map(p => ({ sys: p.sys, why: p.why, atTheta: p.r === FAILED ? 'FAILED' : p.r.byTheta[chosen] })),
                 negatives: negRes.map(n => ({ sys: n.sys, atTheta: n.r === FAILED ? 'FAILED' : n.r.byTheta[chosen] })) },
  coverage: stats, verdict: { holes: holes.length, filled: rej.filled, edgeEmpty: rej.edgeEmpty, unresolved: rej.unresolved },
  binaryOxide, holes };
fs.writeFileSync(path.join(HERE, 'result2.json'), JSON.stringify(out, null, 2));

console.log(`\n三元氧化物系 ${pairs.length}：已观测 ${rej.filled}　| 边为空 ${rej.edgeEmpty}　| 无法判定 ${rej.unresolved}　| ✦ 格子 ${holes.length}`);
console.log(`查询成功 ${stats.ok}　失败 ${stats.failed}`);
for (const h of holes.slice(0, 20))
  console.log(`  ${h.system.padEnd(10)} 边=${Object.values(h.edges).join('/')}  超集条目=${h.entriesSuperset}  最高占比=${h.bestFraction}%`);
console.log(`\n→ demo/gap-probe/result2.json`);
