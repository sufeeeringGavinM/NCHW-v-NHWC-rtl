const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
for(const f of ['engine.js','tiling.js'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'));
let cases=0,outputs=0,partials=0,edges=0,seed=196;
const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
function run(raw,x,w,fixture){
 const s=CFTiled.create(raw,x,w),d=s.layer.d;let read=null,coreStarts=0;
 while(!s.finished){const L=s.layer,phase=L.state,j=d.jobs[L.job],wasDone=L.coreDone;
  CFTiled.step(s);edges++;
  if(phase==='INPUT_READ'||phase==='KERNEL_READ')read={...L.event};
  if(phase==='INPUT_WRITE'||phase==='KERNEL_WRITE'){assert.equal(L.event.value,read.value);assert.equal(L.event.bank,read.bank);assert.equal(L.event.word,read.word);read=null;}
  if(phase==='START_CORE'){assert.equal(s.edge,j.startEdge);coreStarts++;}
  if(phase==='WAIT_CORE'&&!wasDone&&L.coreDone){for(let k=0;k<j.K;k++)for(let q=0;q<j.Q;q++){assert.equal(s.mem[k][q],CFTiled.partialReference(s,k,q));partials++;}}
  assert(s.edge<=d.total+1);
 }
 assert(CFTiled.check(s).ok);assert.equal(s.cycles,d.total);assert.equal(s.layer.reads,d.reads);assert.equal(s.layer.stores,d.stores);assert.equal(coreStarts,d.jobs.length);
 if(fixture){assert.deepEqual(CFTiled.output(s),fixture.y);assert.equal(s.cycles,fixture.cycles);assert.equal(d.jobs.length,fixture.jobs);assert.equal(d.tiles,fixture.tiles);}
 cases++;outputs+=s.layer.result.length;
}
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'rtl-fixtures.json')));
for(const f of fixtures)run(f.config,f.x,f.w,f);
const directed=[{},{a:2,c:5,k:3,h:3,w:5,ia:3,oa:1,ka:2},{a:1,n:2,c:2,k:2,h:3,w:4,r:2,s:2,ia:1,oa:1,ka:1},{a:2,h:1,w:1,r:1,s:1,pad_i:2,pad_j:2,ia:1,ka:1,oa:1},{a:3,n:2,c:5,k:4,h:3,w:5,r:2,s:2,ia:3,oa:1,ka:3},{a:2,c:3,k:3,h:3,w:4,r:2,s:2,ia:2,oa:1,ka:1,pad_i:1,pad_j:1,dilation_i:2}];
for(let i=0;i<106;i++){
 const raw=i<directed.length?directed[i]:{a:1+random(4),n:1+random(2),c:1+random(7),k:1+random(6),h:1+random(6),w:1+random(7),r:1+random(3),s:1+random(3),pad_i:random(3),pad_j:random(3),stride_i:1+random(3),stride_j:1+random(2),dilation_i:1+random(3),dilation_j:1+random(3),ia:1+random(5),oa:1+random(4),ka:1+random(5)};
 let d;try{d=CFTiled.config(raw)}catch(e){if(i<directed.length)throw e;continue;}
 const x=Array.from({length:d.n*d.c*d.h*d.w},()=>random(256)-128),w=Array.from({length:d.k*d.c*d.r*d.s},()=>random(256)-128);run(raw,x,w);
}
// Ordinary direct-core behavior remains available; no scheduler sneaks into it.
const d=CFEngine.config(CFEngine.defaults),x=Array(d.n*d.c*d.h*d.w).fill(-128),w=Array(d.k*d.c*d.r*d.s).fill(127),s=CFEngine.create(d,x,w);while(!s.finished)CFEngine.step(s);assert(CFEngine.check(s).ok);
for(const raw of [{a:0},{ia:13},{h:0},{h:1,w:1,r:3,pad_i:0}])assert.throws(()=>CFTiled.config(raw));
console.log(JSON.stringify({cases,retainedRTLFixtures:fixtures.length,outputs,partials,edges,seed:196}));
