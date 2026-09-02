#!/usr/bin/env node
// Reproducible Crossref-only collection. No calls are made to any other literature API.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const framePath = path.resolve(here, '..', 'topics.json');
const outPath = path.join(here, 'result-crossref.json');
const preregPath = path.join(here, 'PREREG-crossref.md');
const SEED = 'trend-scale-crossref-20260902';
const N = 500;
const MAILTO = 'research@example.org';
const BASE = 'https://api.crossref.org/works';
const MIN_GAP_MS = 1000;
let lastStart = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function xmur3(str) { let h = 1779033703 ^ str.length; for (let i=0;i<str.length;i++) { h=Math.imul(h^str.charCodeAt(i),3432918353); h=(h<<13)|(h>>>19); } return () => { h=Math.imul(h^(h>>>16),2246822507); h=Math.imul(h^(h>>>13),3266489909); return (h^=h>>>16)>>>0; }; }
function mulberry32(a) { return () => { a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function sample(topics) { const a=[...topics].sort((x,y)=>x.id.localeCompare(y.id)); const rand=mulberry32(xmur3(SEED)()); for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a.slice(0,N); }
function quantile(a,q) { if (!a.length) return null; const x=(a.length-1)*q, lo=Math.floor(x), hi=Math.ceil(x); return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(x-lo); }
function wilson(k,n) { if (!n) return null; const z=1.959964,p=k/n,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n)); return {lo:Math.max(0,100*(c-m)/d),hi:Math.min(100,100*(c+m)/d)}; }
async function one(params) {
  const url = new URL(BASE); for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v); url.searchParams.set('rows','0'); url.searchParams.set('mailto',MAILTO);
  const attempts=[];
  for (let attempt=0;attempt<5;attempt++) {
    const wait=Math.max(0,MIN_GAP_MS-(Date.now()-lastStart)); if(wait) await sleep(wait); lastStart=Date.now();
    try { const r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':`trend-probe-crossref/1.0 (mailto:${MAILTO})`}}); const raw=await r.text();
      if (r.ok) { const total=JSON.parse(raw)?.message?.['total-results']; if(Number.isSafeInteger(total)&&total>=0) return {ok:true,total,url:url.toString(),attempts}; attempts.push({attempt:attempt+1,status:r.status,error:'invalid_total'}); }
      else attempts.push({attempt:attempt+1,status:r.status,error:raw.slice(0,200)});
      const retry=Number(r.headers.get('retry-after')); await sleep(Number.isFinite(retry)&&retry>0?retry*1000:1000*2**attempt);
    } catch(e) { attempts.push({attempt:attempt+1,error:String(e.message||e)}); await sleep(1000*2**attempt); }
  }
  return {ok:false,url:url.toString(),attempts};
}
function summarise(rows) { const done=rows.filter(r=>r.state!=='query_failed'), measured=rows.filter(r=>r.state==='measured'), narrow=rows.filter(r=>r.state==='too_narrow'), ratios=measured.map(r=>r.ratio).sort((a,b)=>a-b), ge=ratios.filter(x=>x>=1000).length, lt=ratios.filter(x=>x<100).length; const median=quantile(ratios,.5); return { sampled:rows.length, completed:done.length, measured:measured.length, too_narrow:narrow.length, query_failed:rows.length-done.length, ratio_median:median, ratio_p5:quantile(ratios,.05), ratio_p95:quantile(ratios,.95), pct_ratio_ge_1000:ratios.length?100*ge/ratios.length:null, pct_ratio_lt_100:ratios.length?100*lt/ratios.length:null, pct_too_narrow:done.length?100*narrow.length/done.length:null, ci:{pct_ratio_ge_1000:wilson(ge,ratios.length),pct_ratio_lt_100:wilson(lt,ratios.length),pct_too_narrow:wilson(narrow.length,done.length)}, predictions:{P1_median_ge_100:median!==null&&median>=100,P2_ge1000_pct_ge10:ratios.length>0&&100*ge/ratios.length>=10,P3_too_narrow_pct_lt30:done.length>0&&100*narrow.length/done.length<30} }; }
function save(frameSha, rows) { const result={spec:'trend-scale/crossref-1.0',source:'Crossref REST API',collected_at:new Date().toISOString(),prereg_sha256:crypto.createHash('sha256').update(fs.readFileSync(preregPath)).digest('hex'),sampling:{frame:'../topics.json',frame_sha256:frameSha,N_frame:4516,n_target:N,n_actual:rows.length,seed:SEED,method:'sort topic id; xmur3+mulberry32 Fisher-Yates; first n'},calibers:{loose:'query',title:'query.title',ratio:'query / query.title',too_narrow:'query.title total-results < 10'},request_policy:{mailto:MAILTO,min_request_start_gap_ms:MIN_GAP_MS,max_attempts:5,backoff_seconds:[1,2,4,8,16]},summary:summarise(rows),rows}; fs.writeFileSync(outPath,JSON.stringify(result,null,2)); }
async function main() { const frameRaw=fs.readFileSync(framePath); const frame=JSON.parse(frameRaw); if(frame.topics.length!==4516) throw new Error(`Unexpected sampling frame size: ${frame.topics.length}`); const frameSha=crypto.createHash('sha256').update(frameRaw).digest('hex'); const selected=sample(frame.topics); let rows=[]; if(fs.existsSync(outPath)){const old=JSON.parse(fs.readFileSync(outPath)); if(old?.sampling?.seed===SEED&&old?.sampling?.frame_sha256===frameSha) rows=old.rows||[]; else throw new Error('Existing result has a different frozen design; refusing to mix runs.');}
  for(let i=rows.length;i<selected.length;i++){const t=selected[i]; const loose=await one({query:t.display_name}); const title=await one({'query.title':t.display_name}); let state='query_failed',ratio=null; if(loose.ok&&title.ok){state=title.total<10?'too_narrow':'measured'; if(state==='measured')ratio=loose.total/title.total;} rows.push({index:i+1,topic_id:t.id,display_name:t.display_name,state,fulltext_loose:loose.ok?loose.total:null,title_phrase:title.ok?title.total:null,ratio,queries:{loose,title}}); save(frameSha,rows); process.stderr.write(`completed ${i+1}/${selected.length}: ${state}\n`); }
  const s=summarise(rows); process.stderr.write(JSON.stringify(s,null,2)+'\n'); }
main().catch(e=>{console.error(e.stack||e);process.exit(1);});
