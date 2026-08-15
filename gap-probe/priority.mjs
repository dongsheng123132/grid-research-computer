#!/usr/bin/env node
// priority.mjs — 「首次报道」优先权主张审计（第二个领域实例）
//
// 为什么是这个：2026-08-12 检索先行工作时明确报出空白——
//   "I didn't find bibliometric studies specifically quantifying how often
//    'first report of' claims in chemistry are contradicted by prior literature."
// 而撤稿引用（本来的备选）已被研究透（38~44% 引用发生在撤稿后，<7% 提及撤稿），不做。
// **这一次是动手之前核的先行工作**；前两轮都是做完才发现撞车。
//
// 与第一个实例的关系：仪器完全相同，主张更硬。
//   实例一「X 不在 ICSD 里」—— 弱主张，可能字面为真（库有漏），只能测推断失效率。
//   实例二「我们首次报道 X 的晶体结构」—— **强主张，一条更早的实验报道即可直接推翻。**
//
// 关键限定（来自专利法 MPEP §2121 的区分，检索时带出来的）：
//   **「结构上被披露」≠「真的被制备并表征」**。所以只有更早的**实验**报道才算推翻，
//   而 COD 收的正是实验晶体结构 —— 仪器与主张恰好对得上。
//
// ── 先于数据冻结的规则 ──────────────────────────────────────────────────
// 检索：OpenAlex 短语 "the first crystal structure of"
// 核实：短语必须字面出现在标题或摘要中（OpenAlex 短语检索会静默退化，2026-08-12 实测）
// 抽取：**只收化学式出现在标题里的那个子集** —— 化学名转化学式不可靠，宁可缩小总体也不猜。
//        这是一个**声明过的子集**，不是全体；覆盖率随结论一起报。
// 判定：COD 中该化学式最早 year < 论文 year → PRIOR（优先权主张被更早的实验报道推翻）
//        COD 无该式 → UNKNOWN（弱，COD ≠ 全部文献）
//        查询失败 → UNRESOLVED，**不得并入 UNKNOWN**
// 对照：阳性 6 个（须非空且最早 <2000）、阴性 3 个（须为空），不过则整轮作废。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PHRASE = 'the first crystal structure of';
const WANT = +(process.argv[process.argv.indexOf('--n') + 1] || 200);
const RULES = {
  phrase: PHRASE,
  verify: '短语须字面出现在 title 或 abstract',
  subset: '只收标题中含化学式 token 的条目（声明过的子集，非全体）',
  classify: { PRIOR: 'COD 最早 year < 论文 year', UNKNOWN: 'COD 无', UNRESOLVED: '查询失败，不并入 UNKNOWN' },
  positiveControls: ['BaTiO3', 'LiCoO2', 'MgAl2O4', 'SrTiO3', 'CaTiO3', 'ZnFe2O4'],
  negativeControls: ['Zq2Xy3O7', 'Qw1Er2Ty3', 'Xx3Yy4Zz5'],
  voidIf: '对照任一不过；或 UNRESOLVED > 30%',
  caveat: '结构上被披露 ≠ 真的被制备表征（MPEP §2121）；只有更早的实验报道算推翻，故用 COD'
};
const PREREG = path.join(HERE, 'PREREG-priority.json');
const body = JSON.stringify(RULES, null, 2);
const sha = crypto.createHash('sha256').update(body).digest('hex');
if (!fs.existsSync(PREREG)) { fs.writeFileSync(PREREG, body); console.log(`已冻结规则 sha256=${sha}\n`); }
else if (crypto.createHash('sha256').update(fs.readFileSync(PREREG, 'utf8')).digest('hex') !== sha) {
  console.error('✘ 冻结件与代码重算不一致，拒绝运行'); process.exit(4);
}

const KEY = (/OPENALEX_API_KEY=(\S+)/.exec(fs.readFileSync(path.resolve(HERE, '../../.secrets/openalex.env'), 'utf8')) || [])[1];
const auth = { Authorization: `Bearer ${KEY}` };
const UA = 'gap-probe/0.6 (research; mailto:HEFANGSHENG@gmail.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const rebuild = inv => { if (!inv) return ''; const p = []; for (const [w, ix] of Object.entries(inv)) for (const i of ix) p[i] = w; return p.join(' '); };

function counts(f) {
  const st = [{}]; const mg = (d, s, m) => { for (const k in s) d[k] = (d[k] || 0) + s[k] * m; };
  const re = /([A-Z][a-z]?)(\d*\.?\d*)|(\()|(\))(\d*\.?\d*)/g; let m;
  while ((m = re.exec(f))) {
    if (m[1]) { const t = st[st.length - 1]; t[m[1]] = (t[m[1]] || 0) + (m[2] === '' ? 1 : parseFloat(m[2])); }
    else if (m[3]) st.push({}); else if (m[4]) { const t = st.pop(); mg(st[st.length - 1], t, m[5] === '' ? 1 : parseFloat(m[5])); }
  }
  return st[0];
}
const normalize = f => { const c = counts(f); return Object.keys(c).sort().map(e => e + (c[e] === 1 ? '' : String(c[e]))).join(' '); };

