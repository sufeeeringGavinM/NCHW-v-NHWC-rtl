const assert=require('assert/strict'),path=require('path'),{pathToFileURL}=require('url');const {chromium}=require('C:/Users/RageAgainstW10/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);let stageStops=0,outputCells=0;
 const front=(kind,id)=>p.locator(`#schedule${kind==='x'?'Input':kind==='w'?'Kernel':'Output'}Stacks [data-tensor-id="${id}"] [data-schedule-front-plane="true"]`).getAttribute('data-channel');
 const outputCheck=async(mode)=>{
  const result=await p.evaluate(mode=>{
   const L=sim.layer,d=L.d,j=d.jobs[L.job],cells=[...document.querySelectorAll('#scheduleOutputStacks .schedule-tensor-cell')];let bad=0,grey=0;
   for(const cell of cells){const a=cell.dataset,n=+a.id,k=+a.c,p=+a.i,q=+a.j,selected=n===j.n&&k>=j.k&&k<j.k+j.K&&p===j.p&&q>=j.q&&q<j.q+j.Q;if(cell.classList.contains('tap-used')!==selected)bad++;if(selected)grey++;
    let wanted=null;
    if(mode==='prefix'&&selected){wanted=0;for(let c=0;c<d.ct;c++)for(let r=0;r<d.r;r++)for(let s=0;s<d.s;s++){const h=p*d.stride_i+r*d.dilation_i-d.pad_i,w=q*d.stride_j+s*d.dilation_j-d.pad_j;if(h>=0&&h<d.h&&w>=0&&w<d.w)wanted=(wanted+L.X[((n*d.c+c)*d.h+h)*d.w+w]*L.W[((k*d.c+c)*d.r+r)*d.s+s])|0;}}
    if(mode==='final'||mode==='storedTile'&&L.result[((n*d.k+k)*d.p+p)*d.q+q]!==null)wanted=L.expected[((n*d.k+k)*d.p+p)*d.q+q];
    if(mode==='freshTile')wanted=L.result[((n*d.k+k)*d.p+p)*d.q+q];
    if(cell.nextElementSibling.textContent!==(wanted===null?'—':String(wanted)))bad++;
   }
   return {bad,count:cells.length,grey,wantGrey:j.K*j.Q,wantCount:d.n*d.k*d.p*d.q};
  },mode);assert.equal(result.bad,0,mode);assert.equal(result.grey,result.wantGrey);assert.equal(result.count,result.wantCount);outputCells+=result.count;
 };
 await outputCheck('unknown');await p.click('#nextBlock');assert.equal(await front('x',0),'2');assert.equal(await front('x',1),'0');assert.equal(await front('w',3),'0');
 await p.locator('#scheduleInputStacks [data-tensor-id="1"] .schedule-channel-plane[data-channel="4"] > rect').first().click();assert.equal(await front('x',1),'4');assert.equal(await front('x',0),'2');
 await p.click('#nextBlock');assert.equal(await front('x',0),'4');assert.equal(await front('x',1),'4');assert.equal(await front('w',3),'0');
 await p.locator('#scheduleKernelStacks [data-tensor-id="0"] .schedule-channel-plane[data-channel="1"] > rect').first().click();assert.equal(await front('w',0),'1');
 await p.evaluate(()=>seek(sim.layer.d.jobs.find(j=>j.k===3).beginEdge+1));assert.equal(await front('w',0),'1');assert.equal(await front('w',3),'0');assert.equal(await front('y',0),'3');assert.equal(await front('y',1),'0');
 await p.evaluate(()=>seek(sim.layer.d.jobs.find(j=>j.n===1).beginEdge+1));assert.equal(await front('x',0),'0');assert.equal(await front('x',1),'0');assert.equal(await front('y',0),'3');assert.equal(await front('y',1),'0');
 // A completed first channel block contributes independently recomputed sums.
 await p.evaluate(()=>{preset('tiled');seek(sim.layer.d.jobs[0].endEdge-1)});await outputCheck('prefix');
 await p.evaluate(()=>seek(sim.layer.d.jobs[1].beginEdge+1));await outputCheck('prefix');
 await p.evaluate(()=>seek(sim.layer.d.jobs[2].endEdge));assert.equal(await p.evaluate(()=>sim.layer.state),'OUTPUT_READ');await p.click('#nextStage');assert.equal(await p.evaluate(()=>scheduleStage()),'Advance');await outputCheck('storedTile');
 await p.click('#nextStage');assert.equal(await p.evaluate(()=>scheduleStage()),'Plan');await outputCheck('freshTile');
 // Independently group raw FSM states and find the first future stage boundary.
 for(const preset of ['tiled','empty','fallback']){
  await p.evaluate(presetName=>{preset(presetName)},preset);
  for(let i=0;i<15;i++){
   const expected=await p.evaluate(()=>{const groups={IDLE:'Plan',SETUP:'Plan',PLAN_TILE:'Plan',PREPARE:'Plan',INPUT_READ:'Input DMA',INPUT_WRITE:'Input DMA',KERNEL_READ:'Kernel DMA',KERNEL_WRITE:'Kernel DMA',START_CORE:'Convolve tile',WAIT_CORE:'Convolve tile',OUTPUT_READ:'Output DMA',OUTPUT_WRITE:'Output DMA',NEXT_TILE:'Advance'},s=E.clone(sim),start=groups[s.layer.state];do{T.step(s)}while(!s.finished&&groups[s.layer.state]===start);return {edge:s.edge,state:s.layer.state};});
   await p.click('#nextStage');assert.deepEqual(await p.evaluate(()=>({edge:sim.edge,state:sim.layer.state})),expected);stageStops++;
  }
 }
 await p.evaluate(()=>preset('tiled'));await p.click('#finish');await outputCheck('final');assert(await p.isDisabled('#nextStage'));
 await p.evaluate(()=>{preset('tiled');seek(sim.layer.d.jobs[0].endEdge-1)});await p.evaluate(()=>scrollTo(0,0));await p.locator('.schedule-tensors').screenshot({path:path.resolve(__dirname,'output-stacks-desktop.png')});
 const at=await p.evaluate(()=>sim.edge);await p.click('#convolutionTab');assert.equal(await p.evaluate(()=>sim.edge),at);await p.click('#scheduleTab');await outputCheck('prefix');
 await p.setViewportSize({width:390,height:844});assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));await p.locator('#scheduleSpread').check();await outputCheck('prefix');await p.click('#minimalText');await outputCheck('prefix');await p.locator('.schedule-tensors').screenshot({path:path.resolve(__dirname,'output-stacks-mobile.png')});
 await p.evaluate(()=>{const el=$('cfg-ia');el.value=13;el.dispatchEvent(new Event('input',{bubbles:true}))});assert(await p.isDisabled('#nextStage'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({stageStops,outputCells,checks:'per-tensor fronts across input/filter/image transitions; exact output destinations; independent first-block sums, continuation, final stores, stale-tile suppression; first-edge stage boundaries for full/empty/fallback jobs; tabs, spread, Minimal text, mobile, invalid/completed controls; no page errors'}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
