#!/usr/bin/env node
// verify-field-map.mjs — 检索口径标定判据 v0.1（复赛补）
// 判什么：三个门都要判，不许只报绿的；G2 是已知负结果——负结果必须出现在 failures 里，
// 不得掩盖；「判据红了」本身要有反向用例证明它真会响。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/field-map/map.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const rows = r.rows || [];
const gates = r.gates || {};

// F1：计数与行状态对账
const measuredRows = rows.filter(x => x.status === 'measured').length;
const tooNarrowRows = rows.filter(x => x.status === 'too_narrow').length;
const errorRows = rows.filter(x => x.status === 'error').length;
J('F1.1', 'measured 计数必须等于行状态对账', r.measured === measuredRows && measuredRows + tooNarrowRows + errorRows === rows.length,
  `measured=${r.measured} 行内=${measuredRows}（total=${rows.length}）`);
J('F1.2', 'too_narrow 计数必须等于行状态对账', r.too_narrow === tooNarrowRows, `too_narrow=${r.too_narrow} 行内=${tooNarrowRows}`);

// F2：三个门必须都判（不允许只报绿的）
J('F2.1', 'G1/G2/G3 三个门键齐全且为布尔', typeof gates.G1_aspirin === 'boolean' && typeof gates.G2_clinical_high === 'boolean' && typeof gates.G3_formal_low === 'boolean',
  JSON.stringify(gates));

// F3：负结果必须披露。门红了 failures 里必须找得到它（判据红了就要出声）
{
  const fails = (r.failures || []).join(' ');
  const disclosed = !(gates.G2_clinical_high === false) || /G2/.test(fails);
  J('F3.1', 'G2 为 false 时 failures 必须含 G2 条目（负结果不得掩盖）', disclosed,
    disclosed ? 'G2 负结果已披露' : '❌ G2 红了但 failures 没提它');
  J('F3.2', 'G3 为 true 时 failures 不得伪造失败', !(gates.G3_formal_low === true && /G3.*不成立/.test(fails)),
    'G3 绿了但 failures 说它不成立（自相矛盾）');
}

// F4：自检反向用例。门红 + 无披露 ⇨ 判据必须响（证明 F3.1 不是恒绿）
{
  const fake = { gates: { ...gates, G2_clinical_high: false }, failures: [] };
  const fakeFails = (fake.failures || []).join(' ');
  const wouldFire = !(fake.gates.G2_clinical_high === false) || /G2/.test(fakeFails);
  J('F4.1', '反向用例：G2 红但 failures 空时判据必须响', !wouldFire,
    wouldFire ? '❌ F3.1 是恒绿考题' : 'F3.1 对「红而不披露」敏感');
}

// F5：阳性对照门。aspirin 必须判绿，否则标定整轮作废
J('F5.1', '阳性对照门 G1_aspirin 必须为 true', gates.G1_aspirin === true, `G1_aspirin=${gates.G1_aspirin}`);

// F6：行结构完整可复核
const rowsOk = rows.length > 0 && rows.every(x =>
  typeof x.name === 'string' && typeof x.size === 'number' &&
  x.hits && Object.values(x.hits).every(v => typeof v === 'number' && v >= 0));
J('F6.1', 'rows 必须带 name/size/hits 且命中计数非负', rowsOk, `rows=${rows.length}`);

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('检索口径标定判据 v0.1 —— demo/field-map\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(8)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮结果作废：计数对不上账或负结果被掩盖。');
  process.exit(2);
}
process.exit(0);