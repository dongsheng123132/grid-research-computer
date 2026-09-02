#!/usr/bin/env node
// Fixed, independent acceptance checks for the preregistered resample-2 run.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const HERE=path.dirname(fileURLToPath(import.meta.url)), read=p=>fs.readFileSync(p,'utf8');
const result=JSON.parse(read(path.join(HERE,'result-resample2.json'))), frame=JSON.parse(read(path.join(HERE,'../topics.json')));
if(result.run_status==='blocked_before_dataset'){
 console.error('BLOCKED: result-resample2.json records a network-blocked attempt with no dataset; statistical verification is intentionally refused.');
 process.exit(2);
}
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'); const H=hash(read(path.join(HERE,'PREREG-resample2.md')));
const N=500, POP=4516, seed='trend-scale-resample2-20260902'; let checks=[];
const J=(id,ok,detail='')=>checks.push({id,ok,detail});
function xmur3(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19}return()=>{h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return(h^=h>>>16)>>>0}}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function drawn(){let a=[...frame.topics].sort((x,y)=>x.id.localeCompare(y.id)),r=mulberry32(xmur3(seed)());for(let i=a.length-1;i;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a.slice(0,N).map(x=>x.id)}
function q(a,p){let i=(a.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return l===h?a[l]:a[l]+(a[h]-a[l])*(i-l)}
function ci(k,n){if(!n)return null;let z=1.959964,p=k/n,f=Math.sqrt((POP-N)/(POP-1)),se=f*Math.sqrt(p*(1-p)/n),d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(se*se+z*z/(4*n*n));return{lo:Math.max(0,100*(c-m)/d),hi:Math.min(100,100*(c+m)/d)}}
const rows=result.rows||[], measured=rows.filter(x=>x.state==='measured'), narrow=rows.filter(x=>x.state==='too_narrow'), errors=rows.filter(x=>x.state==='error'), ratios=measured.map(x=>x.ratio).sort((a,b)=>a-b);
const pct=(k,n)=>100*k/n, close=(a,b,t=.01)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;
J('V1',result.prereg_sha256===H,'preregistration hash');
J('V2',result.sampling?.seed===seed&&result.sampling?.population_size===POP&&result.sampling?.sample_size===N&&result.time_slice?.publication_year==='2015-2024','fixed slice/seed/N/n');
J('V3',result.sampling?.frame_sha256==='7df1bf6f2a819bbbc9c22483894188e61384bcb69b63f6ce8802a2b29b2b15c9'&&frame.topics.length===POP,'frozen frame');
J('V4',rows.length===N&&JSON.stringify(rows.map(x=>x.topic_id))===JSON.stringify(drawn()),`rows=${rows.length}`);
const recomputed=rows.map(x=>![x.fulltext_loose,x.title_abstract_phrase,x.title_phrase].every(Number.isFinite)?'error':x.title_phrase<10?'too_narrow':'measured');
J('V5',recomputed.every((x,i)=>x===rows[i].state),'mechanical three-state classification');
J('V6',measured.every(x=>x.title_phrase>=10&&close(x.ratio,x.fulltext_loose/x.title_phrase,Math.abs(x.fulltext_loose/x.title_phrase)*.000001+1e-9)),'measured denominator and ratio');
J('V7',measured.every(x=>x.fulltext_loose>=x.title_abstract_phrase&&x.title_abstract_phrase>=x.title_phrase),'monotonicity');
J('V8',errors.length/rows.length<=.05,`API error=${errors.length}/${rows.length}`);
J('V9',ratios.filter(x=>x<100).length>0,'negative control ratio<100');
const s=result.stats||{}, ge=pct(ratios.filter(x=>x>=1000).length,ratios.length), lt=pct(ratios.filter(x=>x<100).length,ratios.length), np=pct(narrow.length,rows.length);
J('V10',close(s.ratio_median,q(ratios,.5),Math.abs(q(ratios,.5))*.01+1e-9)&&close(s.ratio_p5,q(ratios,.05),Math.abs(q(ratios,.05))*.01+1e-9)&&close(s.ratio_p95,q(ratios,.95),Math.abs(q(ratios,.95))*.01+1e-9),'quantiles');
J('V11',close(s.pct_ratio_ge_1000,ge,.01)&&close(s.pct_ratio_lt_100,lt,.01)&&close(s.pct_too_narrow,np,.01),'shares');
for(const [key,k,n] of [['pct_ratio_ge_1000',ratios.filter(x=>x>=1000).length,ratios.length],['pct_ratio_lt_100',ratios.filter(x=>x<100).length,ratios.length],['pct_too_narrow',narrow.length,rows.length]]){const a=result.ci?.[key],b=ci(k,n);J(`V12-${key}`,a&&b&&close(a.lo,b.lo,.5)&&close(a.hi,b.hi,.5),'FPC Wilson CI')}
const p=result.prediction_outcomes||[], expected=[s.ratio_median>=100,ge>=10,s.ratio_median>=5682&&s.ratio_median<=22728,np>=50&&np<=85];
J('V13',p.length===4&&p.every((x,i)=>x.held===expected[i]),'all preregistered prediction outcomes');
for(const x of checks) console.log(`${x.ok?'PASS':'FAIL'} ${x.id} ${x.detail}`); const fails=checks.filter(x=>!x.ok); console.log(`VERDICT ${checks.length-fails.length}/${checks.length}`);process.exit(fails.length?2:0);
