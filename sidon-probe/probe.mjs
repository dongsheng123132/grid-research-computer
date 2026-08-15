#!/usr/bin/env node
// probe.mjs — 把验金石装到富矿上：组合构造里的阳性对照与平凡解对照
//
// 为什么选这个矿脉（结论来自 2026-08-11 的检索，不是偏好）：
//   AI 真正淘出过金子的地方只有一个共同点——**验证免费且确定**。
//   AlphaEvolve 在 50+ 开放问题上约 20% 超过已知最优（11 维 kissing number 592→593，
//   4×4 矩阵乘法 49→48）；Melvin/Theseus 在量子光学上给出的实验被真的做了出来。
//   两者都不是模型更聪明，是矿脉允许一秒钟验一次。
//
// 而 gap-probe / sky-probe 那两道闸门在这里**原样可用，且不要钱**：
//   阳性对照 = 已知最优构造。搜索器连它都找不到 → 它在大 n 上报的任何「新纪录」都不可信。
//   平凡解对照 = 随机重启。跑不赢随机 → 这个启发式没加任何东西。
//
// 问题：Sidon 集（B₂ 集）—— {1..n} 的子集，要求**所有两两之差互不相同**。
//   验证 O(k²)，精确，零成本。这就是「验证自带」的含义。
//
// 关键设计：**阳性对照的真值由穷举算出来，不是从别处抄的表。**
//   抄表就要信别人；穷举是自己能重跑的。这跟 fact 的 source 必须引可复核物同一条规矩。
//
// 用法：node demo/sidon-probe/probe.mjs
// 退出码：0 = 跑完（判决交给 verify-sidon-probe.mjs）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Sidon 判定：所有两两之差互不相同。精确、无参数、无争议。 */
function isSidon(s) {
  const seen = new Set();
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const d = s[j] - s[i];
      if (seen.has(d)) return false;
      seen.add(d);
    }
  return true;
}

/** 真值：穷举出 {1..n} 里最大 Sidon 子集的大小。带剪枝，n≤32 秒级。 */
function exactMax(n) {
  let best = 0, bestSet = [];
  const cur = [], diffs = new Set();
  (function dfs(start) {
    if (cur.length > best) { best = cur.length; bestSet = [...cur]; }
    // 剪枝：剩下的数全加上也超不过当前最好
    if (cur.length + (n - start + 1) <= best) return;
    for (let x = start; x <= n; x++) {
      const nd = [];
      let ok = true;
      for (const y of cur) { const d = x - y; if (diffs.has(d) || nd.includes(d)) { ok = false; break; } nd.push(d); }
      if (!ok) continue;
      for (const d of nd) diffs.add(d);
      cur.push(x);
      dfs(x + 1);
      cur.pop();
      for (const d of nd) diffs.delete(d);
    }
  })(1);
  return { size: best, set: bestSet };
}

/** 被检验的「启发式」：贪心 —— 从小到大能加就加。这是最常见的第一版写法。 */
function greedy(n) {
  const s = [], diffs = new Set();
  for (let x = 1; x <= n; x++) {
    const nd = [];
    let ok = true;
    for (const y of s) { const d = x - y; if (diffs.has(d) || nd.includes(d)) { ok = false; break; } nd.push(d); }
    if (!ok) continue;
    for (const d of nd) diffs.add(d);
    s.push(x);
  }
  return s;
}

/** 平凡解对照：随机重启贪心。**不是随机取子集**——那太弱，赢它不说明任何问题。
 *  平凡解必须取「不动脑子但认真做」的那一版，否则对照就是稻草人。 */
function randomRestart(n, trials, rng) {
  let best = [];
  for (let t = 0; t < trials; t++) {
    const order = [...Array(n)].map((_, i) => i + 1);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const s = [], diffs = new Set();
    for (const x of order) {
      const nd = [];
      let ok = true;
      for (const y of s) { const d = Math.abs(x - y); if (diffs.has(d) || nd.includes(d)) { ok = false; break; } nd.push(d); }
      if (!ok) continue;
      for (const d of nd) diffs.add(d);
      s.push(x);
    }
    if (s.length > best.length) best = s.sort((a, b) => a - b);
  }
  return best;
}

// 固定种子：可复跑。用时间当种子就等于每次结论都不一样，那不叫实验。
let seed = 20260811;
const rng = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const RANGE = [];
for (let n = 6; n <= 30; n++) RANGE.push(n);

const rows = [];
for (const n of RANGE) {
  const ex = exactMax(n);
  const g = greedy(n);
  const r = randomRestart(n, 300, rng);
  rows.push({
    n, exact: ex.size, exact_set: ex.set,
    greedy: g.length, greedy_valid: isSidon(g),
    random: r.length, random_valid: isSidon(r),
    greedy_recovers_optimum: g.length === ex.size,
    greedy_beats_random: g.length > r.length,
  });
  process.stderr.write(`\rn=${n}  最优 ${ex.size}  贪心 ${g.length}  随机重启 ${r.length}    `);
}
process.stderr.write('\n');

const recovered = rows.filter(x => x.greedy_recovers_optimum).length;
const beats = rows.filter(x => x.greedy_beats_random).length;
const ties = rows.filter(x => x.greedy === x.random).length;
const loses = rows.filter(x => x.greedy < x.random).length;

const out = {
  spec: 'sidon-probe/0.1',
  question: '一个常见的启发式（贪心），在验证免费的富矿上，能不能通过阳性对照与平凡解对照',
  seed: 20260811,
  n_range: [RANGE[0], RANGE[RANGE.length - 1]],
  positive_control: {
    definition: '阳性对照 = 穷举算出的已知最优。搜索器连它都找不到，它报的任何「新纪录」都不可信',
    recovered, total: rows.length, rate: recovered / rows.length
  },
  trivial_baseline: {
    definition: '平凡解 = 随机重启贪心 300 次（不是随机取子集——那是稻草人）',
    greedy_wins: beats, ties, greedy_loses: loses
  },
  rows
};
fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1));

console.log(`\nn = ${RANGE[0]}..${RANGE[RANGE.length - 1]}，真值由穷举算出（不抄表）\n`);
console.log(`阳性对照：贪心复现出最优的 ${recovered}/${rows.length} 例（${(recovered / rows.length * 100).toFixed(0)}%）`);
console.log(`平凡解对照：贪心赢 ${beats}　平 ${ties}　输 ${loses}`);
console.log('\n  n   最优  贪心  随机重启   贪心过阳性对照?');
for (const x of rows) {
  console.log(`  ${String(x.n).padStart(2)}    ${String(x.exact).padStart(2)}    ${String(x.greedy).padStart(2)}      ${String(x.random).padStart(2)}       ${x.greedy_recovers_optimum ? '✔' : '✘ 差 ' + (x.exact - x.greedy)}`);
}
