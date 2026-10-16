const assert=require('assert/strict'),path=require('path'),{pathToFileURL}=require('url');const {chromium}=require('C:/Users/RageAgainstW10/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});await p.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);await p.click('#convolutionTab');
 const counts=await p.evaluate(()=>{
  let states=0,cells=0,stalled=0,advanced=0,retries=0,motion=0,queued=0,padding=0,aligned=0,weightStallClocks=0;
  const ok=(v,msg)=>{if(!v)throw Error(msg)};
  for(const name of ['tiled','padding','default']){
   preset(name);let sampled=0,guard=0;
   while(sampled<(name==='default'?24:55)&&!sim.finished&&guard++<5000){
    const before={base:sim.base,count:sim.runCount,core:sim.state,layer:sim.layer.state,issue:sim.banks.issue,active:sim.banks.active,pending:[...sim.banks.pending],available:!sim.banks.occupied[sim.banks.issueSlot]||(sim.state==='RUN'&&sim.runCount<sim.d.m&&sim.banks.ready[sim.banks.readSlot]&&sim.banks.readSlot===sim.banks.issueSlot)};
    clockEdge(sim);if(before.layer!=='WAIT_CORE'||before.core!=='RUN'||sim.base!==before.base)continue;
    render(true);sampled++;states++;const s=sim,d=s.d,e=s.event;
    const reads=new Map(),granted=Array(d.a).fill(false),pending=Array(d.a).fill(false),enable=before.issue<d.m&&(before.active||before.available);
    for(let row=0;row<d.a;row++){
     const z=E.address(d,before.issue,before.base+row);pending[row]=before.active?before.pending[row]:z.valid;
     if(enable&&pending[row]){if(!reads.has(z.bank)){reads.set(z.bank,z.addr);granted[row]=true;}else if(reads.get(z.bank)===z.addr)granted[row]=true;}
     const node=document.querySelector(`[data-request-row="${row}"]`);ok(node.dataset.granted===String(granted[row]),'grant row '+row);ok(node.dataset.retry===String(enable&&pending[row]&&!granted[row]),'retry row '+row);
    }
    for(const node of document.querySelectorAll('.tensor-cell')){
     const a=node.dataset,c=+a.c,i=+a.i,j=+a.j,k=+a.id,kind=a.kind;let used=false,now=false;
     for(let row=0;row<d.a;row++){
      const term=s.base+row,cc=Math.floor(term/(d.r*d.s)),rr=Math.floor(term/d.s)%d.r,ss=term%d.s;if(term>=d.c*d.r*d.s||cc!==c)continue;
      if(kind==='w')used ||= rr===i&&ss===j;
      else for(let pos=0;pos<d.m;pos++){const h=Math.floor(pos/d.q)*d.stride_i+rr*d.dilation_i-d.pad_i,w=(pos%d.q)*d.stride_j+ss*d.dilation_j-d.pad_j;used ||= h===i&&w===j;}
      if(kind==='x'&&s.state==='RUN'){const pos=s.runCount-1-row;if(pos>=0&&pos<d.m){const h=rr*d.dilation_i-d.pad_i,w=pos*d.stride_j+ss*d.dilation_j-d.pad_j;now ||= h===i&&w===j;}}
     }
     ok(node.classList.contains('tap-used')===used,'group mask '+JSON.stringify(a));ok(node.classList.contains('input-fed')===(kind==='x'&&now),'held input mask');
     const value=kind==='x'?s.x[E.xindex(d,0,c,i,j)]:s.w[E.windex(d,k,c,i,j)];ok(node.nextElementSibling.textContent===String(value),'tensor value');cells++;
    }
    for(let row=0;row<d.a;row++)for(let k=0;k<d.k;k++){
     const token=currentActivation(s,row,k),raw=s.pe[row][k].token;if(token?.valid&&raw){ok(token.pos===raw.pos&&token.c===raw.c&&token.h===raw.h&&token.w===raw.w,'PE token identity');ok(token.value===s.x[E.xindex(d,token.n,token.c,token.h,token.w)],'PE payload');}if(token&&!token.valid){ok(token.value===0,'padding payload');padding++;}
    }
    for(const chip of document.querySelectorAll('.moving-token')){const row=+chip.dataset.row,k=+chip.dataset.k,w=chip.classList.contains('weight-token');ok(Number(chip.querySelector('b').textContent)===(w?s.pe[row][k].wo:s.pe[row][k].a),'moving payload');if(!w)ok(e.advance,'activation animated on held clock');
     const frames=chip.getAnimations()[0].effect.getKeyframes(),end=frames.at(-1).transform.match(/translate\(\s*([-\d.e+]+)px,\s*([-\d.e+]+)px/),grid=$('array'),box=grid.getBoundingClientRect(),scale=box.width/grid.offsetWidth,pe=grid.querySelector(`[data-pe="${row},${k}"]`),reg=pe.querySelectorAll('.reg')[Number(chip.dataset.buffer)],target=w&&reg?.getClientRects().length?reg:pe,r=target.getBoundingClientRect();ok(Math.abs(Number(end[1])-(r.left-box.left+r.width/2)/scale)<.15&&Math.abs(Number(end[2])-(r.top-box.top+r.height/2)/scale)<.15,'animation target alignment');aligned++;motion++;}
    ok(e.advance||!document.querySelector('.activation-token'),'held array motion');if(e.advance)advanced++;else stalled++;if(e.retry)retries++;if(!e.advance&&e.ctl.load){ok(document.querySelector('.weight-token'),'weights stopped on array stall');weightStallClocks++;}
    for(let slot=0;slot<2;slot++){const node=document.querySelector(`[data-slot="${slot}"]`);ok(node.dataset.ready===String(s.banks.ready[slot]),'slot ready');ok([...node.querySelectorAll('.slot-value')].every((v,i)=>Number(v.textContent)===s.banks.values[slot][i].value),'slot values');}
    if(sampled%8===0){
     const text=JSON.stringify(s),forecast=operandQueues(s,4),future=E.clone(s),expected=E.range(d.a).map(()=>[]),expectedW=E.range(d.a).map(()=>[]),base=s.base,job=s.layer.job;let wg=null;
     for(let after=1;after<600&&!future.finished;after++){
      const count=future.runCount;T.step(future);const ev=future.event;if(future.layer.job!==job||!ev||ev.base!==base)break;
      if(ev.advance)for(let row=0;row<Math.min(d.a,d.c*d.r*d.s-base);row++){const pos=count-row;if(pos>=0&&pos<d.m&&expected[row].length<4)expected[row].push({after,value:future.pe[row][0].a,pos});}
      if(ev.ctl.load){const key=ev.base+(ev.ctl.running?d.a:0)+':'+ev.ctl.writeBuffer;if(wg===null)wg=key;if(key===wg)for(let k=0;k<d.k;k++)if(expectedW[k].length<4)expectedW[k].push({after,value:future.pe[0][k].wo,row:ev.loadRow});}
     }
     for(let row=0;row<d.a;row++){ok(JSON.stringify(forecast.inputs[row].map(v=>({after:v.after,value:v.value,pos:v.pos})))===JSON.stringify(expected[row]),'queue trace row '+row);queued+=expected[row].length;}
     for(let k=0;k<d.k;k++){ok(JSON.stringify(forecast.weights[k].map(v=>({after:v.after,value:v.value,row:v.row})))===JSON.stringify(expectedW[k]),'weight queue trace');queued+=expectedW[k].length;}
     ok(text===JSON.stringify(s),'forecast mutated model');
    }
   }
  }
  return {states,cells,stalled,advanced,retries,motion,queued,padding,aligned,weightStallClocks};
 });console.log(counts);
 // Every tensor plane is retained; no 5-channel/256-cell truncation.
 await p.evaluate(()=>{const raw={...E.defaults,a:3,n:2,c:7,k:6,h:3,w:5,ia:5,oa:3,ka:4},d=T.config(raw),xx=E.range(d.n*d.c*d.h*d.w).map(i=>i%9),ww=E.range(d.k*d.c*d.r*d.s).map(i=>i%3-1);editors(d,xx,ww);init(d,xx,ww);setView('schedule')});
 assert.equal(await p.locator('#scheduleInputStacks .schedule-channel-plane').count(),14);assert.equal(await p.locator('#scheduleKernelStacks .schedule-channel-plane').count(),42);await p.click('#nextBlock');assert.equal(await p.locator('#scheduleInputStacks [data-tensor-id="1"] [data-schedule-front-plane="true"]').getAttribute('data-channel'),'0');
 await p.evaluate(()=>{const raw={...E.defaults,h:17,w:17,ia:10,oa:10},d=T.config(raw),xx=E.range(d.n*d.c*d.h*d.w).map(i=>i%9),ww=E.range(d.k*d.c*d.r*d.s).map(()=>1);editors(d,xx,ww);init(d,xx,ww)});assert.equal(await p.locator('#scheduleInputStacks .schedule-tensor-cell').count(),578);
 await p.evaluate(()=>{preset('tiled');seek(sim.layer.d.jobs[0].startEdge+8);setView('convolution')});await p.selectOption('#inputView','physical');assert.equal(await p.locator('.input-bank').count(),3);const source=p.locator('#inputMatrix [data-source-kind]').first();await source.focus();assert.match(await p.textContent('#sourceReadout'),/Global X\[/);assert(await p.locator('.tensor-cell.source-linked').count()>0);
 await p.evaluate(()=>{const a=Array.from(document.querySelectorAll('#inputMatrix [data-source-kind]')).at(-1);a?.focus()});
 await p.click('[data-tab="schedule"]');await p.click('[data-group="1"]');assert.equal(await p.evaluate(()=>sim.base),3);assert.equal(await p.evaluate(()=>sim.state),'RUN');
 await p.evaluate(()=>{preset('tiled');let guard=0;while(!sim.event?.retry&&guard++<500)clockEdge(sim);render();scrollTo(0,0)});await p.screenshot({path:path.resolve(__dirname,'repaired-convolution-desktop.png'),fullPage:true});await p.locator('#bankArbitration').screenshot({path:path.resolve(__dirname,'bank-arbitration.png')});
 await p.click('#scheduleTab');await p.evaluate(()=>scrollTo(0,0));await p.locator('.schedule-tensors').screenshot({path:path.resolve(__dirname,'repaired-schedule-desktop.png')});
 await p.setViewportSize({width:390,height:844});assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));await p.click('#convolutionTab');assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));await p.screenshot({path:path.resolve(__dirname,'repaired-convolution-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert(counts.stalled>0&&counts.retries>0&&counts.motion>0&&counts.queued>0);console.log('PASS repaired CL visual details, full tensors, source links, group seek and mobile');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
