#!/usr/bin/env node
// openalex-sweep.mjs — 用 OpenAlex 全文短语检索，把「声称数据库缺席」的论文总体捞出来
//
// 为什么需要它：目前的审计样本来自 hermes 的 37 篇，而那 37 篇是**检索式碰出来的**，
// 不是一个可定义的总体。要把结论从「一篇论文 6/19」推到领域级，得先有分母。
// OpenAlex 支持全文短语检索且免费——但**免费额度按天共享，一轮 agent 检索就能烧光**
// （2026-08-11 实测：hermes 跑完后余额 0，retryAfter 约 12 小时）。所以本脚本：
//   1) 先查余额，不够就直接退出，不做半截活
//   2) 每个短语只取计数与前 N 条，把预算花在广度而不是深度
//   3) 覆盖率必须落盘：查了哪些短语、各命中多少、取了多少
//
// 用法：node demo/gap-probe/openalex-sweep.mjs [--per 25]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAIL = 'HEFANGSHENG@gmail.com';
// 密钥从 gitignore 覆盖的 .secrets/ 读，**不写进源码**——这个仓库是公开的。
// publish.mjs 的 secrets-dir / env-file / private-key 三条路径规则 + SECRET_PATTERNS 内容扫描
// 是最后一道；但最后一道不该被当成第一道，源码里本来就不该出现密钥。
const KEYFILE = path.resolve(HERE, '../../.secrets/openalex.env');
const KEY = (fs.existsSync(KEYFILE) ? (/OPENALEX_API_KEY=(\S+)/.exec(fs.readFileSync(KEYFILE, 'utf8')) || [])[1] : null)
  || process.env.OPENALEX_API_KEY || null;
const auth = KEY ? { Authorization: `Bearer ${KEY}` } : {};
if (!KEY) console.error('⚠ 未找到 OPENALEX_API_KEY，将走免费额度（每日共享，极易耗尽）');
const PER = +(process.argv[process.argv.indexOf('--per') + 1] || 25);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 短语先写死。这些是「用数据库缺席推断未合成」的典型措辞；
// 事后再加短语等于按结果调检索式，那是本仓库一整天在防的事。
const PHRASES = [
  'absent from the ICSD',
  'not present in the ICSD',
  'not in the ICSD',
  'no ICSD entry',
  'not reported in the ICSD',
  'absent from the Materials Project',
  'not been synthesized',
  'hitherto unreported',
  'not yet been reported experimentally'
];

async function api(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': `gap-probe/0.4 (mailto:${MAIL})`, ...auth }, signal: AbortSignal.timeout(40000) });
      const j = await r.json();
      if (j.error) return { error: j.message || j.error, remaining: j.dailyRemainingUsd };
      return j;
    } catch (e) { await sleep(3000 * (i + 1)); }
  }
  return { error: 'network' };
}

// 先探余额：不够就不做半截活
const probe = await api(`https://api.openalex.org/works?filter=title.search:perovskite&per-page=1&mailto=${MAIL}`);
if (probe.error) {
  console.error(`✘ OpenAlex 不可用：${probe.error}`);
  console.error('  余额按天重置（UTC 午夜）。本脚本不做半截活，直接退出。');
  process.exit(3);
}
console.log('✔ OpenAlex 可用，开始扫\n');

const out = { coverage: [], works: {} };
for (const p of PHRASES) {
  const u = `https://api.openalex.org/works?search=${encodeURIComponent('"' + p + '"')}&per-page=${PER}&mailto=${MAIL}`;
  const j = await api(u);
  if (j.error) { console.log(`  ${p.padEnd(34)} ✘ ${j.error}`); out.coverage.push({ phrase: p, error: j.error }); break; }
  const n = j.meta?.count ?? 0;
  out.coverage.push({ phrase: p, hits: n, taken: (j.results || []).length });
  for (const w of j.results || []) {
    const doi = (w.doi || '').replace('https://doi.org/', '');
    if (!doi) continue;
    (out.works[doi] ??= { doi, year: w.publication_year, title: w.title, phrases: [] }).phrases.push(p);
  }
  console.log(`  ${p.padEnd(34)} 命中 ${String(n).padStart(6)}　取 ${(j.results || []).length}`);
  await sleep(1500);
}
const works = Object.values(out.works);
console.log(`\n唯一论文 ${works.length} 篇`);
console.log('覆盖（必须随结论一起引，否则就是我们自己在犯 N6）：');
for (const c of out.coverage) console.log(`  ${c.phrase.padEnd(34)} ${c.error ? '✘ ' + c.error : `命中 ${c.hits}　取 ${c.taken}`}`);
fs.writeFileSync(path.join(HERE, 'openalex-sweep.json'), JSON.stringify({ ...out, works }, null, 2));
console.log('\n→ demo/gap-probe/openalex-sweep.json');
