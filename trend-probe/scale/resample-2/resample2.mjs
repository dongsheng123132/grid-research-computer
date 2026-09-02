#!/usr/bin/env node
// Reproducible OpenAlex resample for trend-probe/scale/resample-2.
// The preregistration fixes the time slice, seed, n, states, and thresholds.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const OUT_REL = 'demo/trend-probe/scale/resample-2/result-resample2.json';
const FRAME = path.resolve(HERE, '../topics.json');
const PREREG = path.join(HERE, 'PREREG-resample2.md');
const SEED = 'trend-scale-resample2-20260902';
const N = 500, POP_N = 4516, YEARS = '2015-2024';
const MAILTO = 'HEFANGSHENG@gmail.com';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const enc = encodeURIComponent;
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

function xmur3(str) { let h = 1779033703 ^ str.length; for (let i=0;i<str.length;i++) { h=Math.imul(h^str.charCodeAt(i),3432918353); h=(h<<13)|(h>>>19); } return () => { h=Math.imul(h^(h>>>16),2246822507); h=Math.imul(h^(h>>>13),3266489909); return (h^=h>>>16)>>>0; }; }
function mulberry32(a) { return () => { a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
function sample(topics) { const a=[...topics].sort((x,y)=>x.id.localeCompare(y.id)); const r=mulberry32(xmur3(SEED)()); for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a.slice(0,N); }
function classify(c) { return ![c.fulltext_loose,c.title_abstract_phrase,c.title_phrase].every(Number.isFinite) ? 'error' : c.title_phrase < 10 ? 'too_narrow' : 'measured'; }
function quantile(a,q) { if (!a.length) return null; const i=(a.length-1)*q,l=Math.floor(i),h=Math.ceil(i); return l===h?a[l]:a[l]+(a[h]-a[l])*(i-l); }
const fpc = Math.sqrt((POP_N-N)/(POP_N-1));
function wilson(k,n) { if (!n) return null; const z=1.959964,p=k/n,se=fpc*Math.sqrt(p*(1-p)/n),d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(se*se+z*z/(4*n*n)); return {lo:Math.max(0,100*(c-m)/d),hi:Math.min(100,100*(c+m)/d)}; }

const secrets = path.join(ROOT, '.secrets', 'apikeys.env');
const key = fs.existsSync(secrets) ? (fs.readFileSync(secrets,'utf8').match(/^OPENALEX_API_KEY=(.+)$/m)||[])[1]?.trim() : null;
const apiMode = key ? 'api_key_from_local_secret' : 'anonymous';
const apiMeta = { mode: apiMode, retries_per_query: 5, timeout_ms: 40000, min_inter_request_delay_ms: 130, queries_attempted: 0, successful_queries: 0, failed_queries: 0, status_counts: {} };

async function api(query) {
  let last = null;
  for (let attempt=1;attempt<=5;attempt++) {
    apiMeta.queries_attempted++;
    try {
      const u = new URL(`https://api.openalex.org/${query}`);
      u.searchParams.set('mailto', MAILTO); if(key) u.searchParams.set('api_key',key);
      const res=await fetch(u,{signal:AbortSignal.timeout(40000)});
      apiMeta.status_counts[res.status]=(apiMeta.status_counts[res.status]||0)+1;
      if(res.ok) { const json=await res.json(); const count=json?.meta?.count; if(Number.isFinite(count)) { apiMeta.successful_queries++; await sleep(130); return count; } last=`HTTP ${res.status}: missing numeric meta.count`; }
      else last=`HTTP ${res.status}`;
      if(res.status!==429 && res.status<500) break;
      const retry=Number(res.headers.get('retry-after')); await sleep(Number.isFinite(retry)&&retry>0?retry*1000:1000*2**(attempt-1));
    } catch(e) { last=`${e.name}: ${e.message}`; await sleep(1000*2**(attempt-1)); }
  }
  apiMeta.failed_queries++; await sleep(130); return {error:last||'unknown query failure'};
}
async function calibers(phrase) {
  const q=`\"${phrase}\"`, yr=`publication_year:${YEARS}`;
  // Deliberately sequential: this is a bounded, low-burst API client, not a load test.
  const a=await api(`works?search=${enc(phrase)}&filter=${enc(yr)}&per-page=1`);
  const b=await api(`works?filter=${enc(`title_and_abstract.search:${q},${yr}`)}&per-page=1`);
  const c=await api(`works?filter=${enc(`title.search:${q},${yr}`)}&per-page=1`);
  return {fulltext_loose:typeof a==='number'?a:null,title_abstract_phrase:typeof b==='number'?b:null,title_phrase:typeof c==='number'?c:null,query_errors:[a,b,c].filter(x=>typeof x==='object').map(x=>x.error)};
}
function southbridgeWrite(value) {
  const temp=path.join(os.tmpdir(),`resample2-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(temp,JSON.stringify(value,null,1));
  const run=spawnSync(process.execPath,[path.join(ROOT,'southbridge','southbridge-cli.mjs'),'write','--relpath',OUT_REL,'--content-file',temp,'--idempotency-key',`trend-scale-resample2-${sha256(JSON.stringify(value))}`],{cwd:ROOT,encoding:'utf8'});
  fs.rmSync(temp,{force:true});
  if(run.status!==0) throw new Error(`Southbridge result write failed: ${run.stdout||''} ${run.stderr||''}`);
  process.stderr.write(`${run.stdout.trim()}\n`);
}
async function main() {
  if(!fs.existsSync(PREREG)||!fs.existsSync(FRAME)) throw new Error('Missing preregistration or frozen topic frame; no query was sent.');
  const frameBytes=fs.readFileSync(FRAME), frame=JSON.parse(frameBytes);
  if(sha256(frameBytes)!=='7df1bf6f2a819bbbc9c22483894188e61384bcb69b63f6ce8802a2b29b2b15c9') throw new Error('Frozen sampling-frame SHA-256 differs from preregistration; no query was sent.');
  if(frame.topics.length!==POP_N) throw new Error('Frozen sampling-frame size differs from preregistration; no query was sent.');
  const rows=[];
  for (const [i,t] of sample(frame.topics).entries()) {
    const c=await calibers(t.display_name), state=classify(c);
    const row={topic_id:t.id,display_name:t.display_name,state,fulltext_loose:c.fulltext_loose,title_abstract_phrase:c.title_abstract_phrase,title_phrase:c.title_phrase};
    if(c.query_errors.length) row.query_errors=c.query_errors;
    if(state==='measured') row.ratio=c.fulltext_loose/c.title_phrase;
    rows.push(row); process.stderr.write(`\r${i+1}/${N}`);
  }
  process.stderr.write('\n');
  const measured=rows.filter(x=>x.state==='measured'), narrow=rows.filter(x=>x.state==='too_narrow'), errored=rows.filter(x=>x.state==='error');
  const ratios=measured.map(x=>x.ratio).sort((a,b)=>a-b), pct=(k,n)=>+(100*k/n).toFixed(4);
  const median=quantile(ratios,.5), p5=quantile(ratios,.05), p95=quantile(ratios,.95), ge=pct(ratios.filter(x=>x>=1000).length,ratios.length), lt=pct(ratios.filter(x=>x<100).length,ratios.length), narrowPct=pct(narrow.length,rows.length);
  const out={spec:'trend-scale/resample-2.0',source:'OpenAlex',retrieved_at:new Date().toISOString(),prereg_sha256:sha256(fs.readFileSync(PREREG)),sampling:{seed:SEED,frame:'../topics.json',frame_sha256:sha256(frameBytes),population_size:POP_N,sample_size:N,method:'sort by id → xmur3+mulberry32 Fisher-Yates → take first n'},time_slice:{publication_year:YEARS},query_definition:{fulltext_loose:'works?search=<phrase>&filter=publication_year:2015-2024',title_abstract_phrase:'works?filter=title_and_abstract.search:"<phrase>",publication_year:2015-2024',title_phrase:'works?filter=title.search:"<phrase>",publication_year:2015-2024'},api:apiMeta,states:{measured:measured.length,too_narrow:narrow.length,error:errored.length},stats:{ratio_median:median,ratio_p5:p5,ratio_p95:p95,pct_ratio_ge_1000:ge,pct_ratio_lt_100:lt,pct_too_narrow:narrowPct},ci:{pct_ratio_ge_1000:wilson(ratios.filter(x=>x>=1000).length,ratios.length),pct_ratio_lt_100:wilson(ratios.filter(x=>x<100).length,ratios.length),pct_too_narrow:wilson(narrow.length,rows.length)},prediction_outcomes:[{id:'P1',claim:'ratio median >= 100',held:median>=100,observed:median},{id:'P2',claim:'ratio >= 1000 share >= 10%',held:ge>=10,observed:ge},{id:'P3',claim:'ratio median in [5682, 22728]',held:median>=5682&&median<=22728,observed:median},{id:'P4',claim:'too_narrow share in [50%, 85%]',held:narrowPct>=50&&narrowPct<=85,observed:narrowPct}],honest_bounds:'This is an n=500 random sample, not a census. It measures only OpenAlex at the recorded retrieval time and the display_name of a topic need not be a researcher-entered query. Errors and too_narrow rows are retained but excluded from ratio statistics; proportions use finite-population-corrected Wilson intervals.',rows};
  southbridgeWrite(out);
}
main().catch(e=>{console.error(`ABORTED: ${e.message}`);process.exit(1);});
