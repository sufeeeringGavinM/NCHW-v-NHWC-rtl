const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');for(const f of ['engine.js','tiling.js'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'));
const states=['IDLE','SETUP','PLAN_TILE','PREPARE','INPUT_READ','INPUT_WRITE','KERNEL_READ','KERNEL_WRITE','START_CORE','WAIT_CORE','OUTPUT_READ','OUTPUT_WRITE','NEXT_TILE'],core=['IDLE','PRIME','LOAD_WEIGHTS','RUN','SWITCH_TAP'];let edges=0,transfers=0;
for(const name of ['default','fallback']){
 const trace=JSON.parse(fs.readFileSync(path.join(__dirname,`rtl-trace-${name}.json`))),s=CFTiled.create(trace.config,trace.x,trace.w);
 for(const [i,actual]of trace.edges.entries()){
  CFTiled.step(s);const L=s.layer,e=L.event,j=L.d.jobs[L.job],label=`${name} edge ${i+1}`;
  assert.equal(L.state,states[actual.state],label);assert.equal(s.state,core[actual.core],label+' core');assert.equal(s.finished,!!actual.done,label+' done');
  if(actual.transfer){assert.equal(e.kind,actual.transfer.kind,label);assert.equal(e.address-L[e.kind+'Base'],actual.transfer.index,label+' address');if(actual.transfer.value!==undefined)assert.equal(e.value,actual.transfer.value,label+' store data');transfers++;}
  else assert.equal(e.address,undefined,label+' no transfer');
  if(actual.local)for(const key of ['kind','bank','word','value'])assert.equal(e[key],actual.local[key],label+' local '+key);
  if(actual.patch)assert.deepEqual([j.n,j.k,j.p,j.q,j.c,j.r,j.s,j.K,j.Q,j.C,j.h,j.w,j.i,j.j,j.pad_i,j.pad_j],actual.patch,label+' descriptor');
  edges++;
 }
 assert(CFTiled.check(s).ok);assert.deepEqual(CFTiled.output(s),trace.y);
}
console.log(JSON.stringify({rtlEdges:edges,backingTransfers:transfers,configurations:2,checks:'scheduler/core FSM, descriptors, every backing address/store value, local DMA writes, completion edge'}));
