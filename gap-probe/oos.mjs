#!/usr/bin/env node
// oos.mjs — 样本外检验（预注册）
//
// 前三轮所有准确率都是**样本内**的，而且「半径」这个特征是看过异常之后才选的。
// 这一轮做唯一还没用过的那件事，也是门捷列夫的那一条：
//
//   **预测在数据之前被冻结。** 他的镓预测算数，是因为它写在镓被发现之前。
//
// 顺序是硬的，由代码强制：
//   phase A  用规律算出全部预测 → 写 PREREG-oos.json → 打印 sha256
//   phase B  只有当盘上的 PREREG 与重算结果逐字节一致时，才允许发第一个查询
// 若有人先查了数据再改预测，PREREG 的哈希对不上，phase B 直接拒绝运行。
//
// 用法：
//   node demo/gap-probe/oos.mjs --prereg   # 只冻结，不发任何请求
//   node demo/gap-probe/oos.mjs --run      # 校验冻结件后开查
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PREREG = path.join(HERE, 'PREREG-oos.json');
const radii = JSON.parse(fs.readFileSync(path.join(HERE, 'shannon.json'), 'utf8'));

// ── 先于数据写死的一切 ───────────────────────────────────────────────────
const NEW = ['K', 'Zr', 'Nb', 'La', 'Cd', 'Pb'];              // 六种前三轮从未用过的阳离子
const OLD8 = ['Li', 'Na', 'Mg', 'Ca', 'Sr', 'Ba', 'Ti', 'V']; // 原调色板按原列出顺序取前 8，非挑选
const VALENCES = {
  Li: [1], Na: [1], Mg: [2], Ca: [2], Sr: [2], Ba: [2], Ti: [2, 3, 4], V: [2, 3, 4, 5],
  K: [1], Zr: [4], Nb: [3, 4, 5], La: [3], Cd: [2], Pb: [2, 4]
};
const RULE = 'dq>=1';           // 第三轮实测最优；此处冻结，不再调
const THETA = 0.995;            // 第二轮标定给出的最严可用阈值；此处冻结，不再调
// 成功判据也先写死，否则事后总能找到一个让自己好看的说法：
const SUCCESS = '样本外 McNemar（规律 vs 平凡解「永远回答有」）双侧 p < 0.05 才算规律有预测力；'
              + '否则判定：该规律在样本外与平凡解不可区分。';

function radius(el, ox) {
  const b = radii[el]?.[ox]; if (!b) return null;
  const cns = Object.keys(b).map(Number).sort((x, y) => Math.abs(x - 6) - Math.abs(y - 6));
  const s = b[String(cns[0])];
  const v = s.only_spin ?? s.high_spin ?? s.low_spin ?? Object.values(s)[0];
  return typeof v === 'number' ? v : null;
}
function diff(a, b) {
  let dq = 0, ratio = 1;
  for (const qa of VALENCES[a]) for (const qb of VALENCES[b]) {
    const ra = radius(a, String(qa)), rb = radius(b, String(qb));
    if (ra == null || rb == null) continue;
    dq = Math.max(dq, Math.abs(qa - qb));
    ratio = Math.max(ratio, Math.max(ra, rb) / Math.min(ra, rb));
  }
  return { dq, ratio: +ratio.toFixed(4) };
}

// 单元格集合的构造规则也是确定性的：新×新 全部 + 新×旧8 全部
const cells = [];
for (let i = 0; i < NEW.length; i++) {
  for (let j = i + 1; j < NEW.length; j++) cells.push([NEW[i], NEW[j]]);
  for (const o of OLD8) cells.push([NEW[i], o]);
}
const predictions = cells.map(([a, b]) => {
  const d = diff(a, b);
  return { sys: `${a}-${b}-O`, a, b, dq: d.dq, ratio: d.ratio, predict: d.dq >= 1 ? '有序三元相' : '空' };
});

const prereg = {
  what: '三元氧化物「是否存在有序相」的样本外预测，预测在任何查询之前冻结',
  rule: RULE, ruleText: '存在一组常见氧化态指派使 |q_A − q_B| ≥ 1 → 预测该系统存在有序三元相',
  theta: THETA, thetaText: '判定「存在」的口径：COD 中目标元素原子分数 ≥ 0.995 的不同化学式数 > 0',
  newCations: NEW, oldSubset: OLD8, oldSubsetRule: '原 16 阳离子按 result2.json 中列出顺序取前 8，未挑选',
  cellRule: '新×新 全部 + 新×旧8 全部',
  successCriterion: SUCCESS,
  nCells: predictions.length,
  predictedFilled: predictions.filter(p => p.predict !== '空').length,
  predictedEmpty: predictions.filter(p => p.predict === '空').length,
  predictions
};
const body = JSON.stringify(prereg, null, 2);
const sha = crypto.createHash('sha256').update(body).digest('hex');

if (process.argv.includes('--prereg')) {
  if (fs.existsSync(PREREG)) {
    const old = fs.readFileSync(PREREG, 'utf8');
    const oldSha = crypto.createHash('sha256').update(old).digest('hex');
    console.log(oldSha === sha ? '冻结件已存在且一致，未改动。' : '⚠ 盘上冻结件与重算不一致，拒绝覆盖。');
    console.log(`  盘上 sha256 = ${oldSha}`);
    process.exit(oldSha === sha ? 0 : 4);
  }
  fs.writeFileSync(PREREG, body);
  console.log(`已冻结 → demo/gap-probe/PREREG-oos.json`);
  console.log(`  单元格 ${prereg.nCells} 个：预测「有」${prereg.predictedFilled}　预测「空」${prereg.predictedEmpty}`);
  console.log(`  规则 ${RULE}　口径 θ=${THETA}`);
  console.log(`  sha256 = ${sha}`);
  console.log(`\n成功判据（先写死）：${SUCCESS}`);
  process.exit(0);
}

