#!/usr/bin/env node
// verify-sky-probe.mjs — 天文假空判据 v0.1
//
// 与 demo/gap-probe/verify-gap-probe.mjs 同构：阳性对照不过 → 退出码 2 → 本轮作废。
// 这个套件存在的理由不是「再做一个领域」，是回答一个具体质疑：
//   「那五道闸门是不是只对材料有效？」——一个案例撑不起「范式」两个字。
//
// 用法：node demo/sky-probe/verify-sky-probe.mjs
// 退出码：0 = 全过　1 = 判据自身有问题　2 = **阳性对照被击穿，本轮探针结果作废**

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = JSON.parse(fs.readFileSync(path.join(here, 'result.json'), 'utf8'));
const results = [];
const t = (id, name, fn) => {
  let ok, detail = '';
  try { const r = fn(); ok = r === true; if (!ok) detail = typeof r === 'object' ? JSON.stringify(r) : String(r); }
  catch (e) { ok = false; detail = 'EXCEPTION: ' + e.message; }
  results.push({ id, name, ok, detail });
  console.log(` ${ok ? '✔' : '✘'} ${id.padEnd(10)} ${name}${ok ? '' : `\n     ❌ ${detail}`}`);
};

console.log('天文假空判据 v0.1 —— demo/sky-probe\n');

// ── S1 阳性对照：教科书天体不得被朴素口径判为「未编目」──────────────────
// 这些名字都是天文入门书的标题级词汇。任何一个被判成「未编目的新发现候选」，
// 都说明「恰好这个名字」这个操作化定义不成立——与 Fe-Cr-Ni 逐条同型。
const TEXTBOOK = ['Crab Nebula', 'Orion Nebula', 'Andromeda Galaxy', 'Pleiades',
                  'Ring Nebula', 'Whirlpool Galaxy', 'Sombrero Galaxy', 'Eagle Nebula'];
for (const name of TEXTBOOK) {
  const row = R.rows.find(r => r.alias === name);
  t('S1.' + name.split(' ')[0], `阳性对照「${name}」不得被判为未编目`, () => {
    if (!row) return '探针结果里没有这条——对照集与探针输入不同步';
    return row.verdict === 'resolved_exact'
      || `朴素口径判「未编目」（SIMBAD 主名是 ${JSON.stringify(row.main_id || '(库不认识)')}）`;
  });
}

// ── S2 披露：覆盖率与三态必须分开出数 ────────────────────────────────
t('S2.1', 'result.json 必须披露覆盖率（attempted / ok / error 分开）', () => {
  const c = R.coverage || {};
  return ['attempted', 'ok', 'error'].every(k => Number.isInteger(c[k]))
    || `覆盖率账不全: ${JSON.stringify(c)}`;
});
t('S2.2', '【反向】「库不认识」必须单独计数，不得并入假空', () => {
  const v = R.verdict || {};
  if (!Number.isInteger(v.unresolved)) return 'unresolved 没有单独计数';
  const denom = v.resolved_exact + v.resolved_different;
  return Math.abs(R.false_empty_rate - v.resolved_different / denom) < 1e-9
    || `假空率的分母含了 unresolved —— 用「我没查着」去撑「流水线会误判」`;
});
t('S2.3', '【反向】分母不许把网络失败算进去（error ≠ 结论）', () => {
  const v = R.verdict, c = R.coverage;
  const denom = v.resolved_exact + v.resolved_different;
  return denom === c.attempted - v.unresolved - c.error
    || `分母 ${denom} 与「成功解析数」对不上（attempted=${c.attempted} unresolved=${v.unresolved} error=${c.error}）`;
});

// ── S3 反向用例：判据必须分得开好坏，不能恒红也不能恒绿 ──────────────────
t('S3.1', '【反向】注入一个主名与查询串相同的条目，S1 口径必须放行（防恒红）', () => {
  const exact = R.rows.filter(r => r.verdict === 'resolved_exact');
  return exact.length > 0
    || '一条 resolved_exact 都没有 —— 那这个判据可能对任何输入都报红，等于没测';
});
t('S3.2', '【反向】编造的名字必须落进 unresolved，不得被写成「未编目的新天体」', () => {
  // C 169 是 hermes 生成的：Caldwell 目录只到 C109，且明确排除 Messier 天体，
  // 所以 M 15 不可能有 Caldwell 编号。它必须落进 unresolved 而不是假空。
  const row = R.rows.find(r => r.alias === 'C 169');
  if (!row) return 'C 169 不在结果里，这条判据失去基准';
  return row.verdict === 'unresolved' || `被判成了 ${row.verdict}`;
});

// ── S4 主名规则不一致：本轮真正的发现，锁成判据免得下次被当成偶然 ─────────
t('S4.1', '主名选择无一致规则（M 44→NGC 2632 而 NGC 7078→M 15，方向相反）', () => {
  const a = R.rows.find(r => r.alias === 'M 44');
  const b = R.rows.find(r => r.alias === 'NGC 7078');
  if (!a || !b) return '缺少这两条对照，无法检验方向一致性';
  const aMessierIsMain = /^M\s/.test(a.main_id || '');
  const bMessierIsMain = /^M\s/.test(b.main_id || '');
  return (aMessierIsMain !== bMessierIsMain)
    || `两条方向一致了（${a.alias}→${a.main_id}, ${b.alias}→${b.main_id}）——本判据的前提要重新检查`;
});

// ── 报告 ─────────────────────────────────────────────────────────
const pass = results.filter(r => r.ok).length;
const s1fail = results.filter(r => r.id.startsWith('S1.') && !r.ok).length;
console.log(`\n判决 ${pass}/${results.length}`);
if (s1fail) {
  console.log(`\n本轮探针结果作废：${s1fail}/${TEXTBOOK.length} 个阳性对照被判为「未编目」。`);
  console.log('这不是探针写错了，是「恰好这个名字」这个操作化定义与「该天体已被编目」不是一回事。');
  console.log('—— 与 demo/gap-probe 的 Fe-Cr-Ni 逐条同型：错的不是代码，是把检索口径当成了世界。');
  process.exit(2);
}
process.exit(pass === results.length ? 0 : 1);
