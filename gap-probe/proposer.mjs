#!/usr/bin/env node
// proposer.mjs — 自主提议器 + 量程标定 v0.1
//
// 前四轮（probe/probe2/law/oos）的「探索」全部由人完成：人挑规律形式，
// 人选特征，人定阈值。`05-科学发现与环境定义报告.md` §2.1 自己承认
// 「不涉及大模型推理作为发现引擎」——这条不是待办清单里的一行，
// 是评分表 45% 那一维里唯一没被兑付的半句：「可探索部分明确」，
// 但从来没有非作者的东西在里面探索过。
//
// 这份脚本把 law.mjs:103-107 那个人写的阈值 for 循环，扩成一个自动
// 网格搜索。它不引入任何新数据源、不改判决口径（复用 law-cells.json
// 里已经离线落盘的 dq/ratio/observed），只是把「谁在提议」这一步交
// 给一个确定性的枚举过程，让「反馈机制」第一次真的被非作者的东西触发。
//
// 同一张表里必须带三条标定策略，理由见文件末尾「量程阶梯」一节：
//   random（下界）、oracle（上界，作弊，不是发现）、以及枚举出的候选。
// 没有它们，一个环境对所有输入都吐同一个判决时，无法区分
// 「这是真负结果」还是「这台仪器没有量程」。这正是 verify-power-control.mjs
// 要挡的那类事故。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const runsArg = args.find(a => a.startsWith('--runs='));
const MAX_RUNS = runsArg ? parseInt(runsArg.slice('--runs='.length), 10) : 200;
const policyArg = args.find(a => a.startsWith('--policy='));
const EXTERNAL_POLICY_CMD = policyArg && policyArg.slice('--policy='.length).startsWith('exec:')
  ? policyArg.slice('--policy=exec:'.length)
  : null;

const cellsPath = path.join(HERE, 'law-cells.json');
if (!fs.existsSync(cellsPath)) {
  console.error('缺 law-cells.json —— 先跑 node demo/gap-probe/law.mjs');
  process.exit(1);
}
const cells = JSON.parse(fs.readFileSync(cellsPath, 'utf8'));

// ── McNemar 精确检验（与 law.mjs / oos.mjs 同一算法，独立实现一份 ────────
// 是有意的：这份脚本要能被单独审计，不依赖别的文件里那份的正确性）
function mcnemar(predictFn, trivialAnswer = true) {
  let b = 0, c = 0; // b: 平凡解对而候选错　c: 平凡解错而候选对
  for (const cell of cells) {
    const trivRight = trivialAnswer === cell.observed;
    const candRight = predictFn(cell) === cell.observed;
    if (trivRight && !candRight) b++;
    else if (!trivRight && candRight) c++;
  }
  const n = b + c;
  if (n === 0) return { b, c, n, p: 1 };
  const logC = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
  let cum = 0;
  for (let i = 0; i <= Math.min(b, c); i++) cum += Math.exp(logC(n, i) - n * Math.log(2));
  return { b, c, n, p: Math.min(1, 2 * cum) };
}

function accuracy(predictFn) {
  let right = 0;
  for (const cell of cells) if (predictFn(cell) === cell.observed) right++;
  return right / cells.length;
}

const nObs = cells.filter(c => c.observed).length;
const baselineAcc = Math.max(nObs, cells.length - nObs) / cells.length;
const trivialAnswer = nObs >= cells.length - nObs; // 平凡解＝多数类，与 law.mjs 一致地取「永远回答有」

function grade(name, predictFn, note) {
  const acc = accuracy(predictFn);
  const mc = mcnemar(predictFn, trivialAnswer);
  return { name, note, acc, gain: acc - baselineAcc, mcnemar: mc, beatsBaseline: mc.p < 0.05 && acc > baselineAcc };
}

