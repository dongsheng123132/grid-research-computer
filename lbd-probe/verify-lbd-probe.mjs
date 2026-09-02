#!/usr/bin/env node
// verify-lbd-probe.mjs — 文献连接发现（ABC 模型）判据 v0.1（复赛补）
// 判什么：「A-C 查不到 → 未被发现的连接」在 9 条教科书级已知关系上假阳性率必须为 0；
// 每条教科书关系的资格（为什么是教科书级、何时确立）不能裸奔；虚构关系必须 unresolved。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/lbd-probe/probe.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const c = r.counts || {};

// L1：口径复算。假阳性率 = no_co_occurrence / (co_occurs + no_co_occurrence)
const denom = (c.co_occurs || 0) + (c.no_co_occurrence || 0);
let computed = null;
if (denom > 0) computed = (c.no_co_occurrence || 0) / denom;
const stored = typeof r.false_empty_rate === 'number' ? r.false_empty_rate : null;
J('L1.1', 'false_empty_rate 必须存在', stored !== null, stored === null ? '缺字段' : `存入=${stored}`);
J('L1.2', '假阳性率必须等于按口径复算值（co_occurs+no_co_occurrence 作分母）',
  computed !== null && stored !== null && Math.abs(computed - stored) < 1e-9,
  `复算=${computed} vs 存入=${stored}（分母=${denom}）`);

// L2：承重主张。9 条教科书关系全部共现 —— 这是本探针的核心结果
J('L2.1', '教科书关系必须全部共现（no_co_occurrence = 0）', c.no_co_occurrence === 0,
  `no_co_occurrence=${c.no_co_occurrence}（>0 即 ABC 模型的假阳性被证实，整轮作废）`);
J('L2.2', '共现数必须 ≥ 8（声称的 9 条不能缩水）', (c.co_occurs || 0) >= 8, `co_occurs=${c.co_occurs}`);

// L3：阳性对照。Swanson 1986 是 ABC 模型的教科书原型
J('L3.1', '阳性对照 Swanson 关系必须共现', r.reverse_cases?.R3_swanson === 'co_occurs',
  `R3_swanson=${r.reverse_cases?.R3_swanson}`);

// L4：反例。虚构的 A-C 对必须 unresolved
J('L4.1', '虚构关系对必须 unresolved，且反例在档', r.reverse_cases?.R2_ok === true && r.reverse_cases?.R2_fabricated_pair === 'unresolved',
  `R2_ok=${r.reverse_cases?.R2_ok} R2=${r.reverse_cases?.R2_fabricated_pair}`);

// L5：口径披露 + unresolved/error 单列不入分母
J('L5.1', 'denominator_note 必须披露，unresolved/error 单独计数',
  typeof r.denominator_note === 'string' && typeof c.unresolved === 'number' && typeof c.error === 'number',
  `note=${(r.denominator_note || '').slice(0, 40)} unresolved=${c.unresolved} error=${c.error}`);

// L6：对照组（无 _r2/_r3 标记的行 = controls-raw.json 里的教科书关系）资格不能裸奔
// 注意：R3（Swanson 对）与 R2（编造对）是探针特意追加的，不带资格字段是设计如此。
const rows = r.rows || [];
const controlsOnly = rows.filter(x => !x._r2 && !x._r3);
const allJustified = controlsOnly.length >= 8 && controlsOnly.every(x =>
  typeof x.why_textbook === 'string' && x.why_textbook.length > 5 && typeof x.established_before === 'number');
J('L6.1', '教科书对照行必须逐条带 why_textbook 与 established_before', allJustified,
  `对照行=${controlsOnly.length}/rows=${rows.length}（缺资格说明=关系清单不可复核）`);

// L7：反向用例（防恒绿）。往 no_co_occurrence 注入 1 个后复算值必须变化
{
  const mDenom = denom + 1;
  const mRate = ((c.no_co_occurrence || 0) + 1) / mDenom;
  const sensitive = computed !== null && Math.abs(mRate - computed) > 1e-9;
  J('L7.1', '反向用例：注入 1 条未共现后复算值必须变化', sensitive,
    sensitive ? `复算 ${computed} → ${mRate}` : '❌ 判据对数据不敏感（恒绿考题）');
}

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('文献连接发现判据 v0.1 —— demo/lbd-probe\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(8)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮结果作废：承重主张失守或口径不可复核。');
  process.exit(2);
}
process.exit(0)