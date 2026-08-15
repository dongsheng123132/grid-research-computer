#!/usr/bin/env node
// audit4.mjs — 对「absent from ICSD」完整总体剩余 4 篇做 COD 审计
// 判定沿用 PREREG-audit.json（sha256 2721d218…）：COD 中该化学式最早年份 < 论文年份 → PRIOR。
// 化学式来源 .goai/audit4.json（hermes 抽取），出处已由人回原文抽查。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UA = 'gap-probe/0.5 (research; mailto:HEFANGSHENG@gmail.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function counts(f) {
  const stack = [{}];
  const merge = (d, s, m) => { for (const k in s) d[k] = (d[k] || 0) + s[k] * m; };
  const re = /([A-Z][a-z]?)(\d*\.?\d*)|(\()|(\))(\d*\.?\d*)/g;
  let m;
  while ((m = re.exec(f))) {
    if (m[1]) { const t = stack[stack.length - 1]; t[m[1]] = (t[m[1]] || 0) + (m[2] === '' ? 1 : parseFloat(m[2])); }
    else if (m[3]) stack.push({});
    else if (m[4]) { const t = stack.pop(); merge(stack[stack.length - 1], t, m[5] === '' ? 1 : parseFloat(m[5])); }
  }
  return stack[0];
}
const normalize = f => { const c = counts(f); return Object.keys(c).sort().map(e => e + (c[e] === 1 ? '' : String(c[e]))).join(' '); };

const CACHE = path.join(HERE, 'cache-audit.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
async function lookup(f) {
  const k = normalize(f);
  if (cache[k]) return cache[k];
  const url = `https://www.crystallography.net/cod/result.php?formula=${encodeURIComponent(k)}&format=json`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) { await sleep(3000 * (i + 1)); continue; }
      const txt = await r.text();
      const j = txt.trim() ? JSON.parse(txt) : [];
      const rows = j.map(x => ({ cod: x.file, year: +x.year || null, doi: x.doi || null, journal: (x.journal || '').slice(0, 34) }))
        .filter(x => x.year).sort((a, b) => a.year - b.year);
      const out = { n: j.length, earliest: rows.length ? rows[0].year : null, refs: rows.slice(0, 2) };
      cache[k] = out; fs.writeFileSync(CACHE, JSON.stringify(cache));
      return out;
    } catch { await sleep(3000 * (i + 1)); }
  }
  return null;
}

const src = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../.goai/audit4.json'), 'utf8'));

// ── 入选闸门（第一版漏了，代价是差点诬告 4 个教科书物质）────────────────────
// audit.mjs 里有这道闸，写 audit4.mjs 时没搬过来，于是 BN(1927)/BP(1957)/BAs(1963)
// 被算成「论文声称不存在却早已存在」——而 EES 2021 原文只把 **shaded** 那几行称作
// absent from ICSD，unshaded 是「screened from ICSD」的已知材料。
// hermes 在每条的 note 里写明了 unshaded / 不在 absent 主张内；**是我忽略了它的标注**。
// 教训与 AgGaSe₂ 那次同形：**闸门必须跟着数据走，不能留在上一个脚本里。**
const OUT_OF_SCOPE = /unshaded|不在\s*absent|不算|screened from icsd/i;
const all = [], skipped = [];
for (const p of src.papers || []) {
  for (const c of p.compounds || []) {
    const row = { ...c, doi: p.doi, year: p.year, discloses: p.discloses_limitation };
    if (OUT_OF_SCOPE.test(c.note || '')) skipped.push(row); else all.push(row);
  }
}
console.log(`4 篇点名 ${all.length + skipped.length} 条，其中**在「不存在」主张范围内**的 ${all.length} 条`);
console.log(`  被排除 ${skipped.length} 条（论文明说它们是已知/从 ICSD 筛出的）：${skipped.map(c => c.formula).join(' ')}\n`);

const tally = {};
for (const c of all) {
  const r = await lookup(c.formula);
  const cls = r === null ? 'UNRESOLVED' : r.n === 0 ? 'UNKNOWN' : (r.earliest < c.year ? 'PRIOR' : 'SINCE');
  c.cls = cls; c.earliest = r?.earliest ?? null; c.refs = r?.refs ?? [];
  (tally[c.doi] ??= { PRIOR: 0, SINCE: 0, UNKNOWN: 0, UNRESOLVED: 0 })[cls]++;
  console.log(`  ${c.formula.padEnd(14)} ${c.doi.slice(0, 24).padEnd(24)} → ${cls}${r && r.n ? `  COD ${r.n} 条 最早 ${r.earliest}` : ''}`);
  await sleep(1200);
}
console.log('\n按论文汇总：');
for (const [doi, t] of Object.entries(tally)) {
  const p = (src.papers || []).find(x => x.doi === doi);
  const n = t.PRIOR + t.SINCE + t.UNKNOWN + t.UNRESOLVED;
  console.log(`  ${doi.padEnd(30)} 点名 ${n}　PRIOR ${t.PRIOR}　SINCE ${t.SINCE}　UNKNOWN ${t.UNKNOWN}　未判 ${t.UNRESOLVED}　声明局限=${p?.discloses_limitation}`);
}
const prior = all.filter(c => c.cls === 'PRIOR');
if (prior.length) {
  console.log('\nPRIOR 的双向出处：');
  for (const c of prior) { console.log(`  ${c.formula.padEnd(14)} 论文 ${c.year} (${c.doi})  ← COD 最早 ${c.earliest}`); c.refs.forEach(r => console.log(`        COD ${r.cod}  ${r.year}  ${r.doi || r.journal}`)); }
}
fs.writeFileSync(path.join(HERE, 'result-audit4.json'), JSON.stringify({ tally, compounds: all }, null, 2));