// ── phase B：校验冻结件后才允许查询 ──────────────────────────────────────
if (!fs.existsSync(PREREG)) { console.error('没有冻结件，先跑 --prereg'); process.exit(1); }
const onDisk = fs.readFileSync(PREREG, 'utf8');
const onDiskSha = crypto.createHash('sha256').update(onDisk).digest('hex');
if (onDiskSha !== sha) {
  console.error('✘ 冻结件与当前代码重算结果不一致 —— 拒绝查询。');
  console.error(`  盘上 ${onDiskSha}\n  重算 ${sha}`);
  console.error('  这正是本轮要防的事：先看数据再改预测。');
  process.exit(4);
}
console.log(`冻结件校验通过 sha256=${sha.slice(0, 16)}…　开始查询 ${predictions.length} 个单元格\n`);

const CACHE = path.join(HERE, 'cache-oos.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'gap-probe/0.3 (research; mailto:HEFANGSHENG@gmail.com)';
const parse = f => { const m = {}; for (const t of (f || '').replace(/-/g, ' ').trim().split(/\s+/)) {
  const g = /^([A-Z][a-z]?)([0-9]*\.?[0-9]*)$/.exec(t); if (g) m[g[1]] = (m[g[1]] || 0) + (g[2] === '' ? 1 : parseFloat(g[2])); } return m; };

const lastErr = {};
async function cell(a, b) {
  const k = `${a},${b},O`;
  if (cache[k]) return cache[k];
  const url = `https://www.crystallography.net/cod/result.php?el1=${a}&el2=${b}&el3=O&format=json`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
      if (!r.ok) { lastErr[k] = `HTTP ${r.status}`; await sleep(4000 * (i + 1)); continue; }
      const txt = await r.text();
      const out = { entries: 0, n: 0, best: 0, bestFormula: '' };
      if (txt.trim() && txt.trim() !== '[]') {
        const j = JSON.parse(txt); out.entries = j.length; const seen = new Set();
        for (const row of j) { const m = parse(row.formula);
          const tot = Object.values(m).reduce((x, y) => x + y, 0); if (!tot) continue;
          const fr = ((m[a] || 0) + (m[b] || 0) + (m.O || 0)) / tot;
          if (fr > out.best) { out.best = fr; out.bestFormula = (row.formula || '').trim(); }
          if (fr >= THETA) seen.add((row.formula || '').trim()); }
        out.n = seen.size;
      }
      cache[k] = out; fs.writeFileSync(CACHE, JSON.stringify(cache));
      return out;
    } catch (e) { lastErr[k] = `${e.name}: ${e.message}`; await sleep(4000 * (i + 1)); }
  }
  console.error(`    ✗ ${k} 三次失败：${lastErr[k]}`);
  return null;
}

const rows = [];
for (const [i, p] of predictions.entries()) {
  const r = await cell(p.a, p.b);
  rows.push({ ...p, observed: r === null ? null : r.n > 0, n: r?.n ?? null, best: r?.bestFormula ?? null });
  if ((i + 1) % 10 === 0) process.stderr.write(`  ${i + 1}/${predictions.length}\n`);
  await sleep(1200);
}

const R = rows.filter(r => r.observed !== null);
const nObs = R.filter(r => r.observed).length;
const base = nObs / R.length;
const acc = R.filter(r => (r.predict !== '空') === r.observed).length / R.length;
let b2 = 0, c2 = 0;
for (const r of R) { const triv = true;
  const rb = triv === r.observed, rr = (r.predict !== '空') === r.observed;
  if (rb && !rr) b2++; else if (!rb && rr) c2++; }
const n = b2 + c2;
const lc = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
let cum = 0; for (let i = 0; i <= Math.min(b2, c2); i++) cum += Math.exp(lc(n, i) - n * Math.log(2));
const p = n ? Math.min(1, 2 * cum) : 1;

console.log(`\n样本外结果（预注册 sha256=${sha.slice(0, 16)}…）`);
console.log(`  可判定 ${R.length}/${predictions.length}　查询失败 ${predictions.length - R.length}（记为不知道，不记为空）`);
console.log(`  实际已观测 ${nObs}　实际空 ${R.length - nObs}`);
console.log(`  平凡解「永远回答有」 ${(base * 100).toFixed(1)}%`);
console.log(`  规律 ${RULE}          ${(acc * 100).toFixed(1)}%   比平凡解 ${((acc - base) * 100).toFixed(1)} 分`);
console.log(`  McNemar 不一致对 ${b2} vs ${c2}　双侧 p = ${p.toFixed(3)}`);
console.log(`  → 按先写死的成功判据：${p < 0.05 ? '✔ 规律有预测力' : '✘ 与平凡解不可区分'}`);
console.log('\n规律预测「空」而实际也空的格子（唯一有资格叫「格子」的）：');
for (const r of R.filter(r => r.predict === '空' && !r.observed)) console.log(`  ${r.sys}`);
console.log('\n规律预测「空」却实际有的（反例，规律该修）：');
for (const r of R.filter(r => r.predict === '空' && r.observed)) console.log(`  ${r.sys}  ${r.best}`);
fs.writeFileSync(path.join(HERE, 'result-oos.json'), JSON.stringify({ preregSha: sha, base, acc, mcnemar: { b: b2, c: c2, p }, rows }, null, 2));
