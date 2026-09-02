#!/usr/bin/env node
// verify-trend-scale.mjs — 口径敏感度全总体普查 判据 v0.1
//
// ⚠ 本文件写在任何普查数据出来之前（2026-08-24），与 PREREG.md 同批落盘并锚定。
//   看到数据再定判据 = 自己给自己发证。判据的价值全在它写在数据之前。
//
// 判什么：
//   1. 采数者报的每一个统计量，都从 rows 逐条复算——**结论行一个都不信**
//   2. 三态分类必须与 rows 的原始数字一致（尤其 title_phrase==0 不许当无穷大）
//   3. 预注册的作废条件真的会让它红
//   4. 反向用例：注入破坏后判据必须响，防恒绿
//
// 用法：node demo/trend-probe/scale/verify-trend-scale.mjs
// 退出码 0=通过  1=缺文件  2=本轮结果作废

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
const preregPath = path.join(HERE, 'PREREG.md');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/trend-probe/scale/scale.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const rows = Array.isArray(r.rows) ? r.rows : [];

// ── 工具：从 rows 自己算，不看 r.stats ──────────────────────────────
const num = v => (typeof v === 'number' && Number.isFinite(v));
const pct = (a, b) => (b === 0 ? null : +(100 * a / b).toFixed(4));
const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

// 判据自己重新分类，不接受 row.state 的自我声明
const classify = row => {
  const t = [row.fulltext_loose, row.title_abstract_phrase, row.title_phrase];
  if (!t.every(num)) return 'error';
  if (row.title_phrase < 10) return 'too_narrow';
  return 'measured';
};
const recomputed = rows.map(row => ({ row, state: classify(row) }));
const measured = recomputed.filter(x => x.state === 'measured').map(x => x.row);
const tooNarrow = recomputed.filter(x => x.state === 'too_narrow').map(x => x.row);
const errored = recomputed.filter(x => x.state === 'error').map(x => x.row);
const ratios = measured.map(x => x.fulltext_loose / x.title_phrase).sort((a, b) => a - b);

// ── 抽样版写死的常数（来自 PREREG-v2.md，判据自己持有一份，不从 result.json 读）──
const V2 = {
  seed: 'trend-scale-v2-20260824',
  n: 1000,
  N: 4516,
  frame_sha256: '7df1bf6f2a819bbbc9c22483894188e61384bcb69b63f6ce8802a2b29b2b15c9',
  v1_sha256: '084a62b1bccb8641c6ef1404b8c76d616722a5776def636faeb421cfb0443828',
};
const v2Path = path.join(HERE, 'PREREG-v2.md');
const framePath = path.join(HERE, 'topics.json');
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

