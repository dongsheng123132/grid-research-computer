#!/usr/bin/env node
// verify-chem-probe.mjs — 化学假空率判据 v0.1（复赛补）
// 判什么：与 gene 同构——假空率能按披露口径复算；阳性对照 aspirin 必须 exact_hit；
// 虚构化合物必须 unresolved；篡改计数 → 复算值变化（判据不恒绿）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/chem-probe/probe.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const c = r.counts || {};

// G1：口径复算。分母只含 exact_hit + alias_only
const denom = (c.exact_hit || 0) + (c.alias_only || 0);
let computed = null;
if (denom > 0) computed = (c.alias_only || 0) / denom;
const stored = typeof r.false_empty_rate === 'number' ? r.false_empty_rate : null;
J('G1.1', 'false_empty_rate 必须存在', stored !== null, stored === null ? '缺字段' : `存入=${stored}`);
J('G1.2', '假空率必须等于按口径复算值（exact+alias 作分母）',
  computed !== null && stored !== null && Math.abs(computed - stored) < 1e-9,
  `复算=${computed} vs 存入=${stored}（分母=${denom}）`);

// G2：分母规则必须披露；unresolved/error 不得进分母
J('G2.1', 'denominator_note 必须写明只进 exact+alias',
  typeof r.denominator_note === 'string' && /exact_hit|alias_only|分母/.test(r.denominator_note),
  r.denominator_note || '缺 denominator_note');
J('G2.2', 'unresolved/error 单独计数、不入分母',
  typeof c.unresolved === 'number' && typeof c.error === 'number',
  `unresolved=${c.unresolved} error=${c.error}`);

// G3：阳性对照。aspirin 是 PubChem 头号条目，必须 exact_hit。
J('G3.1', '阳性对照必须 exact_hit', r.reverse?.R3 === 'exact_hit', `R3=${r.reverse?.R3}`);

// G4：反例必须 unresolved 且在档
const fabricated = r.reverse?.R2 || [];
const allUnresolved = fabricated.every(x => /unresolved/.test(x));
J('G4.1', '虚构化合物必须 unresolved（不能因为查得到就宣称存在）',
  r.reverse?.R2_ok === true && allUnresolved,
  `R2_ok=${r.reverse?.R2_ok} fabricated=${JSON.stringify(fabricated.length)}`);

// G5：失败单独计数
J('G5.1', 'failures 数组必须存在', Array.isArray(r.failures),
  Array.isArray(r.failures) ? `failures=${r.failures.length}` : '缺 failures');

// G6：反向用例（防恒绿）
{
  const mutated = { exact_hit: c.exact_hit, alias_only: (c.alias_only || 0) + 1 };
  const mDenom = mutated.exact_hit + mutated.alias_only;
  const mRate = mutated.alias_only / mDenom;
  const sensitive = Math.abs(mRate - computed) > 1e-9;
  J('G6.1', '反向用例：往 alias_only 注入 1 个后复算值必须变化', sensitive,
    sensitive ? `复算 ${computed} → ${mRate}` : '❌ 判据对数据不敏感（恒绿考题）');
}

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('化学假空率判据 v0.1 —— demo/chem-probe\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(8)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮结果作废：口径不成立或反例失守，假空率不可信。');
  process.exit(2);
}
process.exit(0);