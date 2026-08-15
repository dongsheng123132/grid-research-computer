#!/usr/bin/env node
// verify-sidon-probe.mjs — 组合构造上的假金判据 v0.1
//
// 第三个学科。前两个：材料（gap-probe，退出码 2）、天文（sky-probe，退出码 2）。
// 这一个的意义不同：前两个证明「闸门能跨学科」，这一个证明**闸门在验证免费的富矿上几乎不要钱**——
// 全部判据本地跑完不到一秒，不查数据库、不调 API、不等实验室。
//
// 被检验的对象是「贪心」这个最常见的第一版写法。注意它**没有 bug**：
// 它输出的每个集合都是合法 Sidon 集，验证器全绿。它只是**不如一个不动脑子的随机重启**。
// 「合法」和「有价值」是两件事，而没有平凡解对照就分不出来——这是本套件的全部内容。
//
// 用法：node demo/sidon-probe/verify-sidon-probe.mjs
// 退出码：0 = 全过　1 = 判据自身有问题　2 = **被检验的方法没通过对照，其结论作废**

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = JSON.parse(fs.readFileSync(path.join(here, 'result.json'), 'utf8'));
const results = [];
const t = (id, name, fn) => {
  let ok, detail = '';
  try { const r = fn(); ok = r === true; if (!ok) detail = typeof r === 'object' ? JSON.stringify(r) : String(r); }
  catch (e) { ok = false; detail = 'EXCEPTION: ' + e.message; }
  results.push({ id, name, ok, detail });
  console.log(` ${ok ? '✔' : '✘'} ${id.padEnd(7)} ${name}${ok ? '' : `\n     ❌ ${detail}`}`);
};

console.log('组合构造假金判据 v0.1 —— demo/sidon-probe\n');

// ── D1 阳性对照：连已知最优都找不到的搜索器，它报的「新纪录」不可信 ──────────
t('D1.1', '阳性对照：被检验的方法必须在**每一个** n 上复现穷举最优', () => {
  const bad = R.rows.filter(r => !r.greedy_recovers_optimum).map(r => `n=${r.n}(差${r.exact - r.greedy})`);
  return bad.length === 0 || `${bad.length}/${R.rows.length} 例没复现出最优：${bad.slice(0, 8).join(' ')}${bad.length > 8 ? ' …' : ''}`;
});
t('D1.2', '真值必须是自己穷举出来的，不是抄表（抄表就要信别人）', () => {
  const src = fs.readFileSync(path.join(here, 'probe.mjs'), 'utf8');
  return (/function exactMax/.test(src) && !/KNOWN_OPTIMA|LOOKUP_TABLE/.test(src))
    || '真值来自硬编码表——那就不是可独立重跑的对照';
});

// ── D2 平凡解对照：跑不赢不动脑子的做法，这个方法就没加任何东西 ──────────────
t('D2.1', '平凡解对照：被检验的方法必须至少赢过随机重启一次', () => {
  const b = R.trivial_baseline;
  return b.greedy_wins > 0
    || `赢 ${b.greedy_wins} 平 ${b.ties} 输 ${b.greedy_loses} —— 一次都没赢过平凡解`;
});
t('D2.2', '【反向】平凡解不许取稻草人版本（随机取子集太弱，赢它不说明问题）', () => {
  const src = fs.readFileSync(path.join(here, 'probe.mjs'), 'utf8');
  return /randomRestart/.test(src) && /不动脑子但认真做/.test(src)
    || '平凡解定义不明确或过弱';
});
t('D2.3', '【反向】平凡解必须真的有能力（它自己得能摸到最优，否则对照无效）', () => {
  const reach = R.rows.filter(r => r.random === r.exact).length;
  return reach === R.rows.length
    || `随机重启只在 ${reach}/${R.rows.length} 例达到最优 —— 对照本身太弱，赢它不说明任何问题`;
});

// ── D3 输出合法 ≠ 结论有价值（本套件的承重点）────────────────────────────
t('D3.1', '被检验方法的输出必须全部合法（证明它没有 bug，问题不在正确性）', () => {
  const bad = R.rows.filter(r => !r.greedy_valid).map(r => r.n);
  return bad.length === 0 || `n=${bad.join(',')} 输出的不是合法 Sidon 集 —— 那是 bug，不是本套件要抓的东西`;
});
t('D3.2', '【反向】「全绿 + 输出合法」不得被当成通过（正是这一条让 D1/D2 有存在理由）', () => {
  const allValid = R.rows.every(r => r.greedy_valid);
  const failsControl = R.rows.some(r => !r.greedy_recovers_optimum);
  return (allValid && failsControl)
    || '当前数据无法演示「合法但没价值」这一情形，本套件失去演示对象';
});

// ── D4 失败是结构性的，不是运气 ────────────────────────────────────────
t('D4.1', '失败集中在「最优值刚跳升」处（区间起点不算跳升）', () => {
  let prev = R.rows[0].exact;             // 起点不算跳升——首版把它算进去了，判据自己错了一次
  const jumps = [];
  for (const r of R.rows.slice(1)) { if (r.exact > prev) { jumps.push(r.n); prev = r.exact; } }
  const fails = new Set(R.rows.filter(r => !r.greedy_recovers_optimum).map(r => r.n));
  const missed = jumps.filter(n => !fails.has(n));
  return (jumps.length >= 3 && missed.length === 0)
    || `跳升点 ${JSON.stringify(jumps)}，其中 ${JSON.stringify(missed)} 不在失败集里`;
});

// ── 报告 ────────────────────────────────────────────────────────────
const pass = results.filter(r => r.ok).length;
const controlFail = results.filter(r => /^D[12]\./.test(r.id) && !r.ok).length;
console.log(`\n判决 ${pass}/${results.length}`);
if (controlFail) {
  console.log('\n被检验的方法未通过对照，其结论作废。');
  console.log('注意：它**没有 bug** —— 输出的每个集合都是合法 Sidon 集，验证器全绿。');
  console.log('它只是不如一个不动脑子的随机重启。「合法」与「有价值」是两件事，');
  console.log('而没有平凡解对照，这两件事在账面上长得一模一样。');
  console.log('—— 与 gap-probe（材料）、sky-probe（天文）同型，且这一轮的对照**免费、瞬时、确定**。');
  process.exit(2);
}
process.exit(pass === results.length ? 0 : 1);
