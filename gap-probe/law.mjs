#!/usr/bin/env node
// law.mjs — 排布规律 v0.1（三元氧化物是否形成有序相）
//
// 前三轮找的是「空格」，这一轮找的是**规律**——门捷列夫真正的那把钥匙：
// 表的结构本身是发现，空格只是结构的推论。
//
// 规律陈述（可被推翻）：
//   A-B-O 形成有序三元相，当且仅当存在一组常见氧化态指派，使 A、B 在
//   **电荷或离子尺寸**上产生分化（大离子占 A 位、小离子占 B 位）。
//
// 两处对前一版的修正，都是被数据逼出来的：
//   1) 多价必须枚举。上一版把 Mn 定死 +4、Co 定死 +2，于是 Mn₂TiO₄（Mn 是 +2）
//      和 MgCo₂O₄（Co 是 +3）被当成「同价却有序」的反例——反例是我自己造的。
//   2) 尺寸必须进来。Y₃Fe₅O₁₂（YIG）与 YAlO₃ 两个阳离子都是 +3，纯电荷判据解释不了；
//      而 Y³⁺ 0.90 Å vs Al³⁺ 0.535 Å 差得极远。Goldschmidt 用半径不用电荷，原因就在这儿。
//
// ⚠ **样本内污染声明**：radius 这个特征是在看过本数据集的异常之后选的。
//    下面所有在这 116 个格子上的准确率都**不作数**，只用于生成假设。
//    真正的检验必须换一批阳离子做样本外，规则先写下、阈值先冻结。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const radii = JSON.parse(fs.readFileSync(path.join(HERE, 'shannon.json'), 'utf8'));
const result = JSON.parse(fs.readFileSync(path.join(HERE, 'result2.json'), 'utf8'));
const cache = JSON.parse(fs.readFileSync(path.join(HERE, 'cache2.json'), 'utf8'));

// 常见氧化态（教科书值；多价元素全部列出，不挑）
const VALENCES = {
  Li: [1], Na: [1], Mg: [2], Ca: [2], Sr: [2], Ba: [2],
  Ti: [2, 3, 4], V: [2, 3, 4, 5], Mn: [2, 3, 4], Fe: [2, 3],
  Co: [2, 3], Ni: [2, 3], Cu: [1, 2], Zn: [2], Al: [3], Y: [3]
};

// Shannon 半径：统一取 CN=6 作为比较基准（缺失则取最接近的配位数）。
// 统一基准是必要的——不同配位数的半径不可直接比大小。
function radius(el, ox) {
  const byOx = radii[el]; if (!byOx || !byOx[ox]) return null;
  const byCN = byOx[ox];
  const cns = Object.keys(byCN).map(Number).sort((a, b) => Math.abs(a - 6) - Math.abs(b - 6));
  if (!cns.length) return null;
  const spins = byCN[String(cns[0])];
  const v = spins.only_spin ?? spins.high_spin ?? spins.low_spin ?? Object.values(spins)[0];
  return typeof v === 'number' ? v : null;
}

// 分化程度：在所有氧化态指派里取最大分化。
// 「取最大」是有理由的：阳离子会自己选价态去分化，不是被我们指定的。
function differentiation(a, b) {
  let bestDq = 0, bestRatio = 1, note = '';
  for (const qa of VALENCES[a]) for (const qb of VALENCES[b]) {
    const ra = radius(a, String(qa)), rb = radius(b, String(qb));
    if (ra == null || rb == null) continue;
    const dq = Math.abs(qa - qb);
    const ratio = Math.max(ra, rb) / Math.min(ra, rb);
    if (dq > bestDq) bestDq = dq;
    if (ratio > bestRatio) { bestRatio = ratio; note = `${a}${qa}+(${ra}) / ${b}${qb}+(${rb})`; }
  }
  return { dq: bestDq, ratio: bestRatio, note };
}

const C = result.cations;
const holeSet = new Set(result.holes.map(h => h.system));
const cells = [];
for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
  const a = C[i], b = C[j];
  if (!cache[[a, b, 'O'].join(',')]) continue;                 // 查询失败 → 不判定，不当成 0
  const observed = !holeSet.has(`${a}-${b}-O`);
  cells.push({ a, b, sys: `${a}-${b}-O`, observed, ...differentiation(a, b) });
}

