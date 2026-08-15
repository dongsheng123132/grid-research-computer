// 核 predictions.json 的出处：每个 source_doi / source_arxiv 是否真实存在。
// 粗筛外包给 hermes，这一步不外包 —— 它自己承认过「4 个凭记忆写错的 DOI」。
import fs from 'node:fs';
const j = JSON.parse(fs.readFileSync(new URL('./predictions.json', import.meta.url)));
const P = j.predictions || [];
const bySrc = new Map();
for (const p of P) {
  const k = p.source_doi || p.source_arxiv;
  if (!k) continue;
  if (!bySrc.has(k)) bySrc.set(k, []);
  bySrc.get(k).push(p.formula);
}
console.log(`预测 ${P.length} 条，来源 ${bySrc.size} 个\n`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0; const bad = [];
for (const [src, formulas] of bySrc) {
  let title = null;
  try {
    if (/^10\./.test(src)) {
      const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(src)}`,
        { headers: { 'User-Agent': 'gap-probe/0.4 (mailto:HEFANGSHENG@gmail.com)' }, signal: AbortSignal.timeout(25000) });
      if (r.ok) title = (await r.json()).message.title?.[0] ?? '(无标题)';
    } else {
      const id = src.replace(/^arxiv:?/i, '');
      const r = await fetch(`https://export.arxiv.org/api/query?id_list=${id}`, { signal: AbortSignal.timeout(25000) });
      if (r.ok) { const t = /<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/.exec(await r.text()); title = t ? t[1].replace(/\s+/g, ' ').trim() : null; }
    }
  } catch { /* 网络失败与「不存在」区分不了，一并进 bad 待人工复核 */ }
  if (title) { ok++; console.log(`  ✔ ${src}  (${formulas.length} 条)  ${title.slice(0, 58)}`); }
  else { bad.push(src); console.log(`  ✘ ${src}  (${formulas.length} 条)  核不到`); }
  await sleep(1200);
}
console.log(`\n出处可核 ${ok}/${bySrc.size}`);
if (bad.length) console.log('核不到（DOI 错 or 网络失败，本脚本区分不了，须人工复核）：\n  ' + bad.join('\n  '));
