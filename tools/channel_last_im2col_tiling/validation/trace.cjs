const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');for(const f of ['engine','tiling'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'));
const states=['IDLE','SETUP','PLAN_TILE','PREPARE','INPUT_READ','INPUT_WRITE','KERNEL_READ','KERNEL_WRITE','START_CORE','WAIT_CORE','OUTPUT_READ','OUTPUT_WRITE','NEXT_TILE'],coreStates=['IDLE','PRIME','LOAD_WEIGHTS','RUN','SWITCH_GROUP'];let edges=0,transfers=0,localWrites=0;
for(const f of JSON.parse(fs.readFileSync(path.join(__dirname,'rtl-fixtures.json')))){
 const s=CLTiled.create(f.config,f.x,f.w),wr=[];const ib=8,kb=ib+f.x.length+8,ob=kb+f.w.length+8;
 while(!s.finished){const pre={scheduler:s.layer.state,core:s.state,base:s.base,count:s.runCount,job:s.layer.job},rtl=f.trace[s.edge],edge=s.edge;assert(rtl,edge);assert.equal(states[rtl[1]],pre.scheduler,'scheduler edge '+edge);
  CLTiled.step(s);const e=s.layer.event,ce=s.event;
  if(pre.scheduler==='WAIT_CORE'&&!s.layer.event?.coreDone&&coreStates[rtl[2]]!=='IDLE'){
   assert.equal(coreStates[rtl[2]],pre.core,'core state '+edge);assert.equal(rtl[3],pre.base,'base '+edge);assert.equal(rtl[4],pre.count,'step '+edge);assert.equal(rtl[5],Number(ce?.advance??false),'advance '+edge);
  }
  if(pre.scheduler==='WAIT_CORE'&&ce)for(const z of ce.writes)wr.push([z.k,z.addr,z.value]);
  const re=pre.scheduler==='INPUT_READ'||pre.scheduler==='KERNEL_READ',we=pre.scheduler==='OUTPUT_WRITE';assert.equal(rtl[6],Number(re));assert.equal(rtl[7],Number(we));
  if(re||we){const base=e.kind==='input'?s.layer.inputBase:e.kind==='kernel'?s.layer.kernelBase:s.layer.outputBase,rb=e.kind==='input'?ib:e.kind==='kernel'?kb:ob;assert.equal(rtl[re?8:9]-rb,e.address-base,'memory address '+edge);if(we)assert.equal(rtl[10],e.value,'store data '+edge);transfers++;}edges++;
 }
 assert.equal(s.edge,f.trace.length);assert.deepEqual(s.layer.result,f.y);assert.equal(s.cycles,s.layer.d.total);
 // Writes from simultaneous physical columns can be printed in either simulator process order.
 const sort=a=>a.map(z=>z.join(',')).sort();assert.deepEqual(sort(wr),sort(f.writes.map(z=>z.slice(1))));localWrites+=wr.length;
 console.log('PASS RTL trace',s.edge,'edges',wr.length,'local writes',s.cycles,'cycles');
}
console.log('PASS',edges,'RTL edges,',transfers,'backing transfers,',localWrites,'local writes');
