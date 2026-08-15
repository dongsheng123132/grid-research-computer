#!/usr/bin/env node
// priority-v2.mjs — 已预注册的「首次晶体结构」优先权审计第二轮。
// 重要：本脚本只把结果写到 --out 指定的 demo/ 外路径；最终产物由调用方经南桥落盘。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PREREG = path.join(HERE, 'PREREG-priority-v2.json');
const EXPECTED_PREREG_SHA = '28a4c90ea121b20cca366f3096e61f371fae23075b814305bc7fdb2a25a6bc66';
const PHRASE = 'the first crystal structure of';
const MAIL = 'HEFANGSHENG@gmail.com';
const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0 ? path.resolve(process.argv[outArg + 1]) : path.join(ROOT, '.goai/result-priority-v2.json');
const CACHE = path.join(ROOT, '.goai/cache-priority-v2.json');

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if (!fs.existsSync(PREREG) || sha(PREREG) !== EXPECTED_PREREG_SHA) {
  console.error('✘ v2 预注册件缺失或哈希改变，拒绝查询');
  process.exit(4);
}

const keyfile = path.join(ROOT, '.secrets/openalex.env');
const KEY = (fs.existsSync(keyfile) ? (/OPENALEX_API_KEY=(\S+)/.exec(fs.readFileSync(keyfile, 'utf8')) || [])[1] : null)
  || process.env.OPENALEX_API_KEY || null;
const auth = KEY ? { Authorization: `Bearer ${KEY}` } : {};
const UA = `gap-probe/priority-v2 (mailto:${MAIL})`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const rebuild = inv => {
  if (!inv) return '';
  const words = [];
  for (const [word, positions] of Object.entries(inv)) for (const i of positions) words[i] = word;
  return words.join(' ');
};

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'.split(' '));
const BLACKLIST = new Set(['UP1','NS5','HIV1','SARS2','COVID19','RNA1','DNA1','ATP1','NAD1','FAD1','AP1','SP1','VP1']);
const BIOMED = /\b(protein|domain|virus|viral|rna|dna|receptor|enzyme|antibody|peptide|polymerase|kinase|ribosom|capsid|antigen|genome|binding protein)\b/i;
const SUBSCRIPTS = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9' };
const asciiSubscripts = s => (s || '').replace(/[₀-₉]/g, c => SUBSCRIPTS[c]);

function parseFormula(token) {
  token = asciiSubscripts(token);
  if (BLACKLIST.has(token.toUpperCase())) return null;
  const parts = [];
  const re = /([A-Z][a-z]?)(\d*)/g;
  let m, cursor = 0;
  while ((m = re.exec(token))) {
    if (m.index !== cursor || !ELEMENTS.has(m[1])) return null;
    parts.push({ element: m[1], count: m[2] ? Number(m[2]) : 1 });
    cursor = re.lastIndex;
  }
  if (cursor !== token.length || parts.length < 2) return null;
  if (new Set(parts.map(p => p.element)).size < 2) return null;
  if (!/\d/.test(token) && parts.length < 3) return null;
  return { token, parts };
}

function formulaCandidates(title) {
  const candidates = [];
  const source = asciiSubscripts(title);
  for (const m of source.matchAll(/\b[A-Z][A-Za-z0-9]{2,23}\b/g)) {
    const parsed = parseFormula(m[0]);
    if (parsed) candidates.push(parsed.token);
  }
  return [...new Set(candidates)];
}

function extractTitleFormula(title) {
  if (BIOMED.test(title || '')) return { formula: null, reason: 'biomedical_title' };
  const candidates = formulaCandidates(title);
  if (candidates.length === 0) return { formula: null, reason: 'no_formula' };
  if (candidates.length > 1) return { formula: null, reason: 'ambiguous_formula', candidates };
  return { formula: candidates[0], reason: null };
}

