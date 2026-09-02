#!/usr/bin/env node
// scale.mjs — 口径敏感度 · OpenAlex 随机抽样普查（采数）v0.2
//
// 规则见同目录 PREREG-v2.md（抽样之前写死）；v1 普查版 PREREG.md 保留为 superseded，已进外部时间锚。
// 验收见同目录 verify-trend-scale.mjs（同样写在数据之前）。
// **本脚本只负责把数字取回来，一个判断都不做**——三态分类是机械的，统计量由判据逐条复算。
//
// 用法：
//   node scale.mjs            完整样本 n=1000（3000 次请求）
//   node scale.mjs --limit 20 冒烟（只跑样本前 20 个；rows≠1000，判据会红，属预期）
//
// 断点续跑：所有响应缓存进 cache.json，重跑不重复请求。

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAILTO = 'HEFANGSHENG@gmail.com';

// 抽样参数：全部来自 PREREG-v2.md，抽之前写死。改这里任何一个数，判据 S1.x 立刻红。
const SEED = 'trend-scale-v2-20260824';
const SAMPLE_N = 1000;
const POP_N = 4516;
const PREREG_V2 = path.join(fileURLToPath(new URL('.', import.meta.url)), 'PREREG-v2.md');

// OpenAlex 2026-08-24 起按额度计费（匿名 $0.10/天 = 100 次）。用 key 才够跑。
const KEY = (() => {
  const p = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)), '.secrets/apikeys.env');
  return fs.existsSync(p) ? (fs.readFileSync(p, 'utf8').match(/OPENALEX_API_KEY=(.+)/) || [])[1]?.trim() : null;
})();

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : null;

const CACHE_PATH = path.join(HERE, 'cache.json');
const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};
let cacheDirty = false;
const flushCache = () => {
  if (!cacheDirty) return;
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
  cacheDirty = false;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 一次 API 调用。返回 {ok:true, json} 或 {ok:false}。
 *  五次退避都失败才算 error —— 「我没测着」必须与「它没有」分开记账。 */
async function api(qs) {
  if (cache[qs] !== undefined) return cache[qs];
  let out = { ok: false };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(`https://api.openalex.org/${qs}&mailto=${MAILTO}${KEY ? `&api_key=${KEY}` : ''}`,
        { signal: AbortSignal.timeout(40000) });
      if (r.status === 429 || r.status >= 500) {
        const ra = Number(r.headers.get('retry-after'));
        await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      if (!r.ok) { await sleep(1000 * 2 ** attempt); continue; }
      const j = await r.json();
      // 只留用得上的字段。第一版整份存响应体，cache.json 长到 73MB（per-page=1 也会
      // 返回一整条 work 记录），而全程只读 meta.count 与 next_cursor——瘦身后 385KB，
      // 重跑逐字节复现同一份 result.json。缓存不是证据物，result.json 才是。
      // topics 分页要 results（取 id 与 display_name）；works 查询只要 meta.count。
      const isTopics = qs.startsWith('topics?');
      out = { ok: true, json: {
        meta: { count: j.meta?.count, next_cursor: j.meta?.next_cursor },
        ...(isTopics ? { results: (j.results || []).map(x => ({ id: x.id, display_name: x.display_name })) } : {}),
      } };
      break;
    } catch { await sleep(1000 * 2 ** attempt); }
  }
  cache[qs] = out; cacheDirty = true;
  await sleep(130);
  return out;
}

// ── 阶段 A：拉全总体 ────────────────────────────────────────────────
async function fetchPopulation() {
  const p = path.join(HERE, 'topics.json');
  if (fs.existsSync(p)) {
    const t = JSON.parse(fs.readFileSync(p, 'utf8'));
    process.stderr.write(`topics.json 已在盘：${t.topics.length} 条（declared=${t.declared_count}）\n`);
    return t;
  }
  const topics = [];
  let cursor = '*', declared = null;
  while (cursor) {
    const res = await api(`topics?per-page=200&cursor=${encodeURIComponent(cursor)}`);
    if (!res.ok) throw new Error('拉总体失败，中止（不许拿半份总体当全总体用）');
    const j = res.json;
    if (declared === null) declared = j.meta.count;
    for (const x of j.results) topics.push({ id: x.id, display_name: x.display_name });
    cursor = j.meta.next_cursor || null;
    process.stderr.write(`\r拉总体 ${topics.length}/${declared}    `);
    if (!j.results.length) break;
  }
  process.stderr.write('\n');
  // 预注册写死：条数不符即中止。分页漏抓过一次（per-page=1 把 group_by 截成 1 组）。
  if (topics.length !== declared) {
    throw new Error(`总体条数不符：落盘 ${topics.length} ≠ declared ${declared}。整轮作废，不继续。`);
  }
  const out = { declared_count: declared, fetched_count: topics.length, topics };
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  flushCache();
  return out;
}

