#!/usr/bin/env node
// recheck.mjs — 用 OpenAlex 重查昨天那条承重主张
//
// 昨天在 03-先行工作台账 里写下的结论：
//   「36 篇材料学在题文献中，量化报告了『数据库无条目→候选』这一步假阴性率的：0 篇。」
// 它是比赛正文 1.2 节的承重点。而它当时的证据基础很薄：
//   63 条去重条目、38 条在题、**13 条有摘要、0 篇全文**，且未走 Google Scholar。
//
// 现在 OpenAlex 有 key 了，重查一遍。**目的不是确认它，是试图推翻它。**
// 如果推翻了，正文 1.2 必须在交卷前改——这比交卷后被评委问出来强得多。
//
// 口径纪律（来自 trend-probe 的实测）：同一概念三种检索口径可差 3 万倍，
// 所以每条检索式都同时报「全文宽松 / 标题+摘要短语」两个数，不许只报一个。
//
// 用法：node demo/lit-recheck/recheck.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const KEY = (fs.readFileSync(path.join(ROOT, '.secrets/apikeys.env'), 'utf8')
  .match(/OPENALEX_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) { console.error('缺 OPENALEX_API_KEY'); process.exit(1); }

const CACHE = path.join(here, 'cache.json');
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(qs) {
  if (cache[qs] !== undefined) return cache[qs];
  let out = null;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(`https://api.openalex.org/works?${qs}&api_key=${KEY}`,
        { signal: AbortSignal.timeout(35000) });
      if (!r.ok) { await sleep(1500 * (i + 1)); continue; }
      out = await r.json(); break;
    } catch { await sleep(1500 * (i + 1)); }
  }
  cache[qs] = out; fs.writeFileSync(CACHE, JSON.stringify(cache)); await sleep(320);
  return out;
}
const P = s => encodeURIComponent(`"${s}"`);

/** 一条检索式：两种口径的计数 + 标题短语口径下的前若干条 */
async function probe(phrase, want = 8) {
  const loose = await api(`search=${encodeURIComponent(phrase)}&per-page=1`);
  const ta = await api(`filter=title_and_abstract.search:${P(phrase)}&per-page=${want}&sort=cited_by_count:desc`);
  return {
    phrase,
    loose: loose?.meta?.count ?? null,
    phrase_ta: ta?.meta?.count ?? null,
    top: (ta?.results || []).map(w => ({
      id: w.doi || w.id, year: w.publication_year, cited: w.cited_by_count,
      title: w.display_name
    }))
  };
}

// ── 检索式：每一条都是在**试图找到反例**（即：有人量过） ──
const QUERIES = [
  // 直接找「有人量过数据库缺失导致的假阴性」
  'false negative rate database screening materials discovery',
  'database coverage incompleteness materials informatics',
  'absence of evidence synthesizability',
  'unreported compounds validation crystal structure database',
  // 找「阳性对照」这个概念有没有被用在 AI 发现流水线上
  'positive control machine learning materials discovery',
  'positive control benchmark scientific discovery agent',
  // 找「弃权 / 该说没有的时候说没有」
  'abstention benchmark language model',
  'known unknowns evaluation scientific agent',
];

const out = [];
for (const q of QUERIES) {
  out.push(await probe(q));
  process.stderr.write(`\r${out.length}/${QUERIES.length}                      `);
}
process.stderr.write('\n');

fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify({
  spec: 'lit-recheck/0.1', source: 'OpenAlex',
  purpose: '试图推翻「0 篇量化过数据库缺失的假阴性率」这条承重主张',
  caliber_note: '两种口径同时报；同一概念口径差可达 3 万倍（见 demo/trend-probe）',
  queries: out
}, null, 1));

console.log('\n检索式                                                    全文宽松   标题+摘要短语');
for (const r of out) {
  console.log('  ' + r.phrase.slice(0, 52).padEnd(54)
    + String(r.loose ?? '-').padStart(9) + String(r.phrase_ta ?? '-').padStart(12));
}
console.log('\n短语口径下被引最高的条目（人工判读用）：');
for (const r of out) {
  if (!r.top.length) { console.log(`\n[${r.phrase}]  —— 0 条`); continue; }
  console.log(`\n[${r.phrase}]`);
  r.top.slice(0, 5).forEach(t =>
    console.log(`   ${String(t.year).padEnd(5)}引${String(t.cited).padStart(5)}  ${String(t.title).slice(0, 88)}`));
}
