/* Both tabs inspect one clocked model. Only the detail tab draws individual PEs. */
let activeView='schedule';
const scheduleStages=[['Plan',['IDLE','SETUP','PLAN_TILE','PREPARE']],['Input DMA',['INPUT_READ','INPUT_WRITE']],['Kernel DMA',['KERNEL_READ','KERNEL_WRITE']],['Convolve tile',['START_CORE','WAIT_CORE']],['Output DMA',['OUTPUT_READ','OUTPUT_WRITE']],['Advance',['NEXT_TILE']]];
function scheduleStage(){return sim.finished?'Done':scheduleStages.find(([,states])=>states.includes(sim.layer.state))[0];}
function nextScheduleStage(){if(!valid||sim.finished)return;pause();const stage=scheduleStage();do{clockEdge(sim);}while(!sim.finished&&scheduleStage()===stage);render();}
function render(animate=false){
 x=sim.x;w=sim.w;
 if(activeView==='convolution')renderLocal(animate);
 const L=sim.layer,d=L.d,j=d.jobs[L.job];
 $('shapeSummary').textContent=`${d.n}×${d.c}×${d.h}×${d.w} → ${d.n}×${d.k}×${d.p}×${d.q} · ${d.a}×${d.a} array`;
 $('capacity').innerHTML=[`Input ${2**d.ia}`,`Output ${2**d.oa}`,`Kernel ${2**d.ka}`].map(v=>`<span>${v} words / bank</span>`).join('');
 $('clock').textContent=sim.cycles;$('clockTotal').textContent=`/ ${d.total}`;$('edge').textContent=sim.edge;$('seek').max=d.total+1;$('seek').value=sim.edge;
 $('phasebar').innerHTML=['IDLE','SETUP','PLAN_TILE','PREPARE','INPUT_READ','INPUT_WRITE','KERNEL_READ','KERNEL_WRITE','START_CORE','WAIT_CORE','OUTPUT_READ','OUTPUT_WRITE','NEXT_TILE'].map(v=>`<span class="${L.state===v?'active':''}">${v}${v==='WAIT_CORE'?' · '+sim.state:''}</span>`).join('');
 $('runLabel').textContent=`Job ${L.job+1}/${d.jobs.length} · tile ${j.tile+1}/${d.tiles}${activeView==='convolution'?` · CRS group ${Math.floor(sim.base/sim.d.a)+1}`:''}${sim.finished?' · done':''}`;
 for(const id of ['play','step','nextState','nextStage','nextTap','finish'])$(id).disabled=!valid||sim.finished;
 $('back').disabled=!valid||sim.edge===0;$('seek').disabled=!valid;
 const summary=`n${j.n} · k ${j.k}–${j.k+j.K-1} · p${j.p} · q ${j.q}–${j.q+j.Q-1} · c ${j.c}–${j.c+j.C-1}${d.tapMode?` · global tap (${j.r},${j.s})`:''}`;
 const resident=L.d.jobs[L.localJob],localSummary=`n${resident.n} · k ${resident.k}–${resident.k+resident.K-1} · p${resident.p} · q ${resident.q}–${resident.q+resident.Q-1} · c ${resident.c}–${resident.c+resident.C-1}${d.tapMode?` · global tap (${resident.r},${resident.s})`:""}`;
 $('tilingOverview').innerHTML=`<b>Resident tile ${resident.tile+1} · local job ${L.localJob+1} · ${L.state}</b><p>${localSummary}</p><p>Local N=P=1 · ${resident.C} rows × ${resident.K} columns · patch ${resident.h}×${resident.w}, origin (${resident.i},${resident.j}), padding (${resident.pad_i},${resident.pad_j}) · continue_sum=${Number(resident.continue)}.</p><p>Tensor coordinates below are local; hover any linked value for full-layer coordinates. During DMA, unwritten SRAM contains retained or unknown data.</p>`;
 if(activeView==='convolution'){
  $('tapBadge').textContent=`CRS group ${Math.floor(sim.base/sim.d.a)+1}/${Math.ceil(sim.d.c*sim.d.r*sim.d.s/sim.d.a)}`;
  $('result').textContent=`Resident sums · ${resident.continue?'continuing this tile':'initial contribution'} · ${sim.writes.flat().reduce((a,b)=>a+b,0)} writes in this job`;
  if(L.state!=='WAIT_CORE'&&L.state!=='START_CORE'){$('storyTitle').textContent=L.state;$('storyText').textContent='The core is idle while the accelerator transfers or plans this tile. Local memories retain their contents.';}
  $('arraySubtitle').textContent=`Physical ${d.a}×${d.a} · row i maps to CRS term ${sim.base}+i; column k maps to global k=${resident.k}+column`;
 }else renderSchedule(summary);
}
function renderSchedule(summary){
 const s=sim,L=s.layer,d=L.d,j=d.jobs[L.job],e=L.event;
 $('scheduleOverview').innerHTML=`<div class="eyebrow">FULL LAYER / HARDWARE-OWNED TILING</div><h2>${sim.finished?'Layer complete':`Tile ${j.tile+1} of ${d.tiles} · job ${L.job+1} of ${d.jobs.length}`}</h2><p>${summary}</p><div class="capacity"><span>${d.tapMode?'One-tap fallback':'Full-kernel jobs'}</span><span>Ct ≤ ${d.ct} · Kt ≤ ${d.a} · Qt ≤ ${d.qt}</span><span>${L.completed}/${d.jobs.length} jobs complete</span><span>${L.reads}/${d.reads} reads · ${L.stores}/${d.stores} stores</span></div><p>Loop order: image → output-channel block → output row → output-column block → input-channel block${d.tapMode?' → kernel tap':''}. SRAM sums remain resident until all contributions complete.</p>`;
 renderTileSelection();
 const current=L.state,groups=scheduleStages;
 $('scheduleProcess').innerHTML=`<div class="tile-process">${groups.map(([name,states])=>`<div class="process-card ${states.includes(current)?'current':''}"><b>${name}</b><span>${name==='Convolve tile'?`1×${j.C}×${j.h}×${j.w}<br>⊛ ${j.K}×${j.C}×${j.R}×${j.S}<br>→ 1×${j.K}×1×${j.Q}`:name==='Input DMA'?`${j.C*j.h*j.w} words`:name==='Kernel DMA'?`${j.K*j.C*j.R*j.S} words`:name==='Output DMA'?`${j.K*j.Q} final words`:name==='Advance'?`Tile ${j.tile+1}/${d.tiles}`:'Clip · select blocks'}</span></div>`).join('')}</div><p class="transfer-detail"><b>${current}${current==='WAIT_CORE'?` · ${s.state}`:''}</b> · ${e?`Last edge: ${e.state}${e.address!==undefined?` · backing @${e.address} ${e.kind==='output'?'←':'→'} ${e.value}`:e.kind?` · local ${e.kind} bank ${e.bank} @${e.word} · ${e.value}`:''}`:'Step to accept the layer start.'}</p><p>Local patch: ${j.h}×${j.w} at (${j.i},${j.j}); local pad (${j.pad_i},${j.pad_j}). ${!j.h||!j.w?'Entirely padded: input DMA skipped.':''} ${j.continue?'Continue resident partial sums.':'Initialize output sums.'}</p><div class="meter"><div style="width:${100*Math.min(s.cycles,d.total)/d.total}%"></div></div><p>${current==='WAIT_CORE'?`Abstract convolution job: ${Math.min(s.edge-j.startEdge,j.cycles)} / ${j.cycles} clocks. Open Current tile convolution to inspect the array.`:'Reads request on one edge; writes consume on the next. Transfers and computation are serialized.'}</p>`;
 const pages=Math.ceil(d.jobs.length/20),old=Number($('jobPage').value||0);
 if($('jobPage').options.length!==pages)$('jobPage').innerHTML=range(pages).map(i=>`<option value="${i}">${i*20+1}–${Math.min(d.jobs.length,(i+1)*20)}</option>`).join('');
 const page=Number($('jobPage').dataset.manual==='true'?old:Math.floor(L.job/20));$('jobPage').value=page;
 $('jobTimeline').innerHTML=rows(['Job / seek','Tile','n · k · p · q','C block','Taps','Local patch','Sum','State'],d.jobs.slice(page*20,page*20+20).map((v,i)=>{const z=page*20+i;return [`<button data-job="${z}" ${z===L.job?'aria-current="step"':''}>${z+1}${z===L.job?' ◀':''}</button>`,v.tile+1,`${v.n} · ${v.k}…${v.k+v.K-1} · ${v.p} · ${v.q}…${v.q+v.Q-1}`,`${v.c}…${v.c+v.C-1}`,d.tapMode?`${v.r},${v.s}`:`${d.r}×${d.s}`,`${v.h}×${v.w}`,v.continue?'add':'init',z<L.completed?'done':z===L.job?current:'pending'];}));
 for(const [id,count]of [['layerImage',d.n],['layerChannel',d.c],['layerFilter',d.k]])if($(id).options.length!==count)$(id).innerHTML=range(count).map(i=>`<option>${i}</option>`).join('');
 const n=Number($('layerImage').value),c=Number($('layerChannel').value),k=Number($('layerFilter').value),grid=(h,w,fn)=>`<div class="global-grid-scroll"><div class="global-grid" style="grid-template-columns:repeat(${w},minmax(35px,1fr))">${range(h*w).map(i=>fn(Math.floor(i/w),i%w)).join('')}</div></div>`;
 $('layerMemory').innerHTML=`<div class="module-grid"><div><h3>Backing input X[${n},${c},:,:]</h3>${grid(d.h,d.w,(h,w)=>{const idx=E.xindex(d,n,c,h,w),inside=n===j.n&&c>=j.c&&c<j.c+j.C&&h>=j.i&&h<j.i+j.h&&w>=j.j&&w<j.j+j.w;return `<span class="cell ${inside?'tile-source':''} ${e?.kind==='input'&&e.address===L.inputBase+idx?'fresh':''}" title="X[${n},${c},${h},${w}] · backing @${L.inputBase+idx}">${L.X[idx]}</span>`;})}</div><div><h3>Backing output Y[${n},${k},:,:]</h3>${grid(d.p,d.q,(p,q)=>{const idx=E.yindex(d,n,k,p,q),inside=n===j.n&&k>=j.k&&k<j.k+j.K&&p===j.p&&q>=j.q&&q<j.q+j.Q;return `<span class="cell ${inside?'tile-output':''} ${L.result[idx]!==null?'written':''} ${e?.state==='OUTPUT_WRITE'&&e.address===L.outputBase+idx?'fresh':''}" title="Y[${n},${k},${p},${q}] · backing @${L.outputBase+idx} · ref ${L.expected[idx]}">${fmt(L.result[idx])}</span>`;})}</div></div><p id="layerResult">${s.finished?(T.check(s).ok?`✓ All ${L.result.length} outputs match the reference.`:'Output mismatch.'):`${L.stores}/${L.result.length} final stores committed; partial sums stay in local SRAM.`}</p><p class="small muted">Word bases: input ${L.inputBase} · kernel ${L.kernelBase} · output ${L.outputBase}. Teaching bases include 64-word gaps. Source defaults A4 and 256 words per bank remain available; the tiling presets use smaller builds to expose boundaries.</p>`;
}
function setView(view){
 activeView=view;$('scheduleView').hidden=view!=='schedule';$('convolutionView').hidden=view!=='convolution';
 $('scheduleTab').setAttribute('aria-selected',view==='schedule');$('convolutionTab').setAttribute('aria-selected',view==='convolution');
 // Floating windows are positioned against the page; hide them with their tab.
 document.body.classList.toggle('schedule-view',view==='schedule');render();
}
document.addEventListener('DOMContentLoaded',()=>{
 document.body.classList.add('schedule-view');
 $('scheduleTab').onclick=()=>setView('schedule');$('convolutionTab').onclick=()=>setView('convolution');
 for(const id of ['layerImage','layerChannel','layerFilter'])$(id).onchange=()=>render();
 $('nextStage').onclick=nextScheduleStage;
 $('scheduleSpread').onchange=()=>{selectionKey='';render();};
 $('previousBlock').onclick=()=>seek(sim.layer.d.jobs[Math.max(0,sim.layer.job-1)].beginEdge+1);
 $('nextBlock').onclick=()=>seek(sim.layer.d.jobs[Math.min(sim.layer.d.jobs.length-1,sim.layer.job+1)].beginEdge+1);
 document.addEventListener('click',ev=>{const button=ev.target.closest('[data-schedule-front]'),plane=ev.target.closest('.schedule-channel-plane');if(button){selectionFront=Number(button.dataset.scheduleFront);const L=sim.layer,j=L.d.jobs[L.job];selectionFronts.x[j.n]=selectionFront;for(let k=j.k;k<j.k+j.K;k++)selectionFronts.w[k]=selectionFront;}else if(plane){const kind=plane.dataset.kind,id=Number(plane.dataset.id),channel=Number(plane.dataset.channel);selectionFronts[kind][id]=channel;if(kind!=='y')selectionFront=channel;}else return;selectionKey='';outputSelectionKey='';render();});
 $('jobPage').onchange=()=>{$('jobPage').dataset.manual='true';render();};
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-job]');if(b){$('jobPage').dataset.manual='false';seek(sim.layer.d.jobs[Number(b.dataset.job)].beginEdge+1);}});
 document.querySelector('.view-tabs').addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'||ev.key==='ArrowLeft'){ev.preventDefault();setView(activeView==='schedule'?'convolution':'schedule');$(activeView==='schedule'?'scheduleTab':'convolutionTab').focus();}});
});