// ── 阶段 B：逐个测三口径 ────────────────────────────────────────────
const enc = encodeURIComponent;

async function calibers(phrase) {
  const q = `"${phrase}"`;
  const a = await api(`works?search=${enc(phrase)}&per-page=1`);
  const b = await api(`works?filter=title_and_abstract.search:${enc(q)}&per-page=1`);
  const c = await api(`works?filter=title.search:${enc(q)}&per-page=1`);
  const pick = res => (res.ok && Number.isFinite(res.json?.meta?.count)) ? res.json.meta.count : null;
  return { fulltext_loose: pick(a), title_abstract_phrase: pick(b), title_phrase: pick(c) };
}

/** 三态分类：**由数字决定，不由采数者决定**。判据会用同一条规则复分类。 */
function classify(c) {
  const nums = [c.fulltext_loose, c.title_abstract_phrase, c.title_phrase];
  if (!nums.every(n => typeof n === 'number' && Number.isFinite(n))) return 'error';
  if (c.title_phrase < 10) return 'too_narrow';   // 含 0：「没测着」≠「它没有」
  return 'measured';
}

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

const HONEST_BOUNDS =
  'topic 的 display_name 是 OpenAlex 自己编的标签（如 "Military Technology and Strategies"），'
  + '不必然是研究者真会输入的检索式——这是本轮外部效度的主要限制。'
  + '测的是 OpenAlex 一家的检索行为，不是文献计量学普遍如此；换 Scopus/WoS 结论可能不同。'
  + '全文口径（search=）宽松到何种程度没有公开文档，本轮只测其后果（命中数差多少），不主张知道其机制。'
  + '本轮是从全部 4516 个 topic 里按固定种子随机抽的 1000 个样本，**不是普查**：'
  + '所有比例都带抽样误差，已给出带有限总体校正的 95% 置信区间，点估计不得脱离区间单独引用；'
  + '分位数是样本分位数，不是总体分位数，本轮不对它做区间估计。'
  + '改成抽样的原因是预算（OpenAlex 2026-08-24 起按额度计费，全总体需 $13.55），不是数据不好看：'
  + '判断标准与四条预测与普查版（PREREG.md）逐字相同，两份预注册都在盘上可 diff。'
  + 'too_narrow 与 error 两类不进任何统计，其条数与 measured 一并列出。';