// 只认「像化学式」的 token：≥2 个元素符号、含数字或 ≥3 段、长度合理。宁缺毋滥。
const ELEM = 'H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Y|Zr|Nb|Mo|Tc|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I|Xe|Cs|Ba|La|Ce|Pr|Nd|Sm|Eu|Gd|Tb|Dy|Ho|Er|Tm|Yb|Lu|Hf|Ta|W|Re|Os|Ir|Pt|Au|Hg|Tl|Pb|Bi|Th|U';
const FORMULA = new RegExp(`\\b((?:(?:${ELEM})\\d*){2,})\\b`, 'g');
const BADWORDS = /^(in|is|as|of|be|no|on|at|to|it|we|can|has|new|one|two|non|van|per|for|and|the)$/i;
function extractFormula(title) {
  const cand = [...(title || '').matchAll(FORMULA)].map(m => m[1])
    .filter(f => /\d/.test(f) && f.length >= 3 && f.length <= 24 && !BADWORDS.test(f));
  return cand.length === 1 ? cand[0] : null;   // 有歧义就不要 —— 猜错比漏掉贵
}

const CACHE = path.join(HERE, 'cache-audit.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
async function cod(f) {
  const k = normalize(f);
  if (cache[k]) return cache[k];
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://www.crystallography.net/cod/result.php?formula=${encodeURIComponent(k)}&format=json`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) { await sleep(3000 * (i + 1)); continue; }
      const t = await r.text(); const j = t.trim() ? JSON.parse(t) : [];
      const rows = j.map(x => ({ cod: x.file, year: +x.year || null, doi: x.doi, journal: (x.journal || '').slice(0, 32) }))
        .filter(x => x.year).sort((a, b) => a.year - b.year);
      const out = { n: j.length, earliest: rows.length ? rows[0].year : null, refs: rows.slice(0, 2) };
      cache[k] = out; fs.writeFileSync(CACHE, JSON.stringify(cache)); return out;
    } catch { await sleep(3000 * (i + 1)); }
  }
  return null;
}

// 对照前置
let ok = true;
for (const f of RULES.positiveControls) { const r = await cod(f); if (!(r && r.n > 0 && r.earliest < 2000)) ok = false; await sleep(900); }
for (const f of RULES.negativeControls) { const r = await cod(f); if (!(r && r.n === 0)) ok = false; await sleep(900); }
if (!ok) { console.error('✘ 对照未通过，整轮作废'); process.exit(2); }
console.log('✔ 对照通过\n');

// 取样并核实
const url = `https://api.openalex.org/works?search=${encodeURIComponent('"' + PHRASE + '"')}`
  + `&per-page=${Math.min(WANT, 200)}&select=doi,title,publication_year,abstract_inverted_index`;
const j = await (await fetch(url, { headers: { 'User-Agent': UA, ...auth } })).json();
const got = j.results || [];
const np = norm(PHRASE);
let verified = 0, withFormula = 0;
const rows = [];
for (const w of got) {
  const text = norm((w.title || '') + ' ' + rebuild(w.abstract_inverted_index));
  if (!text.includes(np)) continue;
  verified++;
  const f = extractFormula(w.title);
  if (!f) continue;
  withFormula++;
  rows.push({ formula: f, year: w.publication_year, doi: (w.doi || '').replace('https://doi.org/', ''), title: w.title });
}
console.log(`OpenAlex 命中总数 ${j.meta.count}　取回 ${got.length}　**回摘要/标题核实 ${verified}**　标题中可抽出唯一化学式 ${withFormula}\n`);

const tally = { PRIOR: [], SINCE: [], UNKNOWN: [], UNRESOLVED: [] };
for (const r of rows) {
  const c = await cod(r.formula);
  const cls = c === null ? 'UNRESOLVED' : c.n === 0 ? 'UNKNOWN' : (c.earliest < r.year ? 'PRIOR' : 'SINCE');
  tally[cls].push({ ...r, earliest: c?.earliest ?? null, refs: c?.refs ?? [] });
  await sleep(1100);
}
console.log(`判定（子集 ${rows.length} 条）`);
console.log(`  PRIOR      更早的实验结构已存在   ${tally.PRIOR.length}`);
console.log(`  SINCE/同年 ${tally.SINCE.length}`);
console.log(`  UNKNOWN    COD 中无             ${tally.UNKNOWN.length}   ← 弱`);
console.log(`  UNRESOLVED                      ${tally.UNRESOLVED.length}   ← 不是 0，是不知道`);
for (const p of tally.PRIOR) {
  console.log(`\n  ${p.formula}  论文 ${p.year}  ${p.doi}`);
  console.log(`    ${(p.title || '').slice(0, 92)}`);
  p.refs.forEach(r => console.log(`    ← COD ${r.cod}  ${r.year}  ${r.doi || r.journal}`));
}
fs.writeFileSync(path.join(HERE, 'result-priority.json'), JSON.stringify({ preregSha: sha, phrase: PHRASE, openalexCount: j.meta.count, fetched: got.length, verified, withFormula, tally }, null, 2));