// The same stacked 2D channel-plane method used by the detailed tap view,
// applied to full-layer coordinates and the accelerator's actual DMA blocks.
let selectionLayer=null,selectionJob=-1,selectionFront=0,selectionKey='',outputSelectionKey='',selectionFronts={x:{},w:{},y:{}};
function resetSelectionFronts(){selectionLayer=null;selectionJob=-1;selectionKey=outputSelectionKey='';selectionFronts={x:{},w:{},y:{}};}
function tileSourceSelected(d,j,kind,id,c,i,v){
 if(kind==='y')return id===j.n&&c>=j.k&&c<j.k+j.K&&i===j.p&&v>=j.q&&v<j.q+j.Q;
 if(c<j.c||c>=j.c+j.C)return false;
 return kind==='x'?id===j.n&&i>=j.i&&i<j.i+j.h&&v>=j.j&&v<j.j+j.w:
  id>=j.k&&id<j.k+j.K&&(!d.tapMode||i===j.r&&v===j.s);
}
function selectedOutputValue(n,k,p,q){
 const L=sim.layer,d=L.d,j=d.jobs[L.job],stored=L.result[E.yindex(d,n,k,p,q)];
 if(stored!==null)return {value:stored,status:'stored final output'};
 const resident=d.jobs[L.localJob],localK=k-j.k,localQ=q-j.q;
 if(tileSourceSelected(d,j,'y',n,k,p,q)&&resident.tile===j.tile&&(resident.continue||sim.writes[localK]?.[localQ]>0))return {value:sim.mem[localK][localQ],status:'resident partial sum'};
 return {value:null,status:'not written for this output tile'};
}
function tileStackSVG(kind,id,front,spread){
 const L=sim.layer,d=L.d,j=d.jobs[L.job],input=kind==='x',output=kind==='y',channels=output?d.k:d.c,
  h=input?d.h:output?d.p:d.r,wid=input?d.w:output?d.q:d.s,
  cell=Math.max(22,Math.min(34,240/Math.max(h,wid))),dx=spread?wid*cell+30:28,dy=spread?0:24,
  sw=wid*cell+(channels-1)*dx+12,sh=h*cell+(spread?0:(channels-1)*dy)+36,
  color=c=>`hsl(${((input?180:output?270:20)+id*137+c*37)%360} 62% ${76+(c%2)*5}%)`,
  order=range(channels).reverse().filter(c=>c!==front);
 order.push(front);
 let html=`<svg class="tensor-stack schedule-stack" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" role="img" aria-label="Full ${input?'input image':output?'output image':'kernel filter'} ${id}; grey cells ${output?'receive contributions from':'are selected for'} job ${L.job+1}">`;
 for(const c of order){
  const ox=6+c*dx,oy=28+(spread?0:(channels-1-c)*dy),selectedPlane=output?id===j.n&&c>=j.k&&c<j.k+j.K:c>=j.c&&c<j.c+j.C&&(input?id===j.n:id>=j.k&&id<j.k+j.K);
  html+=`<g class="schedule-channel-plane" data-kind="${kind}" data-id="${id}" data-channel="${c}" data-selected="${selectedPlane}" data-schedule-front-plane="${c===front}"><rect x="${ox-2}" y="${oy-23}" width="90" height="20" rx="4" fill="${color(c)}" stroke="${selectedPlane?'#173c46':'#829291'}" stroke-width="${selectedPlane?2:1}"/><text x="${ox+5}" y="${oy-9}" font-size="11" font-weight="700" fill="#173c46">${output?'k':'c'} = ${c}${selectedPlane?' · tile':''}${c===front?' ◀':''}</text>`;
  for(let i=0;i<h;i++)for(let v=0;v<wid;v++){
   const used=tileSourceSelected(d,j,kind,id,c,i,v),datum=output?selectedOutputValue(id,c,i,v):null,
    value=input?L.X[E.xindex(d,id,c,i,v)]:output?datum.value:L.W[E.windex(d,id,c,i,v)],cx=ox+v*cell,cy=oy+i*cell,
    coords=`${input?'X':output?'Y':'W'}[${id},${c},${i},${v}]`,status=output?datum.status:used?'selected tile source':'outside this job';
   html+=`<g><title>${coords} = ${fmt(value)} · ${status}${output&&used?' · current output tile':''}</title><rect class="schedule-tensor-cell ${used?'tap-used':''}" data-kind="${kind}" data-id="${id}" data-c="${c}" data-i="${i}" data-j="${v}" ${output?`data-status="${status}"`:''} x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="${used?'#d9dde0':color(c)}" stroke="${used?'#677a83':'#556b6a'}" stroke-width="1"/><text x="${cx+cell/2}" y="${cy+cell/2+4}" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="${output?9:value<-99?10:12}" font-weight="${used?700:500}" fill="#203d45">${fmt(value)}</text></g>`;
  }
  html+=`<rect x="${ox}" y="${oy}" width="${wid*cell}" height="${h*cell}" fill="none" stroke="${selectedPlane?'#173c46':'#607873'}" stroke-width="${selectedPlane?2:1}"/></g>`;
 }
 return html+'</svg>';
}
function selectionGallery(kind,count,spread){
 const L=sim.layer,d=L.d,j=d.jobs[L.job],output=kind==='y',input=kind==='x';
 return range(count).map(id=>{const selected=kind==='w'?id>=j.k&&id<j.k+j.K:id===j.n,front=selectionFronts[kind][id]??0;return `<div class="stack-card ${selected?'tile-selected-card':''}" data-tensor-id="${id}"><h4>${input?'Image n':output?'Output n':'Filter k'} = ${id}<small>${selected?'Selected · ':''}${output?d.k:d.c} ${output?'output':'input'} channels · ${input?d.h:output?d.p:d.r} × ${input?d.w:output?d.q:d.s}</small></h4><div class="stack-scroll">${tileStackSVG(kind,id,front,spread)}</div></div>`;}).join('');
}
function keepSelectionVisible(id){
 const gallery=$(id),chosen=gallery.querySelector('.tile-selected-card');
 gallery.scrollTop=chosen?chosen.offsetTop-gallery.firstElementChild.offsetTop:0;
 // Only selected tensor cards follow the active block. Unrelated cards retain
 // their own front channels and are not scrolled to the active channel.
 for(const box of gallery.querySelectorAll('.tile-selected-card .stack-scroll')){
  const plane=box.querySelector('[data-schedule-front-plane="true"]'),rect=plane?.firstElementChild;
  if(rect){box.scrollLeft=Math.max(0,Number(rect.getAttribute('x'))-4);box.scrollTop=Math.max(0,Number(rect.getAttribute('y'))-4);}
 }
}
function renderTileSelection(){
 const L=sim.layer,d=L.d,j=d.jobs[L.job];
 if(selectionLayer!==L||selectionJob!==L.job){
  selectionLayer=L;selectionJob=L.job;selectionFront=j.c;selectionKey=outputSelectionKey='';
  selectionFronts.x[j.n]=j.c;for(let k=j.k;k<j.k+j.K;k++)selectionFronts.w[k]=j.c;selectionFronts.y[j.n]=j.k;
 }
 const spread=$('scheduleSpread').checked,key=`${L.job}:${selectionFront}:${JSON.stringify(selectionFronts)}:${spread}`,
  outputKey=`${key}:${sim.writes.flat().reduce((a,b)=>a+b,0)}:${L.stores}`;
 $('previousBlock').disabled=!valid||L.job===0;$('nextBlock').disabled=!valid||L.job===d.jobs.length-1;
 if(outputKey!==outputSelectionKey){
  outputSelectionKey=outputKey;$('scheduleOutputStacks').innerHTML=selectionGallery('y',d.n,spread);keepSelectionVisible('scheduleOutputStacks');
 }
 if(key===selectionKey)return;
 selectionKey=key;
 $('tileSelectionLabel').textContent=`Image ${j.n} · input channels ${j.c}–${j.c+j.C-1} · filters ${j.k}–${j.k+j.K-1} → output Y[${j.n}, ${j.k}…${j.k+j.K-1}, ${j.p}, ${j.q}…${j.q+j.Q-1}]${d.tapMode?` · tap (${j.r},${j.s})`:''}`;
 $('scheduleChannels').innerHTML=range(d.c).map(c=>`<button data-schedule-front="${c}" aria-pressed="${c===selectionFront}" class="${c>=j.c&&c<j.c+j.C?'selected-channel':''}">c${c}${c>=j.c&&c<j.c+j.C?' · tile':''}</button>`).join('');
 $('scheduleInputStacks').innerHTML=selectionGallery('x',d.n,spread);$('scheduleKernelStacks').innerHTML=selectionGallery('w',d.k,spread);
 $('selectionPadding').textContent=(j.h&&j.w?`Grey input cells: clipped rows ${j.i}–${j.i+j.h-1}, columns ${j.j}–${j.j+j.w-1}. Grey kernel cells: ${d.tapMode?'this single tap':'all taps'} in the selected input channels and filters.`:'Entirely padded patch: no input cells are transferred; selected kernel weights multiply generated zeros.')+' Grey output cells mark the region receiving this job’s contribution. Values show resident partial sums or stored final outputs; — means this output has not been written.';
 keepSelectionVisible('scheduleInputStacks');keepSelectionVisible('scheduleKernelStacks');
}