// 抽取器反向用例先行，避免 UP1/NS5 事故复发。
let extractorOk = true;
for (const f of ['BaTiO3','Na3HfF7','LiCoO2']) {
  if (extractTitleFormula(`The first crystal structure of ${f}`).formula !== f) extractorOk = false;
}
for (const f of ['UP1','NS5','HIV1']) {
  if (extractTitleFormula(`The first crystal structure of ${f} domain`).formula !== null) extractorOk = false;
}
if (!extractorOk) {
  console.error('✘ 化学式抽取器对照失败，整轮作废');
  process.exit(2);
}
console.log('✔ 化学式抽取器对照通过（含 UP1 / NS5 反向用例）');

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
function rawNormalizeFormula(formula) {
  const counts = {};
  for (const m of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    counts[m[1]] = (counts[m[1]] || 0) + (m[2] ? Number(m[2]) : 1);
  }
  return Object.keys(counts).sort().map(e => e + (counts[e] === 1 ? '' : counts[e])).join(' ');
}
async function cod(formula) {
  const query = rawNormalizeFormula(formula);
  if (Object.hasOwn(cache, query)) return cache[query];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const url = `https://www.crystallography.net/cod/result.php?formula=${encodeURIComponent(query)}&format=json`;
      const response = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`COD HTTP ${response.status}`);
      const text = await response.text();
      const data = text.trim() ? JSON.parse(text) : [];
      const refs = data.map(x => ({
        cod: x.file,
        year: Number(x.year) || null,
        doi: x.doi || null,
        journal: (x.journal || '').slice(0, 80),
        formula: x.formula || null
      })).filter(x => x.year).sort((a,b) => a.year - b.year);
      const result = { n: data.length, earliest: refs[0]?.year ?? null, refs: refs.slice(0, 5) };
      cache[query] = result;
      fs.mkdirSync(path.dirname(CACHE), { recursive: true });
      fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));
      return result;
    } catch (error) {
      if (attempt === 3) return { unresolved: true, error: String(error.message || error) };
      await sleep(2000 * attempt);
    }
  }
}

// COD 对照前置。负对照故意使用不存在的元素式，只检验 COD 空结果通道。
let controlsOk = true;
const controlResults = { positive: {}, negative: {} };
for (const f of ['BaTiO3','LiCoO2','MgAl2O4','SrTiO3','CaTiO3','ZnFe2O4']) {
  const r = await cod(f); controlResults.positive[f] = r;
  if (r.unresolved || !(r.n > 0) || !(r.earliest < 2000)) controlsOk = false;
  await sleep(500);
}
for (const f of ['Zq2Xy3O7','Qw1Er2Ty3','Xx3Yy4Zz5']) {
  const r = await cod(f); controlResults.negative[f] = r;
  if (r.unresolved || r.n !== 0) controlsOk = false;
  await sleep(500);
}
if (!controlsOk) {
  fs.writeFileSync(OUT, JSON.stringify({ preregSha: EXPECTED_PREREG_SHA, void: true, reasons: ['COD control failure'], controlResults }, null, 2));
  console.error('✘ COD 对照失败，整轮作废');
  process.exit(2);
}
console.log('✔ COD 对照通过');

async function openAlex(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, ...auth }, signal: AbortSignal.timeout(60000) });
      const body = await response.json();
      if (!response.ok || body.error) throw new Error(body.message || body.error || `OpenAlex HTTP ${response.status}`);
      return body;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(3000 * attempt);
    }
  }
}

// 盖章完成后才执行到这里。先探可用性，失败则不做半轮。
await openAlex(`https://api.openalex.org/works?filter=title.search:perovskite&per-page=1&mailto=${MAIL}`);
console.log('✔ OpenAlex 可用');

const works = [];
let cursor = '*', pages = 0, metaCount = null, complete = false;
while (cursor) {
  const filter = 'primary_topic.field.id:16|25';
  const select = 'id,doi,title,publication_year,abstract_inverted_index,primary_topic';
  const url = `https://api.openalex.org/works?search=${encodeURIComponent('"' + PHRASE + '"')}`
    + `&filter=${encodeURIComponent(filter)}&per-page=100&cursor=${encodeURIComponent(cursor)}`
    + `&select=${encodeURIComponent(select)}&mailto=${MAIL}`;
  const page = await openAlex(url);
  pages++;
  if (metaCount === null) metaCount = page.meta?.count ?? null;
  works.push(...(page.results || []));
  const next = page.meta?.next_cursor || null;
  if (!next || (page.results || []).length === 0) { complete = true; break; }
  cursor = next;
  if (pages > 200) throw new Error('cursor 超过 200 页安全上限，未完整遍历');
  await sleep(300);
}

