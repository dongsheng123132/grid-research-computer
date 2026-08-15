#!/usr/bin/env node
// audit.mjs — 已发表「新化合物预测」的兑现率审计
//
// 换方向的理由（2026-08-11 用户指出「方向还没跑对」）：
// 前四轮都在跟自然界比谁更懂化学——那件事我没有领域直觉、没有实验、没有付费数据，
// 跑得再快也没用，因为瓶颈不是速度。而今天唯一出金子的一次是**逐篇核同一件小事**（0/37）。
// 所以方向从「用 AI 发现自然的规律」换成「用 AI 审计科学的账本」。
//
// 问的问题：论文点名说「这个化合物数据库里没有、是候选新材料」——**它当时真的不存在吗？**
//
// 三个结局，第三个是要淘的金：
//   SINCE   论文之后才出现结构报告 → 预测兑现，方法有效的正面证据
//   UNKNOWN COD 中仍无 → 预测还悬着
//   PRIOR   **论文发表之前就已有published结构** → 该论文的「空」是假的
//
// ⚠ **强弱不对称，先声明**：找到一条早于论文的结构，是近乎不可赖账的（PRIOR 强）；
//    找不到只说明 COD 里没有——COD ≠ ICSD，UNKNOWN 很弱。**只有 PRIOR 这一边可以下结论。**
//    这正是第一轮死于其上的那条：证空是全称否定，证满是存在性。
//
// 用法：
//   node demo/gap-probe/audit.mjs --prereg   冻结规则，不发任何请求
//   node demo/gap-probe/audit.mjs --run      校验冻结件 → 跑对照 → 对照过了才审计
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PREREG = path.join(HERE, 'PREREG-audit.json');
const UA = 'gap-probe/0.4 (research; mailto:HEFANGSHENG@gmail.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 先于数据冻结的一切 ───────────────────────────────────────────────────
// 化学式规范化：元素按字母序，计数 1 省略，空格分隔 —— COD 的 formula 查询口径。
// 确定性函数，同一输入永远同一输出。
function normalize(formula) {
  const m = {};
  for (const [, el, n] of formula.matchAll(/([A-Z][a-z]?)(\d*\.?\d*)/g)) {
    if (!el) continue;
    m[el] = (m[el] || 0) + (n === '' ? 1 : parseFloat(n));
  }
  return Object.keys(m).sort().map(e => e + (m[e] === 1 ? '' : String(m[e]))).join(' ');
}

const RULES = {
  question: '论文点名为「数据库中不存在 / 尚未合成」的化合物，在该论文发表之前是否已有已发表的晶体结构？',
  source: 'Crystallography Open Database (COD)，result.php?formula=<规范式>&format=json',
  normalization: '元素按字母序、计数 1 省略、空格分隔；由 normalize() 确定性给出',
  classify: {
    PRIOR: 'COD 中存在该化学式的条目，且其最早 year < 论文 year → 论文声称的「空」为假',
    SINCE: 'COD 中存在该化学式的条目，但最早 year >= 论文 year → 预测兑现',
    UNKNOWN: 'COD 中无该化学式条目 → 仍未知',
    UNRESOLVED: '查询失败 → **不知道**，不得并入 UNKNOWN'
  },
  asymmetry: 'PRIOR 是存在性证据，强；UNKNOWN 是全称否定，弱（COD ≠ ICSD）。只有 PRIOR 一边下结论。',
  positiveControls: ['BaTiO3', 'LiCoO2', 'MgAl2O4', 'SrTiO3', 'CaTiO3', 'ZnFe2O4'],
  positiveControlRule: '这 6 个必须全部返回非空且最早年份 < 2000；任一失败则整轮作废，不产出任何审计结论',
  negativeControls: ['Zq2Xy3O7', 'Qw1Er2Ty3', 'Xx3Yy4Zz5'],
  negativeControlRule: '这 3 个必须全部返回空；任一非空说明查询口径失效，整轮作废',
  voidIf: '阳性/阴性对照任一不过；或 UNRESOLVED 比例 > 30%',
  reportMustInclude: ['三类计数与 UNRESOLVED 单独计数', '每条 PRIOR 的双向出处（预测论文 DOI + 早于它的结构条目 COD id/年份/DOI）', '化学式抽取自 predictions.json 的覆盖率'],
  note: '同化学式不等于同结构（多晶型）。但论文的主张是「该组分未被报道」，故化学式粒度正是该主张的粒度。'
};

