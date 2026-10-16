// Read-only adapter: reuse the accepted simulator models without changing them.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'../..');
const ctx={}, hashes={};
for(const [key,folder] of [['CF','channel_first_im2col_tiling'],['CL','channel_last_im2col_tiling']]){
 const c=vm.createContext({});ctx[key]=c;
 for(const f of ['engine.js','tiling.js']){const p=path.join(root,'tools',folder,'src',f),s=fs.readFileSync(p,'utf8');hashes[path.relative(root,p)]=crypto.createHash('sha256').update(s).digest('hex');vm.runInContext(s,c);}
}
// Repeated local geometries have exactly the same address arbitration schedule.
const cache=new Map(),E=ctx.CL.CLEngine,original=E.jobCycles;
E.jobCycles=d=>{const k=JSON.stringify(Object.fromEntries(['a','n','c','k','h','w','r','s','p','q','m','ia','oa','ka','pad_i','pad_j','stride_i','stride_j','dilation_i','dilation_j','continue'].map(k=>[k,d[k]])));if(!cache.has(k))cache.set(k,original(d));return cache.get(k);};
const base={a:4,n:1,c:4,k:2,h:6,w:6,r:3,s:3,ia:8,oa:8,ka:8,pad_i:0,pad_j:0,stride_i:1,stride_j:1,dilation_i:1,dilation_j:1};
function measure(raw,key){const d=ctx[key][key+'Tiled'].config(raw);let ideal=0;for(const j of d.jobs){const g=key==='CF'?j.R*j.S:Math.ceil(j.C*j.R*j.S/d.a);ideal+=1+d.a+g*(j.Q+2*d.a)+g-1;}
 const dma=2*(d.reads+d.stores),control=1+2*d.tiles+3*d.jobs.length,wait=d.coreCycles-ideal;
 assert(wait>=0);assert.equal(d.total,ideal+wait+dma+control);
 return {cycles:d.total,core:d.coreCycles,idealCore:ideal,wait,dma,control,jobs:d.jobs.length,tiles:d.tiles,ct:d.ct,qt:d.qt,tapMode:d.tapMode,reads:d.reads,stores:d.stores,p:d.p,q:d.q};}
const sweeps=[['array','Array side A',Array.from({length:10},(_,i)=>i+1),v=>({a:v})],['channels','Input channels C',Array.from({length:16},(_,i)=>i+1),v=>({c:v})],['spatial','Input height = width',Array.from({length:18},(_,i)=>i+3),v=>({h:v,w:v})],['filters','Output filters K',Array.from({length:12},(_,i)=>i+1),v=>({k:v})],['kernel','Kernel height = width',Array.from({length:6},(_,i)=>i+1),v=>({r:v,s:v})],['sram_all','Words per bank (all SRAMs)',Array.from({length:10},(_,i)=>i+1),v=>({ia:v,oa:v,ka:v})],...['ia','oa','ka'].map((k,i)=>['sram_'+k,['Input','Output','Kernel'][i]+' SRAM words per bank',Array.from({length:10},(_,i)=>i+1),v=>({[k]:v})])];
sweeps.splice(5,0,['batch','Images N',Array.from({length:8},(_,i)=>i+1),v=>({n:v})],['stride','Stride (height and width)',[1,2,3,4],v=>({stride_i:v,stride_j:v})],['dilation','Dilation (height and width)',[1,2],v=>({dilation_i:v,dilation_j:v})]);
const rows=[];function add(sweep,x,cfg){const row={sweep,x,cfg};for(const key of ['CF','CL']){try{row[key]=measure(cfg,key);}catch(e){row[key]={error:e.message};}}rows.push(row);}
for(const [id,label,values,change]of sweeps){for(const v of values)add(id,id.startsWith('sram')?2**v:v,{...base,...change(v)});console.log('Collected',id);}
for(let a=1;a<=10;a++)for(let c=1;c<=12;c++)add('array_channels',a,{...base,a,c});
// Reuse accepted RTL fixtures: source hashes establish which model was executed.
let fixtures=0;for(const key of ['CF','CL']){const p=path.join(root,'tools',key==='CF'?'channel_first_im2col_tiling':'channel_last_im2col_tiling','validation','rtl-fixtures.json');for(const f of JSON.parse(fs.readFileSync(p))){if(f.cycles!==undefined){assert.equal(measure(f.config,key).cycles,f.cycles);fixtures++;}}}
assert.equal(measure(base,'CF').cycles,1721);assert.equal(measure(base,'CL').cycles,1865);
// Selected full edge replays check the aggregation against actual scheduler execution.
let replays=0;for(const raw of [base,{...base,a:3,c:5,h:3,w:5,r:2,s:2,ia:3,oa:1,ka:3},{...base,c:1,h:3,w:3,r:3,s:3,ia:1,oa:1,ka:1}])for(const key of ['CF','CL']){
 const T=ctx[key][key+'Tiled'],d=T.config(raw),s=T.create(raw,Array(raw.n*raw.c*raw.h*raw.w).fill(1),Array(raw.k*raw.c*raw.r*raw.s).fill(1));while(!s.finished&&s.edge<=30001)T.step(s);assert(T.check(s).ok);assert.equal(s.cycles,d.total);replays++;}
const result={base,sweeps:sweeps.map(([id,label])=>({id,label})),rows,provenance:{hashes,rtlFixtureCycleChecks:fixtures,fullSchedulerReplays:replays,localGeometries:cache.size,note:'Exact existing bounded teaching models; CL arbitration simulated. Rejected configurations retained as gaps. Same words per bank, A banks per memory, 8-bit inputs/weights and 32-bit sums. No frequency/area comparison.'}};
fs.writeFileSync(path.join(__dirname,'cycles.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({rows:rows.length,fixtures,replays,localGeometries:cache.size,invalid:rows.filter(r=>r.CF.error||r.CL.error).length}));
