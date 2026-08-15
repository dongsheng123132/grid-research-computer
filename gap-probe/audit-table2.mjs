#!/usr/bin/env node
// audit-table2.mjs — 对单篇论文的完整表格做审计（不经 hermes 抽取）
//
// 为什么另写一份：上一版的分母是 hermes 抽出来的 16 条，而论文 Table 2 实为 19 条。
// **外包的抽取是最终数字的一个误差源，能去掉就该去掉。** 这里直接解析论文表格页。
//
// 论文：npj Comput. Mater. 10, 10 (2024)  doi:10.1038/s41524-023-01193-3
//       Table 2 标题原文：Theoretical polar structures with the synthesizability CL_score higher then 0.5
//       正文原话：In Table 2 the same ranking is reported for compounds **absent from the ICSD database
//                but predicted likely synthesizable**.
//       表内 LP=文献存在性、R=铁电关键词摘要数、S=含合成方法的摘要数（三者均为论文自己的量）
//
// 判定沿用 PREREG-audit.json（sha256 2721d218…）：COD 中该化学式最早年份 < 2024 → PRIOR。
//
// ⚠ 不可跳过的限定：**COD ≠ ICSD**。本审计不主张「论文说错了」——
//    它测的是「某库缺席 ⇒ 尚未合成」这个**推断**的失效率，用一个独立公开库做对照。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAPER_YEAR = 2024;
const UA = 'gap-probe/0.4 (research; mailto:HEFANGSHENG@gmail.com)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Table 2 全部 19 行，逐字抄自 nature.com/articles/s41524-023-01193-3/tables/2
const TABLE2 = [
  ['Ti(SO4)2', 'High', 0, 19], ['NbCl2O', 'Low', 0, 1], ['RbHgSbTe3', 'Low', 0, 0],
  ['NaHSeO4', 'Medium', 0, 1], ['BaTi(IO3)6', 'Medium', 0, 0], ['K4Ba2SnBi4', 'Low', 0, 0],
  ['Li2MgGeO4', 'Medium', 0, 0], ['SrGaSiH', 'Low', 0, 0], ['ClF5', 'High', 0, 2],
  ['K4Ba2SnSb4', 'Low', 0, 0], ['LiAlS2', 'Medium', 1, 0], ['Na3HfF7', 'Medium', 0, 0],
  ['GaClO', 'High', 0, 0], ['Ca11AlSb9', 'Low', 0, 0], ['K4Ba2SnAs4', 'Low', 0, 0],
  ['KLiZn3O4', 'Low', 0, 0], ['Li2ZnGeS4', 'Medium', 0, 0], ['Al2CdBr8', 'Low', 0, 0],
  ['Cd(GaCl4)2', 'Low', 0, 0]
];

// 括号必须展开。上一版的 normalize 只认 `元素+数字`，Ti(SO4)2 会被读成 Ti S O4 2 —— 错得无声。
function counts(f) {
  const stack = [{}];
  const merge = (dst, src, mult) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k] * mult; };
  const re = /([A-Z][a-z]?)(\d*\.?\d*)|(\()|(\))(\d*\.?\d*)/g;
  let m;
  while ((m = re.exec(f))) {
    if (m[1]) { const t = stack[stack.length - 1]; t[m[1]] = (t[m[1]] || 0) + (m[2] === '' ? 1 : parseFloat(m[2])); }
    else if (m[3]) stack.push({});
    else if (m[4]) { const top = stack.pop(); merge(stack[stack.length - 1], top, m[5] === '' ? 1 : parseFloat(m[5])); }
  }
  return stack[0];
}
const normalize = f => {
  const c = counts(f);
  return Object.keys(c).sort().map(e => e + (c[e] === 1 ? '' : String(c[e]))).join(' ');
};

// 自检：括号解析对不对，不许靠信任
const SELFTEST = [['Ti(SO4)2', 'O8 S2 Ti'], ['BaTi(IO3)6', 'Ba I6 O18 Ti'], ['Cd(GaCl4)2', 'Cd Cl8 Ga2'], ['Na3HfF7', 'F7 Hf Na3']];
for (const [inp, want] of SELFTEST) {
  const got = normalize(inp);
  if (got !== want) { console.error(`✘ 自检失败 ${inp} → ${got}，应为 ${want}`); process.exit(1); }
}
console.log('✔ 化学式解析自检 4/4 通过\n');

const CACHE = path.join(HERE, 'cache-audit.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
async function lookup(f) {
  const key = normalize(f);
  if (cache[key]) return cache[key];
  const url = `https://www.crystallography.net/cod/result.php?formula=${encodeURIComponent(key)}&format=json`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) { await sleep(3000 * (i + 1)); continue; }
      const txt = await r.text();
      const j = txt.trim() ? JSON.parse(txt) : [];
      const rows = j.map(x => ({ cod: x.file, year: +x.year || null, doi: x.doi || null, journal: (x.journal || '').slice(0, 34) }))
        .filter(x => x.year).sort((a, b) => a.year - b.year);
      const out = { n: j.length, earliest: rows.length ? rows[0].year : null, refs: rows.slice(0, 2) };
      cache[key] = out; fs.writeFileSync(CACHE, JSON.stringify(cache));
      return out;
    } catch { await sleep(3000 * (i + 1)); }
  }
  return null;
}

const res = [];
for (const [f, LP, R, S] of TABLE2) {
  const r = await lookup(f);
  const cls = r === null ? 'UNRESOLVED' : r.n === 0 ? 'UNKNOWN' : (r.earliest < PAPER_YEAR ? 'PRIOR' : 'SINCE');
  res.push({ formula: f, LP, R, S, cls, earliest: r?.earliest ?? null, n: r?.n ?? null, refs: r?.refs ?? [] });
  console.log(`  ${f.padEnd(12)} LP=${LP.padEnd(6)} S=${String(S).padStart(2)}  → ${cls}${r && r.n ? `  COD ${r.n} 条 最早 ${r.earliest}` : ''}`);
  await sleep(1200);
}
const n = c => res.filter(x => x.cls === c).length;
console.log(`\nTable 2 共 ${res.length} 个「absent from the ICSD but predicted likely synthesizable」化合物`);
console.log(`  PRIOR   论文发表前 COD 已有已发表结构   ${n('PRIOR')}  (${(100 * n('PRIOR') / res.length).toFixed(0)}%)`);
console.log(`  UNKNOWN COD 中无                        ${n('UNKNOWN')}`);
console.log(`  SINCE   论文后才出现                    ${n('SINCE')}`);
console.log(`  UNRESOLVED 查询失败                     ${n('UNRESOLVED')}   ← 不是 0，是不知道`);
const prior = res.filter(x => x.cls === 'PRIOR');
console.log(`\n其中论文自己的合成信号 S=0 的：${prior.filter(x => x.S === 0).length}/${prior.length}`);
for (const p of prior) {
  console.log(`  ${p.formula.padEnd(12)} LP=${p.LP} S=${p.S}  ← COD 最早 ${p.earliest}`);
  for (const r of p.refs) console.log(`        COD ${r.cod}  ${r.year}  ${r.doi || r.journal}`);
}
fs.writeFileSync(path.join(HERE, 'result-table2.json'), JSON.stringify({ paper: '10.1038/s41524-023-01193-3', paperYear: PAPER_YEAR, table: 'Table 2', rows: res }, null, 2));
