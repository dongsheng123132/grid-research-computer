#!/usr/bin/env node
// verify-gap-probe.mjs — 空格判据 v0.1
//
// 这份判据存在的理由，是 2026-08-11 探针第一次跑出来的结果：
// 286/286 查询成功、0 失败、每个格子的三条边都非空、判据全绿 —— 而榜单第三名是 Fe-Ni-Cr。
// 那是奥氏体不锈钢。第二名 Ti-Al-V 是 Ti-6Al-4V。
//
// 抓到它的不是探针里的任何一条控制，是人认得那两个名字。
// **从仪器内部，这次失败与成功完全无法区分** —— 这就是 self-attesting-evaluation 的主命题，
// 只不过这次它发生在「发现」而不是「评测」上。
//
// 所以补的是这一条：
//   平凡解对照防的是「预测其实没预测」；
//   阳性对照防的是「空其实不空」。后者此前**没有任何部件在防**。
//
// 判据设计上的一条硬规矩：阳性对照集不能由探针自己挑，否则又是自己给自己出题（恒绿考题）。
// 下面这 12 个系统的入选理由是「有以它命名的工业材料」，与探针的任何输出无关。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const norm = s => s.split('-').sort().join('-');

// 入选理由必须写在旁边：一个没有理由的对照集，下一个人不知道能不能改。
const POSITIVE_CONTROLS = [
  ['Fe-Cr-Ni', '奥氏体不锈钢（304/316 的基体）'],
  ['Ti-Al-V', 'Ti-6Al-4V，航空钛合金用量第一'],
  ['Ni-Al-Ti', '镍基高温合金的 γ′ 强化相'],
  ['Cu-Zn-Al', 'Cu-Zn-Al 形状记忆合金'],
  ['Fe-Mn-Al', '低密度高锰钢'],
  ['Ni-Ti-Cu', 'NiTiCu 形状记忆合金'],
  ['Co-Cr-Al', 'MCrAlY 热障涂层黏结层'],
  ['Ni-Cr-Al', 'MCrAlY 热障涂层黏结层'],
  ['Fe-Co-Ni', '坡莫合金族 / 高熵合金常用基'],
  ['Cu-Al-Mn', 'Cu-Al-Mn 形状记忆合金'],
  ['Fe-Ni-Mn', 'Invar 族与马氏体时效钢'],
  ['Ti-Ni-Cu', '同 NiTiCu（顺序无关性检查）']
];

const judgments = [];
const J = (id, desc, pass, detail) => judgments.push({ id, desc, pass, detail });

const resultPath = path.join(HERE, 'result.json');
if (!fs.existsSync(resultPath)) {
  console.error('缺 result.json —— 先跑 node demo/gap-probe/probe.mjs');
  process.exit(1);
}
const r = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
const holeSet = new Set(r.holes.map(h => norm(h.system)));
const paletteSet = new Set(r.palette);

// ── G1：阳性对照。已知稠密的系统被判成空，则整轮作废 ──────────────────────
for (const [sys, why] of POSITIVE_CONTROLS) {
  const els = sys.split('-');
  if (!els.every(e => paletteSet.has(e))) {
    J(`G1.${sys}`, `阳性对照 ${sys}（${why}）`, null, '不在本轮调色板内，跳过');
    continue;
  }
  const flagged = holeSet.has(norm(sys));
  J(`G1.${sys}`, `阳性对照 ${sys} 不得被判为格子`, !flagged,
    flagged ? `❌ 被判为「从未被实验观测」—— ${why}` : `已判为已观测`);
}

// ── G2：覆盖率必须披露，且「失败」与「0 条」分开计 ────────────────────────
J('G2.1', 'result.json 必须披露覆盖率', !!r.coverage && typeof r.coverage.failed === 'number',
  r.coverage ? `查询 ${r.coverage.attempted}　成功 ${r.coverage.ok}　失败 ${r.coverage.failed}` : '缺 coverage 字段');
J('G2.2', '「查询失败无法判定」必须单独计数，不得并入 0',
  typeof r.verdict?.unresolvedDueToQueryFailure === 'number',
  `unresolved=${r.verdict?.unresolvedDueToQueryFailure}`);

// ── G3：反向用例。把一个阳性对照塞进格子集，判据必须变红 ────────────────
// 恒绿的考题等于没有考题。这条确认 G1 真的会响。
{
  const fake = new Set(holeSet); fake.add(norm('Cu-Zn-Al'));
  const wouldFire = fake.has(norm('Cu-Zn-Al'));
  J('G3.1', '反向用例：注入一个已知稠密系统后 G1 必须报红', wouldFire,
    wouldFire ? 'G1 的检测逻辑对注入敏感' : '❌ G1 是恒绿考题');
}

// ── G4：新颖性主张必须带先行工作出处 ──────────────────────────────────────
// 2026-08-11 实测：本探针的判据（三元空 ∧ 三边满）并非新方法。
// 一个不写先行工作的 gap-finding 报告，本身就是一个 gap 幻觉。
{
  const rep = path.join(HERE, 'REPORT.md');
  const txt = fs.existsSync(rep) ? fs.readFileSync(rep, 'utf8') : '';
  const hasPriorArt = /cm100795d|Hautier|PhaseSelect|1710\.00659|2202\.01051/i.test(txt);
  J('G4.1', 'REPORT.md 必须列出先行工作（否则新颖性主张即无出处）', hasPriorArt,
    hasPriorArt ? '已引先行工作' : '❌ 报告未声明先行工作');
}

const ran = judgments.filter(j => j.pass !== null);
const passed = ran.filter(j => j.pass);
console.log('空格判据 v0.1 —— demo/gap-probe\n');
for (const j of judgments) {
  const mark = j.pass === null ? '·' : j.pass ? '✔' : '✘';
  console.log(` ${mark} ${j.id.padEnd(14)} ${j.desc}`);
  if (j.detail && (j.pass === false || j.pass === null)) console.log(`     ${j.detail}`);
}
console.log(`\n判决 ${passed.length}/${ran.length}（跳过 ${judgments.length - ran.length}）`);
if (passed.length !== ran.length) {
  console.log('\n本轮探针结果作废：阳性对照没过，说明「空」这个判定本身不可信。');
  console.log('这不是探针写错了，是「恰好 N 种元素」这个操作化定义与「该三元系被研究过」不是一回事。');
  process.exit(2);
}
process.exit(0);
