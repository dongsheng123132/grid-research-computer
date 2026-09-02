#!/usr/bin/env node
// verify-lit-recheck.mjs — 反驳套件判据 v0.1（复赛补）
// 判什么：这是一个「试图推翻承重主张」的反驳器，不能伪装成确认；
// 承重主张 = phrase 口径下 0 篇量化 —— 一旦出现 1 篇，判据必须红（主张被推翻是好事，但要说出来）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/lit-recheck/recheck.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const queries = r.queries || [];

// R1：意图声明。反驳器必须声明「试图推翻」，不得伪装成确认
J('R1.1', 'purpose 必须声明「试图推翻」意图', typeof r.purpose === 'string' && /推翻|试图|推翻.*承重/i.test(r.purpose),
  (r.purpose || '缺 purpose').slice(0, 50));

// R2：口径并报。每条查询必须有 loose 与 phrase_ta 两种口径
const dualOk = queries.every(q => typeof q.loose === 'number' && typeof q.phrase_ta === 'number' && q.loose >= q.phrase_ta);
J('R2.1', '每条查询必须双口径并报且 loose ≥ phrase_ta', queries.length > 0 && dualOk,
  `查询=${queries.length}`);

// R3：承重主张。phrase 口径下必须全部 0 命中（出现 1 篇 = 主张被推翻 = 判据红）
const allZero = queries.length > 0 && queries.every(q => q.phrase_ta === 0);
J('R3.1', 'phrase 口径必须全部 0 命中（承重主张守住）', allZero,
  allZero ? `全部 ${queries.length} 条零命中` : '❌ 出现非零命中：承重主张已被推翻，必须报红');

// R4：口径自洽。0 命中就不许有 top 列表
const topConsistent = queries.every(q => q.phrase_ta === 0 ? !(q.top && q.top.length) : true);
J('R4.1', 'phrase_ta=0 的查询 top 必须为空', topConsistent, '有「0 命中却带 top 列表」的自相矛盾行');

// R5：反向用例（防恒绿）。把一条 phrase_ta 改成 1，R3.1 必须变红
{
  const mutated = queries.map((q, i) => i === 0 ? { ...q, phrase_ta: 1 } : q);
  const wouldFire = mutated.some(q => q.phrase_ta !== 0);
  J('R5.1', '反向用例：注入 1 篇命中后判据必须响', wouldFire,
    wouldFire ? '承重判据对注入敏感' : '❌ R3.1 是恒绿考题');
}

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('反驳套件判据 v0.1 —— demo/lit-recheck\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(8)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}`);
if (passed.length !== ran.length) {
  console.log('\n本轮结果作废：口径不自洽或承重主张已被推翻而未报。');
  process.exit(2);
}
process.exit(0);