const body = JSON.stringify(RULES, null, 2);
const sha = crypto.createHash('sha256').update(body).digest('hex');

if (process.argv.includes('--prereg')) {
  if (fs.existsSync(PREREG)) {
    const oldSha = crypto.createHash('sha256').update(fs.readFileSync(PREREG, 'utf8')).digest('hex');
    console.log(oldSha === sha ? '冻结件已存在且一致。' : '⚠ 盘上冻结件与重算不一致，拒绝覆盖。');
    process.exit(oldSha === sha ? 0 : 4);
  }
  fs.writeFileSync(PREREG, body);
  console.log('已冻结 → demo/gap-probe/PREREG-audit.json');
  console.log(`  sha256 = ${sha}`);
  console.log(`  阳性对照 ${RULES.positiveControls.length} 个　阴性对照 ${RULES.negativeControls.length} 个`);
  console.log(`  作废条件：${RULES.voidIf}`);
  process.exit(0);
}

// ── phase B ──────────────────────────────────────────────────────────────
if (!fs.existsSync(PREREG)) { console.error('没有冻结件，先跑 --prereg'); process.exit(1); }
const diskSha = crypto.createHash('sha256').update(fs.readFileSync(PREREG, 'utf8')).digest('hex');
if (diskSha !== sha) { console.error('✘ 冻结件与代码重算不一致，拒绝运行（先看数据再改规则，在这里跑不通）'); process.exit(4); }

const CACHE = path.join(HERE, 'cache-audit.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const errs = {};

async function lookup(formula) {
  const key = normalize(formula);
  if (cache[key]) return cache[key];
  const url = `https://www.crystallography.net/cod/result.php?formula=${encodeURIComponent(key)}&format=json`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) { errs[key] = 'HTTP ' + r.status; await sleep(3000 * (i + 1)); continue; }
      const txt = await r.text();
      let out;
      if (!txt.trim() || txt.trim() === '[]') out = { n: 0, earliest: null, refs: [] };
      else {
        const j = JSON.parse(txt);
        const rows = j.map(x => ({ cod: x.file, year: +x.year || null, doi: x.doi || null, journal: (x.journal || '').slice(0, 40) }))
          .filter(x => x.year).sort((a, b) => a.year - b.year);
        out = { n: j.length, earliest: rows.length ? rows[0].year : null, refs: rows.slice(0, 3) };
      }
      cache[key] = out; fs.writeFileSync(CACHE, JSON.stringify(cache));
      return out;
    } catch (e) { errs[key] = `${e.name}: ${e.message}`; await sleep(3000 * (i + 1)); }
  }
  console.error(`    ✗ ${key} 三次失败：${errs[key]}`);
  return null;
}

// 阶段 0：对照前置
console.log('阶段 0 —— 对照前置（不过就不产出任何审计结论）\n');
let ctlOk = true;
for (const f of RULES.positiveControls) {
  const r = await lookup(f);
  const ok = r && r.n > 0 && r.earliest && r.earliest < 2000;
  if (!ok) ctlOk = false;
  console.log(`  阳性 ${f.padEnd(9)} ${r ? `条目=${String(r.n).padStart(3)} 最早=${r.earliest}` : '查询失败'}  ${ok ? '✔' : '✘'}`);
  await sleep(1200);
}
for (const f of RULES.negativeControls) {
  const r = await lookup(f);
  const ok = r && r.n === 0;
  if (!ok) ctlOk = false;
  console.log(`  阴性 ${f.padEnd(9)} ${r ? `条目=${r.n}` : '查询失败'}  ${ok ? '✔' : '✘'}`);
  await sleep(1200);
}
if (!ctlOk) { console.error('\n✘ 对照未通过 —— 按冻结规则整轮作废，不产出审计结论。'); process.exit(2); }
console.log('\n✔ 对照通过\n');

// 阶段 1：审计
const PRED = path.join(HERE, 'predictions.json');
if (!fs.existsSync(PRED)) { console.error('缺 predictions.json（hermes 的抽取产出）'); process.exit(1); }
const pred = JSON.parse(fs.readFileSync(PRED, 'utf8'));
const all = pred.predictions || [];

