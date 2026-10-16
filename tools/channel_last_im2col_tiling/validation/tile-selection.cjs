const assert=require('assert/strict'),path=require('path');const {pathToFileURL}=require('url');const {chromium}=require('C:/Users/RageAgainstW10/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);let states=0,cells=0,empty=0;
 const check=async()=>{
  const result=await p.evaluate(()=>{
   const L=sim.layer,d=L.d,j=d.jobs[L.job],rects=[...document.querySelectorAll('.schedule-tensor-cell:not([data-kind="y"])')];let bad=0;
   for(const rect of rects){const a=rect.dataset,n=+a.id,c=+a.c,i=+a.i,w=+a.j,input=a.kind==='x',selected=c>=j.c&&c<j.c+j.C&&(input?n===j.n&&i>=j.i&&i<j.i+j.h&&w>=j.j&&w<j.j+j.w:n>=j.k&&n<j.k+j.K&&(!d.tapMode||i===j.r&&w===j.s)),value=input?L.X[E.xindex(d,n,c,i,w)]:L.W[E.windex(d,n,c,i,w)];
    if(selected!==rect.classList.contains('tap-used')||rect.nextElementSibling.textContent!==String(value)||selected&&rect.getAttribute('fill')!=='#d9dde0')bad++;
   }
   return {bad,cells:rects.length,input:document.querySelectorAll('#scheduleInputStacks .tap-used').length,kernel:document.querySelectorAll('#scheduleKernelStacks .tap-used').length,wantInput:j.C*j.h*j.w,wantKernel:j.K*j.C*(d.tapMode?1:d.r*d.s),images:document.querySelectorAll('#scheduleInputStacks .stack-card').length,filters:document.querySelectorAll('#scheduleKernelStacks .stack-card').length,n:d.n,k:d.k,edge:sim.edge,empty:!j.h||!j.w};
  });assert.equal(result.bad,0);assert.equal(result.input,result.wantInput);assert.equal(result.kernel,result.wantKernel);assert.equal(result.images,result.n);assert.equal(result.filters,result.k);states++;cells+=result.cells;if(result.empty)empty++;
 };
 await p.locator('#settings').evaluate(el=>el.open=true);
 for(const preset of ['tiled','fallback','empty','padding']){
  await p.selectOption('#preset',preset);
  const count=await p.evaluate(()=>sim.layer.d.jobs.length);
  for(let job=0;job<count;job++){await p.evaluate(i=>seek(sim.layer.d.jobs[i].beginEdge+1),job);await check();}
 }
 await p.selectOption('#preset','tiled');await p.locator('#settings').evaluate(el=>el.open=false);
 await p.click('#nextBlock');assert.equal(await p.evaluate(()=>sim.layer.job),1);await check();
 await p.click('#previousBlock');assert.equal(await p.evaluate(()=>sim.layer.job),0);await check();
 const edge=await p.evaluate(()=>sim.edge);await p.click('[data-schedule-front="4"]');assert.equal(await p.evaluate(()=>selectionFront),4);assert.equal(await p.evaluate(()=>sim.edge),edge);await check();
 await p.locator('#scheduleSpread').check();await check();assert.equal(await p.locator('#scheduleInputStacks .schedule-stack, #scheduleKernelStacks .schedule-stack').count(),6);
 await p.locator('#scheduleSpread').uncheck();await p.click('#nextBlock');assert.equal(await p.evaluate(()=>selectionFront),2);
 await p.locator('#scheduleKernelStacks .schedule-channel-plane[data-channel="3"]').first().click();assert.equal(await p.evaluate(()=>selectionFront),3);assert.equal(await p.evaluate(()=>sim.edge),await p.evaluate(()=>sim.layer.d.jobs[1].beginEdge+1));
 await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'tile-selection-desktop.png'),fullPage:true});
 const at=await p.evaluate(()=>sim.edge);await p.click('#convolutionTab');assert.equal(await p.evaluate(()=>sim.edge),at);assert.equal(await p.locator('.pe').count(),9);await p.click('#scheduleTab');await check();
 await p.setViewportSize({width:390,height:844});assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));await p.click('#minimalText');assert(await p.locator('.schedule-tensor-cell.tap-used').count()>0);await check();await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'tile-selection-mobile.png'),fullPage:true});
 await p.click('#nextBlock');await p.click('#previousBlock');await check();await p.click('#reset');await check();assert.deepEqual(errors,[]);
 console.log(JSON.stringify({states,displayedCells:cells,emptyPatches:empty,checks:'all masks/values across every job in four presets; channel/filter/batch/width tails, dilation/padding/fallback, gray cells, controls, front/spread, tabs, replay, Minimal text, mobile; no page errors'}));
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
