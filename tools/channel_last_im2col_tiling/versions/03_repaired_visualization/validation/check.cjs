const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');for(const f of ['engine','tiling'])vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../src',f+'.js'),'utf8'),{filename:f+'.js'});
for(const cfg of [{a:4,n:1,c:4,k:2,h:6,w:6,r:3,s:3},{a:3,n:2,c:5,k:4,h:3,w:5,r:2,s:2,ia:3,oa:1,ka:3},{a:3,c:4,k:4,h:3,w:5,r:3,s:3,pad_i:1,pad_j:1,ia:2,oa:2,ka:2},{a:1,c:3,k:2,h:1,w:1,r:1,s:1,pad_i:2,pad_j:3,ia:2,oa:1,ka:1}]){
 const d=CLTiled.config(cfg),x=CLEngine.range(d.n*d.c*d.h*d.w).map(i=>i%17-8),w=CLEngine.range(d.k*d.c*d.r*d.s).map(i=>(i*3)%11-5),s=CLTiled.create(cfg,x,w);while(!s.finished&&s.edge<50000){CLTiled.step(s);if(s.layer.event.state==='WAIT_CORE'&&s.event)for(const z of s.event.writes)assert.equal(z.value,CLTiled.partialReference(s,z.k,z.addr),'independent partial sum');}assert(CLTiled.check(s).ok,JSON.stringify({cfg,check:CLTiled.check(s),actual:s.layer.result,want:s.layer.expected}));assert.equal(s.cycles,d.total);console.log('PASS',cfg.a,d.jobs.length,s.cycles,'clocks',s.layer.reads,'reads',s.layer.stores,'stores');
}

let seed=196,totalOutputs=0,totalEdges=0;
const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n};
for(let i=0;i<24;i++){
 const cfg={a:1+rand(5),n:1+rand(2),c:1+rand(7),k:1+rand(7),h:3+rand(4),w:3+rand(5),r:1+rand(3),s:1+rand(3),ia:2+rand(4),oa:1+rand(3),ka:1+rand(5),pad_i:rand(3),pad_j:rand(3),stride_i:1+rand(2),stride_j:1+rand(2),dilation_i:1+rand(2),dilation_j:1+rand(2)};
 let d;try{d=CLTiled.config(cfg)}catch(e){i--;continue}
 const x=CLEngine.range(d.n*d.c*d.h*d.w).map(()=>rand(256)-128),w=CLEngine.range(d.k*d.c*d.r*d.s).map(()=>rand(256)-128),s=CLTiled.create(cfg,x,w);
 while(!s.finished&&s.edge<=30001){CLTiled.step(s);if(s.layer.event.state==='WAIT_CORE'&&s.event)for(const z of s.event.writes)assert.equal(z.value,CLTiled.partialReference(s,z.k,z.addr));}
 assert(CLTiled.check(s).ok);assert.equal(s.cycles,d.total);totalOutputs+=s.layer.result.length;totalEdges+=s.edge;
}
console.log('PASS 24 deterministic signed random layers,',totalOutputs,'outputs,',totalEdges,'edges and every intermediate output write');