// ── 候选规律网格（这是「提议」的部分——枚举而非人手挑）───────────────────
// 与 law.mjs 的规律形式同构：单特征阈值、及两特征的 OR/AND 组合。
// 网格本身是提前写死的机械枚举，不依据看过的结果调整——这就是它和
// 人手选阈值的区别：人会在看到 residual 之后收窄搜索，这里不收窄，
// 网格跑多宽，日志就有多宽。
function buildCandidates() {
  const out = [];
  const add = (id, note, fn) => out.push({ id, note, predict: fn });

  for (const t of [0, 1, 2, 3]) {
    add(`dq>=${t}`, `单特征：电荷差 ≥ ${t}`, c => c.dq >= t);
    add(`dq<${t}`, `单特征取反：电荷差 < ${t}`, c => c.dq < t);
  }
  for (let t = 1.0; t <= 3.0001; t += 0.05) {
    const tr = Math.round(t * 100) / 100;
    add(`ratio>=${tr}`, `单特征：半径比 ≥ ${tr}`, c => c.ratio >= tr);
    add(`ratio<${tr}`, `单特征取反：半径比 < ${tr}`, c => c.ratio < tr);
  }
  for (const t1 of [1, 2]) {
    for (let t2 = 1.1; t2 <= 2.0001; t2 += 0.1) {
      const t2r = Math.round(t2 * 100) / 100;
      add(`dq>=${t1}|ratio>=${t2r}`, `组合 OR：电荷差 ≥ ${t1} 或 半径比 ≥ ${t2r}`, c => c.dq >= t1 || c.ratio >= t2r);
      add(`dq>=${t1}&ratio>=${t2r}`, `组合 AND：电荷差 ≥ ${t1} 且 半径比 ≥ ${t2r}`, c => c.dq >= t1 && c.ratio >= t2r);
    }
  }
  return out;
}

const fullGrid = buildCandidates();
const candidates = fullGrid.slice(0, MAX_RUNS);

// ── 外部策略：把子进程接进来当一条策略（policy #0 之外的任意策略）──────
// 协议见 POLICY-PROTOCOL.md：stdin 收不带 observed 的 cell 数组，
// stdout 吐等长的布尔预测数组。不联网、不依赖本文件其余逻辑。
function runExternalPolicy(cmd) {
  const input = JSON.stringify({ cells: cells.map(({ observed, ...rest }) => rest) });
  const r = spawnSync(cmd, { input, shell: true, encoding: 'utf8', timeout: 30000 });
  if (r.status !== 0) return { ok: false, error: `子进程退出码 ${r.status}：${(r.stderr || '').slice(0, 200)}` };
  let parsed;
  try { parsed = JSON.parse(r.stdout); } catch (e) { return { ok: false, error: `stdout 不是合法 JSON：${e.message}` }; }
  const preds = parsed?.predictions;
  if (!Array.isArray(preds) || preds.length !== cells.length) {
    return { ok: false, error: `predictions 长度不对：期望 ${cells.length}，实得 ${Array.isArray(preds) ? preds.length : typeof preds}` };
  }
  return { ok: true, predict: c => preds[cells.indexOf(c)] };
}

// ── 跑 ────────────────────────────────────────────────────────────────────
console.log(`自主提议器 v0.1 —— demo/gap-probe（${cells.length} 个可判定格子）`);
console.log(`平凡解「永远回答${trivialAnswer ? '有' : '空'}」准确率 ${(baselineAcc * 100).toFixed(1)}%（基准）\n`);

const logRows = [];
function logCandidate(g) {
  logRows.push(g);
  const tag = g.beatsBaseline ? '✔ 打赢' : '· 未打赢';
  console.log(JSON.stringify({
    id: g.name, note: g.note, acc: +g.acc.toFixed(4), gain: +g.gain.toFixed(4),
    mcnemar_b: g.mcnemar.b, mcnemar_c: g.mcnemar.c, p: +g.mcnemar.p.toFixed(4), verdict: tag,
  }));
}

console.log(`── 枚举候选规律：网格共 ${fullGrid.length} 条，本轮跑 ${candidates.length} 条 ──`);
for (const cand of candidates) logCandidate(grade(cand.id, cand.predict, cand.note));