// ── 抽样：确定性 PRNG，任何人拿同一份 topics.json + 同一个种子必须复现同一批 ──
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function drawSample(topics, seed, n) {
  // 先按 id 排序：topics.json 的原始顺序来自分页游标，不保证稳定。
  // 不排序的话别人重跑抽出来就是另一批——这是抽样可复现的承重步骤。
  const arr = [...topics].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rand = mulberry32(xmur3(seed)());
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

/** 比例的 95% Wilson 区间，带有限总体校正。抽样版必须给区间，普查版（v1）反而禁止。 */
const FPC = Math.sqrt((POP_N - SAMPLE_N) / (POP_N - 1));
function wilsonFPC(k, n) {
  if (!n) return null;
  const z = 1.959964, p = k / n;
  const se = FPC * Math.sqrt(p * (1 - p) / n);
  const d = 1 + z * z / n, c = p + z * z / (2 * n);
  const m = z * Math.sqrt(se * se + z * z / (4 * n * n));
  return { lo: Math.max(0, 100 * (c - m) / d), hi: Math.min(100, 100 * (c + m) / d) };
}

async function main() {
  const pop = await fetchPopulation();
  const sample = drawSample(pop.topics, SEED, SAMPLE_N);
  const list = LIMIT ? sample.slice(0, LIMIT) : sample;
  process.stderr.write(`抽样：种子 ${SEED}　N=${pop.topics.length} → n=${sample.length}（本轮跑 ${list.length}）\n`);

  const rows = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const c = await calibers(t.display_name);
    const state = classify(c);
    const row = { topic_id: t.id, display_name: t.display_name, state, ...c };
    if (state === 'measured') row.ratio = c.fulltext_loose / c.title_phrase;
    rows.push(row);
    if ((i + 1) % 20 === 0 || i === list.length - 1) {
      flushCache();
      process.stderr.write(`\r已完成 ${i + 1}/${list.length}    `);
    }
  }
  process.stderr.write('\n');
  flushCache();

  const measured = rows.filter(r => r.state === 'measured');
  const tooNarrow = rows.filter(r => r.state === 'too_narrow');
  const errored = rows.filter(r => r.state === 'error');
  const ratios = measured.map(r => r.ratio).sort((a, b) => a - b);
  const pctOf = n => +(100 * n / (ratios.length || 1)).toFixed(4);

  const median = quantile(ratios, 0.5), p5 = quantile(ratios, 0.05), p95 = quantile(ratios, 0.95);
  const ge1000 = pctOf(ratios.filter(v => v >= 1000).length);
  const lt100 = pctOf(ratios.filter(v => v < 100).length);
  const narrowPct = +(100 * tooNarrow.length / (rows.length || 1)).toFixed(4);
  const spread = (p5 > 0) ? p95 / p5 : null;

  // 预测的结局：如实记账。被推翻是结果，不是故障——不许回头改预测。
  const outcomes = [
    { id: 'P1', claim: 'ratio 中位数 ≥ 100', held: median >= 100, observed: `中位 ${median?.toFixed(1)}` },
    { id: 'P2', claim: 'ratio ≥ 1000 占比 ≥ 10%', held: ge1000 >= 10, observed: `${ge1000}%` },
    { id: 'P3', claim: 'P95/P5 ≥ 10^4（跨 4 个数量级）', held: spread !== null && spread >= 1e4, observed: `P95/P5 = ${spread === null ? 'n/a' : spread.toFixed(0)}` },
    { id: 'P4', claim: 'too_narrow 占比 < 30%', held: narrowPct < 30, observed: `${narrowPct}%` },
  ];

  const preregSha = crypto.createHash('sha256').update(fs.readFileSync(PREREG_V2)).digest('hex');

  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({
    spec: 'trend-scale/0.2-sample',
    source: 'OpenAlex',
    prereg_sha256: preregSha,
    sampling: { seed: SEED, frame: 'topics.json', N: pop.topics.length, n: sample.length,
      method: 'sort by id → xmur3+mulberry32 Fisher-Yates → take first n' },
    population: { declared_count: pop.declared_count, fetched_count: pop.fetched_count },
    partial_run: LIMIT ? { limit: LIMIT, note: '冒烟运行，非完整样本，判据 S1.2 会红且应当红' } : undefined,
    states: { measured: measured.length, too_narrow: tooNarrow.length, error: errored.length },
    stats: { ratio_median: median, ratio_p5: p5, ratio_p95: p95,
      pct_ratio_ge_1000: ge1000, pct_ratio_lt_100: lt100, pct_too_narrow: narrowPct },
    ci: {
      pct_ratio_ge_1000: wilsonFPC(ratios.filter(v => v >= 1000).length, ratios.length),
      pct_ratio_lt_100: wilsonFPC(ratios.filter(v => v < 100).length, ratios.length),
      pct_too_narrow: wilsonFPC(tooNarrow.length, rows.length),
    },
    prediction_outcomes: outcomes,
    honest_bounds: HONEST_BOUNDS,
    rows,
  }, null, 1));

  process.stderr.write(
    `\n三态：measured ${measured.length}　too_narrow ${tooNarrow.length}　error ${errored.length}\n`
    + `中位倍数 ${median?.toFixed(1)}　P5 ${p5?.toFixed(1)}　P95 ${p95?.toFixed(1)}\n`
    + `≥1000 倍 ${ge1000}%　<100 倍 ${lt100}%\n`
    + outcomes.map(o => `  ${o.id} ${o.held ? '成立' : '⚠ 被推翻'}（${o.observed}）`).join('\n') + '\n');
}

main().catch(e => { flushCache(); console.error('\n中止：' + e.message); process.exit(1); });