const unique = [...new Map(works.map(w => [w.id, w])).values()];
const np = norm(PHRASE);
const exclusions = { wrong_field: 0, not_literal: 0, biomedical_title: 0, no_formula: 0, ambiguous_formula: 0, missing_year: 0 };
const rows = [];
let literalVerified = 0;
for (const work of unique) {
  const fieldId = String(work.primary_topic?.field?.id || '').split('/').pop();
  if (!['16','25'].includes(fieldId)) { exclusions.wrong_field++; continue; }
  const text = norm(`${work.title || ''} ${rebuild(work.abstract_inverted_index)}`);
  if (!text.includes(np)) { exclusions.not_literal++; continue; }
  literalVerified++;
  const extracted = extractTitleFormula(work.title);
  if (!extracted.formula) { exclusions[extracted.reason]++; continue; }
  if (!work.publication_year) { exclusions.missing_year++; continue; }
  rows.push({
    openalex_id: work.id,
    doi: (work.doi || '').replace('https://doi.org/',''),
    year: work.publication_year,
    title: work.title,
    formula: extracted.formula,
    primary_topic: {
      display_name: work.primary_topic?.display_name || null,
      field: work.primary_topic?.field?.display_name || null,
      subfield: work.primary_topic?.subfield?.display_name || null,
      domain: work.primary_topic?.domain?.display_name || null
    }
  });
}

const tally = { PRIOR_CANDIDATE: [], SINCE_OR_SAME_YEAR: [], UNKNOWN: [], UNRESOLVED: [] };
for (const row of rows) {
  const c = await cod(row.formula);
  let category;
  if (c.unresolved) category = 'UNRESOLVED';
  else if (c.n === 0) category = 'UNKNOWN';
  else if (c.earliest < row.year) category = 'PRIOR_CANDIDATE';
  else category = 'SINCE_OR_SAME_YEAR';
  tally[category].push({ ...row, cod: c });
  await sleep(700);
}

const classified = rows.length - tally.UNRESOLVED.length;
const unresolvedRate = rows.length ? tally.UNRESOLVED.length / rows.length : 0;
const voidReasons = [];
if (!complete || (metaCount !== null && unique.length !== metaCount)) voidReasons.push(`OpenAlex cursor incomplete: meta=${metaCount}, unique=${unique.length}`);
if (unresolvedRate > 0.30) voidReasons.push(`UNRESOLVED rate ${(unresolvedRate * 100).toFixed(1)}% > 30%`);
if (classified < 10) voidReasons.push(`classified unique claims ${classified} < 10`);

const result = {
  spec: 'gap-probe/priority-v2/result-1',
  preregSha: EXPECTED_PREREG_SHA,
  runAt: new Date().toISOString(),
  openalex: { query: PHRASE, filter: 'primary_topic.field.id:16|25', metaCount, fetched: works.length, unique: unique.length, pages, complete },
  gates: { literalVerified, includedUniqueClaims: rows.length, exclusions },
  controlResults,
  tally,
  manualReview: { required: tally.PRIOR_CANDIDATE.length, completed: 0, verdicts: [] },
  void: voidReasons.length > 0,
  voidReasons,
  caveats: [
    'OpenAlex 检索可能命中正文而 API 不提供正文；未能在标题或摘要字面复核者按预注册排除。',
    'COD 空集只记 UNKNOWN，不表示不存在或未合成。',
    'PRIOR_CANDIDATE 未经逐条人工复核前不得报告为 PRIOR。'
  ]
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(`OpenAlex 总体 ${metaCount}，完整取回 ${unique.length}（${pages} 页）`);
console.log(`字面核实 ${literalVerified}，标题唯一化学式 ${rows.length}`);
console.log(`PRIOR_CANDIDATE ${tally.PRIOR_CANDIDATE.length} / SINCE ${tally.SINCE_OR_SAME_YEAR.length} / UNKNOWN ${tally.UNKNOWN.length} / UNRESOLVED ${tally.UNRESOLVED.length}`);
console.log(result.void ? `✘ 本轮作废：${voidReasons.join('；')}` : '✔ 自动闸门通过，进入 PRIOR_CANDIDATE 人工复核');
console.log(`→ ${OUT}`);
process.exit(result.void ? 2 : 0);