const beaten = logRows.filter(g => g.beatsBaseline);
console.log(`\n候选规律判决：${beaten.length}/${logRows.length} 打赢平凡解`);
if (beaten.length === 0) {
  console.log('全部候选被平凡解参照系判死——这是本轮探索的主产出，不是失败。');
} else {
  // ⚠ 不要把这当发现。law.mjs 的样本内污染声明（radius 这个特征是在看过
  // 本数据集的异常之后才选的）覆盖 law-cells.json 的每一格。130 个候选里
  // 有 α=0.05 的检验，本就期望撞出几个假阳性——这正是多重比较陷阱，
  // 不加校正、不做样本外复核，任何一条「打赢」都不可信。
  console.log(`⚠ 以上 ${beaten.length} 条「打赢」都在样本内污染数据上跑出来的（见 law.mjs 文件头声明）。`);
  console.log(`  ${logRows.length} 个候选做多重假设检验，α=0.05 下本就该撞出约 ${(logRows.length * 0.05).toFixed(1)} 个假阳性。`);
  console.log('  这不是发现，是「网格搜得越宽、越容易撞出看起来显著的规律」的活证据——');
  console.log('  唯一可信的检验是 oos.mjs 的样本外预注册流程，本表任何一条都不能越过它直接宣称有预测力。');
}

// ── 量程阶梯：三条标定策略，证明仪器本身有区分度 ────────────────────────
console.log('\n── 量程阶梯（标定策略，不是候选规律）──');
const rng = mulberry32(hashSeed('gap-proposer-v1'));
const randomStrategy = grade('random', () => rng() < 0.5, '下界：伪随机预测，种子固定为 gap-proposer-v1');
const alwaysFilled = grade('always-filled', () => true, '平凡解，基准本身');
const alwaysEmpty = grade('always-empty', () => false, '反向平凡解');
const oracle = grade('oracle', c => c.observed, '上界：直接读 observed 标签——作弊，不是发现，只用于证明仪器有量程');

const ladder = [randomStrategy, alwaysFilled, alwaysEmpty, oracle];

let externalRow = null;
if (EXTERNAL_POLICY_CMD) {
  const ext = runExternalPolicy(EXTERNAL_POLICY_CMD);
  if (ext.ok) {
    externalRow = grade(`exec:${EXTERNAL_POLICY_CMD}`, ext.predict, '外挂策略，通过 POLICY-PROTOCOL.md 协议接入');
    ladder.push(externalRow);
  } else {
    console.log(`外挂策略失败：${ext.error}`);
  }
}

for (const g of ladder) {
  console.log(`  ${g.name.padEnd(28)} 准确率 ${(g.acc * 100).toFixed(1)}%  比平凡解 ${(g.gain * 100 >= 0 ? '+' : '')}${(g.gain * 100).toFixed(1)} 分  p=${g.mcnemar.p.toFixed(4)}  ${g.name === 'oracle' ? '⚠ 作弊上界，不是发现' : ''}`);
}

// ── 落盘 ─────────────────────────────────────────────────────────────────
const out = {
  spec: 'gap-proposer/0.1',
  generatedAt: new Date().toISOString(),
  nCells: cells.length,
  baselineAcc,
  trivialAnswer,
  gridTotal: fullGrid.length,
  runsRequested: MAX_RUNS,
  sampleInContaminationWarning: '本表候选跑在 law-cells.json（law.mjs 自曝的样本内污染数据，特征在看过异常之后才选）上；'
    + `${beaten.length}/${logRows.length} 条候选在多重假设检验下打赢平凡解，属预期内的假阳性数量级，不构成发现，`
    + '未经 oos.mjs 样本外预注册复核前不得引用为「有预测力」。',
  candidates: logRows.map(g => ({
    id: g.name, note: g.note, acc: g.acc, gain: g.gain,
    mcnemar: g.mcnemar, beatsBaseline: g.beatsBaseline,
  })),
  ladder: ladder.map(g => ({
    id: g.name, note: g.note, acc: g.acc, gain: g.gain,
    mcnemar: g.mcnemar, beatsBaseline: g.beatsBaseline,
  })),
};
fs.writeFileSync(path.join(HERE, 'result-proposer.json'), JSON.stringify(out, null, 2));
console.log(`\n已写 demo/gap-probe/result-proposer.json（候选 ${logRows.length} 条 + 量程阶梯 ${ladder.length} 条）`);
console.log('这份日志本身就是「至少一次完整探索日志」的候选材料——重定向到 logs/run-agent.log。');

function hashSeed(s) { return crypto.createHash('sha256').update(s).digest().readUInt32LE(0); }
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