// 判据独立实现同一个 PRNG 与抽法。**采数者的样本不算数，判据自己抽一遍比对。**
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function drawSample(topics, seed, n) {
  const arr = [...topics].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); // 先排序：游标顺序不稳
  const rand = mulberry32(xmur3(seed)());
  for (let i = arr.length - 1; i > 0; i--) {           // Fisher–Yates
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// ── P0：预注册链在盘且被钉住 ───────────────────────────────────────
{
  const v1ok = fs.existsSync(preregPath), v2ok = fs.existsSync(v2Path);
  J('P0.1', 'PREREG.md（v1）与 PREREG-v2.md 必须都在盘（改版是墓碑不是删除）', v1ok && v2ok,
    `v1=${v1ok} v2=${v2ok}`);
  J('P0.2', 'v1 必须一个字节没被改过（它的 sha256 已进 .ots 外部时间锚）',
    v1ok && sha256(preregPath) === V2.v1_sha256,
    v1ok ? `盘上 ${sha256(preregPath).slice(0, 16)}… 应为 ${V2.v1_sha256.slice(0, 16)}…` : '');
  const v2sha = v2ok ? sha256(v2Path) : null;
  J('P0.3', 'result.json 必须钉住 v2 的 sha256 且与盘上一致',
    v2ok && r.prereg_sha256 === v2sha,
    `盘上 ${v2sha?.slice(0, 16)}… vs 报的 ${String(r.prereg_sha256).slice(0, 16)}…`);
}

// ── S1：抽样必须可复现（这是抽样版取代普查版之后的新承重点）──────────
{
  const frameOk = fs.existsSync(framePath);
  J('S1.1', '抽样框 topics.json 必须在盘且 sha256 与预注册写死的值相符（有人换过框即作废）',
    frameOk && sha256(framePath) === V2.frame_sha256,
    frameOk ? `盘上 ${sha256(framePath).slice(0, 16)}… 应为 ${V2.frame_sha256.slice(0, 16)}…` : '缺 topics.json');

  J('S1.2', `rows 条数必须等于预注册写死的样本量 n=${V2.n}`,
    rows.length === V2.n, `rows=${rows.length}`);

  const ids = new Set(rows.map(x => x.topic_id));
  J('S1.3', 'topic_id 不许重复', ids.size === rows.length, `唯一 ${ids.size} / 共 ${rows.length}`);

  // 承重：判据自己用写死的种子重抽一遍，逐条比对
  if (frameOk) {
    const frame = JSON.parse(fs.readFileSync(framePath, 'utf8'));
    J('S1.4', `抽样框必须是全总体 N=${V2.N}（不许先筛一遍再抽）`,
      frame.topics?.length === V2.N && frame.declared_count === V2.N,
      `框内 ${frame.topics?.length} declared=${frame.declared_count}`);
    const mine = drawSample(frame.topics || [], V2.seed, V2.n).map(t => t.id);
    const theirs = rows.map(x => x.topic_id);
    const firstDiff = mine.findIndex((id, i) => id !== theirs[i]);
    J('S1.5', '判据用写死的种子独立重抽，必须与 rows 逐条相同（采数者的样本不算数）',
      mine.length === theirs.length && firstDiff === -1,
      firstDiff === -1 ? '' : `第 ${firstDiff} 条起不同：判据抽到 ${mine[firstDiff]}，rows 是 ${theirs[firstDiff]}`);
  }
}

// ── S2：三态分类必须与原始数字一致，作者的自我声明不算数 ────────────
{
  const mismatch = recomputed.filter(x => x.row.state !== x.state);
  J('S2.1', '每行的 state 必须与其原始三个数复算的结果一致',
    mismatch.length === 0,
    mismatch.slice(0, 3).map(x => `${x.row.display_name}: 报 ${x.row.state} 实为 ${x.state}`).join(' | '));
  // 承重条：title_phrase==0 绝不许进 measured
  const zeroInMeasured = measured.filter(x => x.title_phrase === 0);
  J('S2.2', 'title_phrase==0 绝不许进 measured（「没测着」≠「它没有」）',
    zeroInMeasured.length === 0, `${zeroInMeasured.length} 条 0 分母被算进了统计`);
  const ratioOnNarrow = tooNarrow.concat(errored).filter(x => num(x.ratio));
  J('S2.3', 'too_narrow / error 行不许带 ratio（带了就会被下游误当数据用）',
    ratioOnNarrow.length === 0, `${ratioOnNarrow.length} 条`);
  J('S2.4', '三态计数必须与逐行复算一致',
    r.states?.measured === measured.length && r.states?.too_narrow === tooNarrow.length
      && r.states?.error === errored.length,
    `复算 measured=${measured.length} too_narrow=${tooNarrow.length} error=${errored.length}；`
    + `报的 ${JSON.stringify(r.states)}`);
  J('S2.5', '三态之和必须等于总行数（没有第四种去处）',
    measured.length + tooNarrow.length + errored.length === rows.length, '');
}

// ── S3：仪器阳性/阴性对照（PREREG 第「仪器对照」节）────────────────
{
  const viol = measured.filter(x =>
    !(x.fulltext_loose >= x.title_abstract_phrase && x.title_abstract_phrase >= x.title_phrase));
  const rate = pct(viol.length, measured.length);
  J('S3.1', '单调性违反率必须 ≤ 5%（超了说明口径语义理解错了，整轮作废）',
    measured.length > 0 && rate !== null && rate <= 5,
    `违反 ${viol.length}/${measured.length} = ${rate}%；例：`
    + viol.slice(0, 2).map(x => `${x.display_name}(${x.fulltext_loose}/${x.title_abstract_phrase}/${x.title_phrase})`).join(' '));
  const low = ratios.filter(v => v < 100).length;
  J('S3.2', '阴性对照：ratio<100 的比例不许为 0（全判成"差几千倍"的指标没有区分度）',
    measured.length > 0 && low > 0, `ratio<100 共 ${low} 条`);
}

// ── S4：API 失败率 ────────────────────────────────────────────────
{
  const rate = pct(errored.length, rows.length);
  J('S4.1', 'API 失败率必须 ≤ 5%', rows.length > 0 && rate !== null && rate <= 5, `${errored.length} 条失败 = ${rate}%`);
}

// ── S5：报的统计量必须逐条复算得出（结论行一律不信）────────────────
{
  const close = (a, b, tol) => num(a) && num(b) && Math.abs(a - b) <= tol;
  const med = quantile(ratios, 0.5), p5 = quantile(ratios, 0.05), p95 = quantile(ratios, 0.95);
  const ge1000 = pct(ratios.filter(v => v >= 1000).length, ratios.length);
  const lt100 = pct(ratios.filter(v => v < 100).length, ratios.length);
  const s = r.stats || {};
  J('S5.1', 'ratio_median 必须可复算（±1%）',
    close(s.ratio_median, med, Math.abs(med ?? 0) * 0.01 + 1e-9), `报 ${s.ratio_median} 复算 ${med}`);
  J('S5.2', 'ratio_p5 / ratio_p95 必须可复算（±1%）',
    close(s.ratio_p5, p5, Math.abs(p5 ?? 0) * 0.01 + 1e-9) && close(s.ratio_p95, p95, Math.abs(p95 ?? 0) * 0.01 + 1e-9),
    `报 ${s.ratio_p5}/${s.ratio_p95} 复算 ${p5}/${p95}`);
  J('S5.3', 'pct_ratio_ge_1000 必须可复算（±0.1 个百分点）',
    close(s.pct_ratio_ge_1000, ge1000, 0.1), `报 ${s.pct_ratio_ge_1000} 复算 ${ge1000}`);
  J('S5.4', 'pct_ratio_lt_100 必须可复算（±0.1 个百分点）',
    close(s.pct_ratio_lt_100, lt100, 0.1), `报 ${s.pct_ratio_lt_100} 复算 ${lt100}`);
}

// ── S6：预注册的四条预测——**记账，不作废** ────────────────────────
//   预测被推翻是结果，不是故障。但必须逐条把结局写出来，不许悄悄不提。
{
  const med = quantile(ratios, 0.5), p5 = quantile(ratios, 0.05), p95 = quantile(ratios, 0.95);
  const ge1000 = pct(ratios.filter(v => v >= 1000).length, ratios.length);
  const narrowPct = pct(tooNarrow.length, rows.length);
  const spread = (num(p5) && p5 > 0 && num(p95)) ? p95 / p5 : null;
  const P = [
    ['P1', 'ratio 中位数 ≥ 100', num(med) && med >= 100, `中位 ${med?.toFixed?.(1)}`],
    ['P2', 'ratio ≥ 1000 占比 ≥ 10%', num(ge1000) && ge1000 >= 10, `${ge1000}%`],
    ['P3', 'P95/P5 ≥ 10^4（跨 4 个数量级）', num(spread) && spread >= 1e4, `P95/P5 = ${spread?.toFixed?.(0)}`],
    ['P4', 'too_narrow 占比 < 30%', num(narrowPct) && narrowPct < 30, `${narrowPct}%`],
  ];
  const outcomes = P.map(([id, d, ok, det]) => `${id} ${ok ? '成立' : '被推翻'}（${det}）`);
  J('S6.1', '四条预注册预测的结局必须逐条落进 result.json 的 prediction_outcomes',
    Array.isArray(r.prediction_outcomes) && r.prediction_outcomes.length === 4,
    '实测结局：' + outcomes.join('；'));
  for (const [id, d, ok, det] of P) {
    J(`S6.${id}`, `【记账·不影响判决】预测 ${id}：${d}`, null, `${ok ? '成立' : '⚠ 被推翻'} —— ${det}`);
  }
}

// ── S7：诚实边界必须与数字同页（PREREG「诚实边界」节）──────────────
{
  const b = r.honest_bounds;
  J('S7.1', 'result.json 必须带 honest_bounds，且提到 topic 名不必然是研究者会用的检索式',
    typeof b === 'string' && /display_name|topic/i.test(b) && /检索式|外部效度/.test(b),
    typeof b === 'string' ? b.slice(0, 60) : '缺 honest_bounds');
  // v2 抽样版：v1 那条「不许套置信区间」在这里**必须反过来**。
  // 22.1% 的样本报比例却不给区间，就是把抽样结果当普查结果用。
  const ci = r.ci || {};
  const need = ['pct_ratio_ge_1000', 'pct_ratio_lt_100', 'pct_too_narrow'];
  const shaped = need.every(k => ci[k] && num(ci[k].lo) && num(ci[k].hi) && ci[k].hi >= ci[k].lo);
  J('S7.2', '每个报出的比例必须带 95% 置信区间（抽样版必须承认抽样误差）', shaped,
    `缺区间的：${need.filter(k => !(ci[k] && num(ci[k].lo))).join(', ') || '无'}`);

  // FPC 必须真的被用上：判据自己算一遍，与报的区间比
  {
    const fpc = Math.sqrt((V2.N - V2.n) / (V2.N - 1));
    const wilsonFPC = (k, n) => {
      if (!n) return null;
      const z = 1.959964, p = k / n;
      const se = fpc * Math.sqrt(p * (1 - p) / n);
      const d = 1 + z * z / n, c = p + z * z / (2 * n);
      const m = z * Math.sqrt(se * se + z * z / (4 * n * n));
      return { lo: Math.max(0, 100 * (c - m) / d), hi: Math.min(100, 100 * (c + m) / d) };
    };
    const mine = {
      pct_ratio_ge_1000: wilsonFPC(ratios.filter(v => v >= 1000).length, ratios.length),
      pct_ratio_lt_100: wilsonFPC(ratios.filter(v => v < 100).length, ratios.length),
      pct_too_narrow: wilsonFPC(tooNarrow.length, rows.length),
    };
    const off = need.filter(k => {
      const a = ci[k], m = mine[k];
      return !a || !m || Math.abs(a.lo - m.lo) > 0.5 || Math.abs(a.hi - m.hi) > 0.5;
    });
    J('S7.3', `置信区间必须带有限总体校正（FPC=${fpc.toFixed(4)}）且可复算（±0.5 个百分点）`,
      shaped && off.length === 0,
      off.length ? off.map(k => `${k}: 报 [${ci[k]?.lo?.toFixed(2)}, ${ci[k]?.hi?.toFixed(2)}] 复算 [${mine[k]?.lo?.toFixed(2)}, ${mine[k]?.hi?.toFixed(2)}]`).join(' | ') : '');
    J('S7.4', '分位数不许配区间（本轮不做分位数的区间估计，给了就是无依据的精确感）',
      !ci.ratio_median && !ci.ratio_p5 && !ci.ratio_p95, '分位数被套了区间');
  }
  J('S7.5', 'honest_bounds 必须说明这是样本不是普查', typeof b === 'string' && /样本|抽样/.test(b),
    '没说这是抽样');
}

// ── S8：反向用例（防恒绿）──────────────────────────────────────────
{
  // 8.1 把一条 measured 的 title_phrase 抬到超过 TA 口径，单调判据必须响
  const m0 = measured[0];
  if (m0) {
    const mut = { ...m0, title_phrase: m0.title_abstract_phrase + 5 };
    const stillMono = mut.fulltext_loose >= mut.title_abstract_phrase && mut.title_abstract_phrase >= mut.title_phrase;
    J('S8.1', '反向用例：破坏单调性后 S3.1 的检查必须敏感', !stillMono,
      stillMono ? '❌ 单调检查是恒绿考题' : '对注入敏感');
  } else J('S8.1', '反向用例：破坏单调性后 S3.1 的检查必须敏感', false, 'measured 为空，无从注入');

  // 8.2 把一条 title_phrase=0 的行伪造成 measured，S2.2 必须抓住
  const fake = [...rows, { topic_id: 'INJECT', display_name: 'inject', state: 'measured',
    fulltext_loose: 999999, title_abstract_phrase: 5, title_phrase: 0, ratio: Infinity }];
  const caught = fake.some(x => x.state === 'measured' && classify(x) !== 'measured');
  J('S8.2', '反向用例：0 分母行伪称 measured 必须被复分类抓住', caught,
    caught ? '复分类对注入敏感' : '❌ 三态检查是恒绿考题');

  // 8.3 统计量被改必须被复算抓住
  const med = quantile(ratios, 0.5);
  const tampered = num(med) ? med * 1.5 : 1;
  const wouldCatch = num(med) ? Math.abs(tampered - med) > Math.abs(med) * 0.01 : false;
  J('S8.3', '反向用例：中位数被抬高 50% 必须被 S5.1 的复算抓住', wouldCatch,
    wouldCatch ? '复算对篡改敏感' : '❌ 统计复算是恒绿考题');

  // 8.4 空数据不许挣到绿灯
  J('S8.4', '反向用例：rows 为空或 measured 为空不得通过',
    rows.length > 0 && measured.length > 0, `rows=${rows.length} measured=${measured.length}`);
}

// ── 判决 ──────────────────────────────────────────────────────────
const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('口径敏感度全总体普查 判据 v0.1 —— demo/trend-probe/scale\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(8)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮结果作废：见上面打 ✘ 的行。预测被推翻不在此列（那是结果，标 · 只记账）。');
  process.exit(2);
}
process.exit(0);
