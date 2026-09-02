#!/usr/bin/env node
// 时间轴图：7 个被声称「数据库中不存在」的化合物，其已发表结构早于该声称多少年。
// 数据不写死——从 result-table2.json / result-audit4.json 现读，改了数据图就跟着变。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const pretty = (f) => f.replace(/(?<=[A-Za-z)\]])\d+/g, (d) => [...d].map((c) => SUB[c]).join(''));

function collect() {
  const t2 = JSON.parse(readFileSync(join(HERE, 'result-table2.json'), 'utf8'));
  const a4 = JSON.parse(readFileSync(join(HERE, 'result-audit4.json'), 'utf8'));
  const rows = [];
  for (const r of t2.rows) {
    if (r.cls === 'PRIOR') rows.push({ formula: r.formula, from: r.earliest, to: t2.paperYear, src: 'npj Comput. Mater. 2024' });
  }
  for (const c of a4.compounds) {
    if (c.cls === 'PRIOR') rows.push({ formula: c.formula, from: c.earliest, to: c.year, src: shortSrc(c.doi) });
  }
  const total = t2.rows.length + a4.compounds.length;
  return { rows: rows.sort((a, b) => (b.to - b.from) - (a.to - a.from)), total };
}

function shortSrc(doi) {
  if (doi === '10.1039/d1ee00442e') return 'Energy Environ. Sci. 2021';
  if (doi === '10.1021/jacs.4c10294') return 'JACS 2024';
  if (doi === '10.3390/cryst10040298') return 'Crystals 2020';
  return doi;
}

const { rows, total } = collect();
const n = rows.length;

// —— 版面 ——
const W = 960;
const PAD = { l: 132, r: 150, t: 96, b: 74 };
const ROW_H = 46;
const H = PAD.t + n * ROW_H + PAD.b;
const X0 = PAD.l, X1 = W - PAD.r;

const minYear = Math.min(...rows.map((r) => r.from));
const maxYear = Math.max(...rows.map((r) => r.to));
const lo = Math.floor((minYear - 4) / 10) * 10;
const hi = Math.ceil((maxYear + 2) / 10) * 10;
const x = (y) => X0 + ((y - lo) / (hi - lo)) * (X1 - X0);

const INK = '#1a1a1a', MUTED = '#6b7280', GRID = '#e5e7eb';
const OLD = '#0f766e';   // 已发表结构（旧）
const CLAIM = '#b91c1c'; // 声称「不存在」的那一年

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const p = [];
p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Source Han Sans SC, Microsoft YaHei, Segoe UI, sans-serif">`);
p.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);

// 标题
p.push(`<text x="${X0 - 44}" y="42" font-size="21" font-weight="700" fill="${INK}">被声称「数据库中不存在」，而结构其实早已发表</text>`);
p.push(`<text x="${X0 - 44}" y="66" font-size="13.5" fill="${MUTED}">${n} / ${total} 个化合物（${(n / total * 100).toFixed(0)}%）在论文发表前已有公开晶体结构　·　线段长度 = 相隔年数</text>`);

// 图例
const lx = X1 - 4;
p.push(`<g font-size="12" fill="${MUTED}">`);
p.push(`<circle cx="${lx - 268}" cy="${76}" r="4.5" fill="${OLD}"/><text x="${lx - 256}" y="80">已发表结构（最早）</text>`);
p.push(`<circle cx="${lx - 120}" cy="${76}" r="4.5" fill="${CLAIM}"/><text x="${lx - 108}" y="80">声称「不存在」</text>`);
p.push(`</g>`);

// 年份网格
const step = (hi - lo) > 60 ? 20 : 10;
for (let y = lo; y <= hi; y += step) {
  p.push(`<line x1="${x(y).toFixed(1)}" y1="${PAD.t - 14}" x2="${x(y).toFixed(1)}" y2="${H - PAD.b + 8}" stroke="${GRID}" stroke-width="1"/>`);
  p.push(`<text x="${x(y).toFixed(1)}" y="${H - PAD.b + 28}" font-size="12" fill="${MUTED}" text-anchor="middle">${y}</text>`);
}

// 每一行
rows.forEach((r, i) => {
  const cy = PAD.t + i * ROW_H + ROW_H / 2;
  const xa = x(r.from), xb = x(r.to);
  const gap = r.to - r.from;
  const worst = i === 0;
  p.push(`<text x="${X0 - 16}" y="${cy + 5}" font-size="14.5" fill="${INK}" text-anchor="end" font-weight="${worst ? 700 : 400}">${esc(pretty(r.formula))}</text>`);
  p.push(`<line x1="${xa.toFixed(1)}" y1="${cy}" x2="${xb.toFixed(1)}" y2="${cy}" stroke="${worst ? CLAIM : '#9ca3af'}" stroke-width="${worst ? 3 : 2}" stroke-linecap="round" opacity="${worst ? 0.85 : 0.55}"/>`);
  p.push(`<circle cx="${xa.toFixed(1)}" cy="${cy}" r="5" fill="${OLD}"/>`);
  p.push(`<circle cx="${xb.toFixed(1)}" cy="${cy}" r="5" fill="${CLAIM}"/>`);
  p.push(`<text x="${(xa - 10).toFixed(1)}" y="${cy + 4.5}" font-size="11.5" fill="${MUTED}" text-anchor="end">${r.from}</text>`);
  p.push(`<text x="${(xb + 12).toFixed(1)}" y="${cy + 4.5}" font-size="13" fill="${worst ? CLAIM : INK}" font-weight="${worst ? 700 : 600}">相隔 ${gap} 年</text>`);
  p.push(`<text x="${(xb + 12).toFixed(1)}" y="${cy + 19}" font-size="10.5" fill="${MUTED}">${esc(r.src)}</text>`);
});

// 脚注
p.push(`<text x="${X0 - 44}" y="${H - 16}" font-size="11" fill="${MUTED}">口径：COD 最早条目年份 vs 论文发表年份　·　总体 = OpenAlex 检索确切措辞 “absent from ICSD” 的全部 5 篇（38 个具名化合物）　·　可由 demo/gap-probe/ 重跑</text>`);
p.push(`</svg>`);

const svg = p.join('\n');
writeFileSync(join(HERE, 'fig-prior-timeline.svg'), svg);
console.log(`已写出 fig-prior-timeline.svg　${n}/${total} 条 PRIOR，最长 ${rows[0].to - rows[0].from} 年（${rows[0].formula}）`);
for (const r of rows) console.log(`  ${r.formula.padEnd(12)} ${r.from} → ${r.to}  (${r.to - r.from} 年)  ${r.src}`);
