const assert=require('assert/strict'),path=require('path'),fs=require('fs');const {pathToFileURL}=require('url');const {chromium}=require('C:/Users/RageAgainstW10/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const b=await chromium.launch({headless:true,channel:'msedge'});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve(__dirname,'../dist/index.html')).href);
 assert(await p.locator('#scheduleView').isVisible());assert(!(await p.locator('#convolutionView').isVisible()));assert.equal(await p.locator('.pe').count(),0);
 await p.locator('#settings').evaluate(el=>el.open=true);
 for(const preset of ['tiled','fallback','empty','small','slides','batch','padding','signed','default']){
  await p.selectOption('#preset',preset);await p.click('#finish');assert.match(await p.textContent('#layerResult'),/All .* outputs match/);assert(await p.evaluate(()=>sim.cycles===sim.layer.d.total));
  await p.click('#convolutionTab');assert.equal(await p.locator('.pe').count(),await p.evaluate(()=>sim.d.a**2));await p.click('#scheduleTab');
 }
 await p.selectOption('#preset','tiled');await p.click('#nextState');assert.equal(await p.textContent('#edge'),'1');await p.click('#back');assert.equal(await p.textContent('#edge'),'0');
 // Clicking a job selects the prepared patch without restarting the layer.
 await p.click('[data-job="3"]');assert.equal(await p.evaluate(()=>sim.layer.job),3);assert.equal(await p.evaluate(()=>sim.layer.localJob),3);assert.equal(await p.evaluate(()=>sim.layer.state),'INPUT_READ');
 const descriptor=await p.evaluate(()=>({...sim.layer.d.jobs[sim.layer.job]}));
 await p.evaluate(()=>seek(sim.layer.d.jobs[sim.layer.job].startEdge+sim.d.a+4));const edge=await p.textContent('#edge');
 await p.locator('#settings').evaluate(el=>el.open=false);await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.resolve(__dirname,'schedule-desktop.png'),fullPage:true});
 await p.click('#convolutionTab');assert.equal(await p.textContent('#edge'),edge);assert.equal(await p.evaluate(()=>sim.layer.job),3);
 assert.equal(await p.locator('.pe').count(),9);assert.equal(await p.locator('#array [data-input-queue]').count(),3);
 await p.selectOption('#inputView','physical');assert.equal(await p.locator('#inputMatrix .input-bank').count(),descriptor.C);
 const source=p.locator('#inputMatrix [data-source-kind="x"]').first();await source.focus();assert.match(await p.textContent('#sourceReadout'),/global resident X\[/);assert(await p.locator('.tensor-cell.source-linked').count()>0);
 await p.selectOption('#inputView','lowered');await p.locator('#spreadChannels').check();assert(await p.locator('.tensor-stack').count()>0);
 await p.click('[data-pe="0,0"]');for(const tab of ['input','weights','output','schedule']){await p.click(`[data-tab="${tab}"]`);assert((await p.textContent('#moduleBody')).length>100);}
 await p.click('[data-tap="1"]');assert.equal(await p.evaluate(()=>sim.r*sim.d.s+sim.s),1);
 await p.click('#step');assert(await p.locator('.moving-token').count()>0);assert(await p.locator('.reg').count()>0);
 await p.locator('#reference').check();assert(await p.locator('#outputs .expected').count()>0);
 await p.screenshot({path:path.resolve(__dirname,'convolution-desktop.png'),fullPage:true});
 await p.locator('#settings').evaluate(el=>el.open=false);await p.locator('#desktopMode').check();await p.click('[data-window="array"]');assert(await p.locator('.desktop-mode').count());await p.click('[data-panel="array"] [data-window-action="maximize"]');assert(await p.locator('[data-panel="array"]').evaluate(el=>el.classList.contains('window-maximized')));
 const at=await p.textContent('#edge');await p.click('#scheduleTab');assert.equal(await p.textContent('#edge'),at);assert(!(await p.locator('[data-panel="array"]').isVisible()));
 await p.setViewportSize({width:390,height:844});assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
 await p.click('#convolutionTab');await p.locator('#desktopMode').uncheck();assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
 await p.click('#minimalText');await p.click('#step');assert(await p.locator('.pe').count());await p.screenshot({path:path.resolve(__dirname,'convolution-mobile.png'),fullPage:true});
 await p.click('#scheduleTab');await p.screenshot({path:path.resolve(__dirname,'schedule-mobile.png'),fullPage:true});
 // Tensor editors always describe the full layer, despite the local zoom.
 await p.setViewportSize({width:1440,height:1000});await p.locator('#settings').evaluate(el=>el.open=true);await p.selectOption('#preset','small');await p.fill('#cfg-c','5');assert.equal(await p.textContent('#error'),'');assert.equal(await p.locator('#inputEditors input').count(),45);
 await p.fill('#inputEditors input >> nth=0','-128');await p.click('#random');assert.equal(await p.locator('#inputEditors input').count(),45);
 await p.locator('#pasteX').evaluate(el=>el.closest('details').open=true);await p.fill('#pasteX','1 2');await p.click('[data-paste="x"]');assert.match(await p.textContent('#error'),/provide/);assert(await p.isDisabled('#step'));
 await p.selectOption('#preset','tiled');await p.fill('#cfg-ia','13');assert.match(await p.textContent('#error'),/1–12/);await p.selectOption('#preset','tiled');
 await p.click('#finish');const download=p.waitForEvent('download');await p.click('#export');const dl=await download;const output=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.equal(output.inputNCHW.length,150);assert.equal(output.kernelKCRS.length,80);assert.equal(output.outputNKPQ.length,64);assert(output.check.ok);
 await p.click('#reset');await p.selectOption('#speed','180');await p.click('#play');await p.waitForTimeout(450);await p.click('#play');assert(Number(await p.textContent('#edge'))>=2);
 assert.deepEqual(errors,[]);console.log('PASS: 9 presets; same-clock tabs; prepared-job/tap seek, back/reset/play; PE motion/registers; lowered/physical SRAM; global source linking; full-layer editors/export; reference; floating maximize; Minimal text; 390px responsive layout; no page errors.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
