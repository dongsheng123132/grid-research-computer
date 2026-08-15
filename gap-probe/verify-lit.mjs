// 核 hermes 交付的引用。粗筛可以外包，判断不能外包。
// 查两件事：(1) DOI 是否真实存在；(2) 它给的标题与 Crossref 的真标题是否对得上
//（「绰号当标题」是本仓库记录过的坑，今天我自己也踩过一次）。
import fs from 'node:fs';
const md = fs.readFileSync('.goai/litsearch-result.md', 'utf8');
const seen = new Map();
for (const m of md.matchAll(/10\.\d{4,9}\/[A-Za-z0-9._;()\/:<>-]+/g)) {
  const doi = m[0].replace(/[.,;)]+$/, '');
  if (!seen.has(doi)) {
    // 取该 DOI 所在行，抽出它声称的标题（行内最长的一段非表格文字）
    const line = md.slice(0, m.index).split('\n').pop() + md.slice(m.index).split('\n')[0];
    seen.set(doi, line.replace(/\s+/g, ' ').trim());
  }
}
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const dois = [...seen.keys()];
console.log(`从产出文件抽出唯一 DOI ${dois.length} 个，逐条打 Crossref\n`);
let ok = 0, bad = [], mismatch = [];
for (const [i, doi] of dois.entries()) {
  let title = null;
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      { headers: { 'User-Agent': 'gap-probe/0.3 (mailto:HEFANGSHENG@gmail.com)' }, signal: AbortSignal.timeout(25000) });
    if (r.ok) { const j = await r.json(); title = (j.message.title || [''])[0]; }
  } catch { /* 网络失败与「不存在」必须分开，见下 */ }
  if (title == null) { bad.push(doi); }
  else {
    ok++;
    const claimed = seen.get(doi);
    const words = norm(title).split(' ').filter(w => w.length > 4).slice(0, 6);
    const hit = words.filter(w => norm(claimed).includes(w)).length;
    if (words.length && hit / words.length < 0.4) mismatch.push({ doi, real: title.slice(0, 70), claimed: claimed.slice(0, 70) });
  }
  if ((i + 1) % 10 === 0) process.stderr.write(`  ${i + 1}/${dois.length}\n`);
  await new Promise(r => setTimeout(r, 900));
}
console.log(`Crossref 可解析 ${ok}/${dois.length}　解析不到 ${bad.length}`);
if (bad.length) console.log('  解析不到（可能是 DOI 错、也可能是网络失败 —— 两者本脚本区分不了，须人工复核）：\n   ' + bad.join('\n   '));
console.log(`\n标题对不上的 ${mismatch.length} 条：`);
for (const m of mismatch) console.log(`  ${m.doi}\n    真: ${m.real}\n    称: ${m.claimed}`);