// ── 入选闸门：只审「论文声称它不存在」的那些 ──────────────────────────────
// 冻结规则里写着入选条件是「论文点名为**数据库中不存在 / 尚未合成**的化合物」，
// 但规则写在预注册里、代码里没实现，就是一条只存在于文档里的约束（本仓库的老病）。
// 实弹教训：hermes 的清单里混着 AgGaSe₂、AgInS₂ —— 它们 COD 里有 1953 年的条目，
// 但论文多半是把它们当**已知验证集**列的。不加这道闸，审计会产出算术正确的诬告。
const ASSERTS_ABSENCE = /(absent|not\s+(present|found|listed)|no[t]?\s+in\s+(the\s+)?(icsd|mp|cod|materials\s+project|database)|(not|never|hitherto|yet)\s+(been\s+)?(synthes|report|observ)|unreported|hitherto\s+unknown|未合成|未报道|不存在)/i;   // 收紧：只认**明确声称不存在**的措辞。上一版含 candidate|hypothetical|new predicted，把「most promising candidates」这类没有存在性主张的也放了进来，导致 4 条误入（W2FeB2 / Li7NbO6 / Li4Mo3O8 / Li5NaN2）。冻结规则写的就是「点名为数据库中不存在」——**是实现比规则松，改正则是修 bug，不是改规则。**
const list = all.filter(p => ASSERTS_ABSENCE.test(p.claim || ''));
const excluded = all.filter(p => !ASSERTS_ABSENCE.test(p.claim || ''));
console.log(`predictions.json 共 ${all.length} 条`);
console.log(`  入选（claim 声称不存在/未合成）  ${list.length}`);
console.log(`  排除（claim 未声称不存在）      ${excluded.length}   ← 不审它们，否则是诬告`);
if (excluded.length) console.log('  被排除的前 8 条：' + excluded.slice(0, 8).map(p => p.formula).join(' '));
console.log('');

const out = { PRIOR: [], SINCE: [], UNKNOWN: [], UNRESOLVED: [] };
for (const [i, p] of list.entries()) {
  const r = await lookup(p.formula);
  if (r === null) { out.UNRESOLVED.push(p); }
  else if (r.n === 0) { out.UNKNOWN.push({ ...p, cod: 0 }); }
  else if (r.earliest !== null && p.year && r.earliest < p.year) { out.PRIOR.push({ ...p, earliest: r.earliest, refs: r.refs, cod: r.n }); }
  else { out.SINCE.push({ ...p, earliest: r.earliest, cod: r.n }); }
  if ((i + 1) % 10 === 0) process.stderr.write(`  ${i + 1}/${list.length}\n`);
  await sleep(1200);
}

const tot = list.length, unres = out.UNRESOLVED.length;
console.log(`\n结果（预注册 sha256=${sha.slice(0, 16)}…）`);
console.log(`  PRIOR   发表时就已存在   ${out.PRIOR.length}   ← 强证据`);
console.log(`  SINCE   发表后才出现     ${out.SINCE.length}`);
console.log(`  UNKNOWN COD 中仍无       ${out.UNKNOWN.length}   ← 弱，COD ≠ ICSD`);
console.log(`  UNRESOLVED 查询失败      ${unres}   ← 不是 0，是不知道`);
if (unres / tot > 0.3) console.log('\n⚠ UNRESOLVED 超过 30%，按冻结规则本轮结论作废。');
console.log('\n每条 PRIOR 的双向出处：');
for (const p of out.PRIOR) {
  console.log(`  ${p.formula.padEnd(12)} 论文 ${p.year} (${p.source_doi || p.source_arxiv})`);
  for (const r of p.refs) console.log(`      ← COD ${r.cod} 年份 ${r.year} ${r.doi || r.journal}`);
}
fs.writeFileSync(path.join(HERE, 'result-audit.json'), JSON.stringify({ preregSha: sha, counts: { PRIOR: out.PRIOR.length, SINCE: out.SINCE.length, UNKNOWN: out.UNKNOWN.length, UNRESOLVED: unres }, ...out }, null, 2));
