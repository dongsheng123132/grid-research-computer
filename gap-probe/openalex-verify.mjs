#!/usr/bin/env node
// openalex-verify.mjs — 把 OpenAlex 的检索结果逐条**回摘要核对**
//
// 为什么必须有这一步（2026-08-12 实测）：
//   "absent from the ICSD"  → 7 条，全部是对的类型（真短语匹配）
//   "not in the ICSD"       → 24,731 条，里面有《International Classification of Sleep Disorders》
//   "not been synthesized"  → 259,884 条，里面有 1959 年的《Tissue sulfhydryl groups》
// **OpenAlex 的引号短语检索只对独特短语有效，常见词短语会静默退化成相关性排序，
//   而 API 不给任何降级信号——计数只是变大。** 直接用这些计数就是拿噪音当分母。
//
// 另：**ICSD 是同名词**，也指「国际睡眠障碍分类」。以 ICSD 为关键词的审计必须消歧。
//
// 本脚本做的事：对每个短语取回结果**连同摘要**，逐条确认该短语字面出现在标题或摘要里；
// 只有通过的才计入。真命中数与检索计数一起报——两者的差就是那个降级的量。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIL = 'HEFANGSHENG@gmail.com';
const KEYFILE = path.resolve(HERE, '../../.secrets/openalex.env');
const KEY = (fs.existsSync(KEYFILE) ? (/OPENALEX_API_KEY=(\S+)/.exec(fs.readFileSync(KEYFILE, 'utf8')) || [])[1] : null)
  || process.env.OPENALEX_API_KEY || null;
const auth = KEY ? { Authorization: `Bearer ${KEY}` } : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PER = 200;

const PHRASES = JSON.parse(fs.readFileSync(path.join(HERE, 'openalex-sweep.json'), 'utf8'))
  .coverage.map(c => c.phrase);

// OpenAlex 的摘要是倒排索引，要还原成文本才能做字面匹配
const rebuild = inv => {
  if (!inv) return '';
  const pos = [];
  for (const [w, idxs] of Object.entries(inv)) for (const i of idxs) pos[i] = w;
  return pos.join(' ');
};
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

async function api(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': `gap-probe/0.5 (mailto:${MAIL})`, ...auth }, signal: AbortSignal.timeout(60000) });
      const j = await r.json();
      if (j.error) return { error: j.message || j.error };
      return j;
    } catch { await sleep(3000 * (i + 1)); }
  }
  return { error: 'network' };
}

const report = [], kept = new Map();
for (const p of PHRASES) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent('"' + p + '"')}`
    + `&per-page=${PER}&select=id,doi,title,publication_year,abstract_inverted_index&mailto=${MAIL}`;
  const j = await api(url);
  if (j.error) { report.push({ phrase: p, error: j.error }); console.log(`  ${p.padEnd(36)} ✘ ${j.error}`); continue; }
  const total = j.meta?.count ?? 0, got = (j.results || []).length;
  const np = norm(p);
  let hit = 0;
  for (const w of j.results || []) {
    const text = norm((w.title || '') + ' ' + rebuild(w.abstract_inverted_index));
    if (!text.includes(np)) continue;
    hit++;
    const doi = (w.doi || '').replace('https://doi.org/', '') || w.id;
    (kept.get(doi) ?? kept.set(doi, { doi, year: w.publication_year, title: w.title, phrases: [] }).get(doi)).phrases.push(p);
  }
  const rate = got ? (100 * hit / got).toFixed(0) : '—';
  report.push({ phrase: p, searchCount: total, fetched: got, verified: hit, precision: rate + '%' });
  console.log(`  ${p.padEnd(36)} 检索计数 ${String(total).padStart(7)}　取回 ${String(got).padStart(3)}　**回摘要核实 ${String(hit).padStart(3)}**　精确率 ${rate}%`);
  await sleep(1500);
}

const works = [...kept.values()];
console.log(`\n经摘要核实的唯一论文：${works.length} 篇`);
console.log('\n注：检索计数 ≫ 核实数 的短语，其计数不可用作分母——那是相关性退化，不是命中。');
fs.writeFileSync(path.join(HERE, 'openalex-verified.json'), JSON.stringify({ report, works }, null, 2));
console.log('→ demo/gap-probe/openalex-verified.json');