const cm = pred => {
  const t = { TP: 0, FP: 0, TN: 0, FN: 0 };
  for (const c of cells) {
    const p = pred(c);
    if (p && c.observed) t.TP++; else if (p && !c.observed) t.FP++;
    else if (!p && !c.observed) t.TN++; else t.FN++;
  }
  t.acc = (t.TP + t.TN) / cells.length;
  return t;
};
const show = (name, t) => console.log(`  ${name.padEnd(30)} 准确率 ${(t.acc * 100).toFixed(1)}%  比平凡解 ${gain(t).padStart(7)}`
  + `　(真有 ${t.TP} 误报 ${t.FP} 真空 ${t.TN} 漏报 ${t.FN})`);

console.log(`可判定格子 ${cells.length} 个（已观测 ${cells.filter(c => c.observed).length}，空 ${cells.filter(c => !c.observed).length}）`);
console.log('⚠ 以下全部是**样本内**数字，特征在看过数据后才选，不作数。\n');

// ── 平凡解对照 ──────────────────────────────────────────────────────────
// 这一段是补的。第一版没有它，于是「规律解释了异常」这句话差点被我说出口——
// 而实际上「永远回答有」这个什么都不算的常数预测器，就已经拿到 77.6%。
// 本仓库反复抓的病：一个数字，能不能在没有被测机制的情况下被产生出来。
const nObs = cells.filter(c => c.observed).length;
const BASE = { alwaysFilled: nObs / cells.length, alwaysEmpty: 1 - nObs / cells.length };
const baseline = Math.max(BASE.alwaysFilled, BASE.alwaysEmpty);
console.log('平凡解对照（必须先看这个，任何规律都要减掉它）：');
console.log(`  永远回答「有」　　　　　　　　　　　 准确率 ${(BASE.alwaysFilled * 100).toFixed(1)}%   ← 基准`);
console.log(`  永远回答「空」　　　　　　　　　　　 准确率 ${(BASE.alwaysEmpty * 100).toFixed(1)}%`);
console.log('');
const gain = t => { const d = (t.acc - baseline) * 100; return `${d >= 0 ? '+' : ''}${d.toFixed(1)} 分`; };

console.log('单独用电荷：');
for (const th of [1, 2]) show(`Δq ≥ ${th} → 判有序相`, cm(c => c.dq >= th));
console.log('\n单独用尺寸：');
for (const th of [1.1, 1.2, 1.3, 1.4, 1.5, 1.6]) show(`半径比 ≥ ${th} → 判有序相`, cm(c => c.ratio >= th));
console.log('\n电荷或尺寸（规律的完整形式）：');
for (const th of [1.2, 1.3, 1.4, 1.5, 1.6]) show(`Δq ≥ 2 或 半径比 ≥ ${th}`, cm(c => c.dq >= 2 || c.ratio >= th));

console.log('\n规律解释不了的格子（残余）—— 按**实测最优**的那条：Δq ≥ 1：');
const rule = c => c.dq >= 1;
const wrong = cells.filter(c => rule(c) !== c.observed);
for (const c of wrong.sort((x, y) => Number(x.observed) - Number(y.observed))) {
  const kind = c.observed ? '规律说该空，却有' : '规律说该有，却空';
  const best = cache[[c.a, c.b, 'O'].join(',')].bestFormula;
  console.log(`  [${kind}] ${c.sys.padEnd(9)} Δq=${c.dq} 比=${c.ratio.toFixed(2)}  ${c.observed ? best.slice(0, 34) : '(空)'}`);
}
console.log(`\n残余 ${wrong.length}/${cells.length}`);

fs.writeFileSync(path.join(HERE, 'law-cells.json'), JSON.stringify(cells, null, 1));

// ── McNemar 检验：规律与平凡解真的可区分吗 ──────────────────────────────
// +5.2 个百分点听起来像回事，但那是 116 个格子里多对了 6 个。
// 不做这一步，「规律优于平凡解」就只是一个没有误差棒的数字。
const best = c => c.dq >= 1;
let b = 0, c2 = 0;               // b: 平凡解对而规律错   c2: 平凡解错而规律对
for (const c of cells) {
  const triv = true;             // 平凡解 = 永远回答「有」
  const rb = (triv === c.observed), rr = (best(c) === c.observed);
  if (rb && !rr) b++; else if (!rb && rr) c2++;
}
const n = b + c2;
const logC = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
let cum = 0; for (let i = 0; i <= Math.min(b, c2); i++) cum += Math.exp(logC(n, i) - n * Math.log(2));
const p = Math.min(1, 2 * cum);
console.log(`\nMcNemar 精确检验（规律 Δq≥1  vs  平凡解「永远回答有」）：`);
console.log(`  不一致对：平凡解对/规律错 = ${b}　平凡解错/规律对 = ${c2}　合计 ${n}`);
console.log(`  双侧 p = ${p.toFixed(3)}　→ ${p < 0.05 ? '可区分' : '**在这份数据上与平凡解不可区分**'}`);
