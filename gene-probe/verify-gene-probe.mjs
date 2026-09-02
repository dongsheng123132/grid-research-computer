#!/usr/bin/env node
// verify-gene-probe.mjs — 基因假空率判据 v0.1（复赛补）
// 判什么：假空率不是「报出来的数」，是能从 counts 按披露口径复算出来的数。
// 篡改 rate 而 counts 不动 → 红；反例在档但被解析 → 红。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/gene-probe/probe.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const c = r.counts || {};

// G1：口径复算。分母只含 exact_hit + alias_only（probe 自述口径，写死在这里是防漂移）
const denom = (c.exact_hit || 0) + (c.alias_only || 0);
let computed = null;
if (denom > 0) computed = (c.alias_only || 0) / denom;
const stored = typeof r.false_empty_rate === 'number' ? r.false_empty_rate : null;
J('G1.1', 'false_empty_rate 必须存在', stored !== null, stored === null ? '缺字段' : `存入=${stored}`);
J('G1.2', '假空率必须等于按口径复算值（exact+alias 作分母）',
  computed !== null && stored !== null && Math.abs(computed - stored) < 1e-9,
  `复算=${computed} vs 存入=${stored}（分母=${denom}）`);

// G2：分母规则必须白纸黑字披露，且 fuzzy/unresolved/error 不得进分母
J('G2.1', 'denominator_note 必须写明只进 exact+alias',
  typeof r.denominator_note === 'string' && /exact_hit|alias_only|分母/.test(r.denominator_note),
  r.denominator_note || '缺 denominator_note');
J('G2.2', 'unresolved/error 单独计数、不入分母',
  typeof c.unresolved === 'number' && typeof c.error === 'number',
  `unresolved=${c.unresolved} error=${c.error}`);

// G3：阳性对照。TP53 是教科书级稠密基因，必须 exact_hit。
J('G3.1', '阳性对照 TP53 必须是 exact_hit', r.reverse?.R3_TP53 === 'exact_hit',
  `R3_TP53=${r.reverse?.R3_TP53}`);

// G4：反例必须 unresolved 且在档
const fabricated = r.reverse?.R2_fabricated || [];
const allUnresolved = fabricated.every(x => /unresolved/.test(x));
J('G4.1', '假基因名必须 unresolved（不能因为查得到就宣称存在）', r.reverse?.R2_ok === true && allUnresolved,
  `R2_ok=${r.reverse?.R2_ok} fabricated=${JSON.stringify(fabricated.length)}`);

// G5：失败单独计数，不得并入 0
J('G5.1', 'failures 数组必须存在', Array.isArray(r.failures),
  Array.isArray(r.failures) ? `failures=${r.failures.length}` : '缺 failures');

// G6：反向用例（防恒绿）。判据必须对数据敏感：篡改计数后复算值要变。
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
console.log('基因假空率判据 v0.1 —— demo/gene-probe\n');
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