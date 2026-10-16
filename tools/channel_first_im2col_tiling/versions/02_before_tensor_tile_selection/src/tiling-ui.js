/* Both tabs inspect one clocked model. Only the detail tab draws individual PEs. */
let activeView='schedule';
function render(animate=false){
 x=sim.x;w=sim.w;
 if(activeView==='convolution')renderLocal(animate);
 const L=sim.layer,d=L.d,j=d.jobs[L.job];
 $('shapeSummary').textContent=`${d.n}×${d.c}×${d.h}×${d.w} → ${d.n}×${d.k}×${d.p}×${d.q} · ${d.a}×${d.a} array`;
 $('capacity').innerHTML=[`Input ${2**d.ia}`,`Output ${2**d.oa}`,`Kernel ${2**d.ka}`].map(v=>`<span>${v} words / bank</span>`).join('');
 $('clock').textContent=sim.cycles;$('clockTotal').textContent=`/ ${d.total}`;$('edge').textContent=sim.edge;$('seek').max=d.total+1;$('seek').value=sim.edge;
 $('phasebar').innerHTML=['IDLE','SETUP','PLAN_TILE','PREPARE','INPUT_READ','INPUT_WRITE','KERNEL_READ','KERNEL_WRITE','START_CORE','WAIT_CORE','OUTPUT_READ','OUTPUT_WRITE','NEXT_TILE'].map(v=>`<span class="${L.state===v?'active':''}">${v}${v==='WAIT_CORE'?' · '+sim.state:''}</span>`).join('');
 $('runLabel').textContent=`Job ${L.job+1}/${d.jobs.length} · tile ${j.tile+1}/${d.tiles}${sim.finished?' · done':''}`;
 for(const id of ['play','step','nextState','nextTap','finish'])$(id).disabled=!valid||sim.finished;
 $('back').disabled=!valid||sim.edge===0;$('seek').disabled=!valid;
 const summary=`n${j.n} · k ${j.k}–${j.k+j.K-1} · p${j.p} · q ${j.q}–${j.q+j.Q-1} · c ${j.c}–${j.c+j.C-1}${d.tapMode?` · global tap (${j.r},${j.s})`:''}`;
 const resident=L.d.jobs[L.localJob],localSummary=`n${resident.n} · k ${resident.k}–${resident.k+resident.K-1} · p${resident.p} · q ${resident.q}–${resident.q+resident.Q-1} · c ${resident.c}–${resident.c+resident.C-1}${d.tapMode?` · global tap (${resident.r},${resident.s})`:""}`;
 $('tilingOverview').innerHTML=`<b>Resident tile ${resident.tile+1} · local job ${L.localJob+1} · ${L.state}</b><p>${localSummary}</p><p>Local N=P=1 · ${resident.C} rows × ${resident.K} columns · patch ${resident.h}×${resident.w}, origin (${resident.i},${resident.j}), padding (${resident.pad_i},${resident.pad_j}) · continue_sum=${Number(resident.continue)}.</p><p>Tensor coordinates below are local; hover any linked value for full-layer coordinates. During DMA, unwritten SRAM contains retained or unknown data.</p>`;
 if(activeView==='convolution'){
  $('tapBadge').textContent=`Local tap ${sim.r*sim.d.s+sim.s+1}/${sim.d.taps}`;
  $('result').textContent=`Resident sums · ${resident.continue?'continuing this tile':'initial contribution'} · ${sim.writes.flat().reduce((a,b)=>a+b,0)} writes in this job`;
  if(L.state!=='WAIT_CORE'&&L.state!=='START_CORE'){$('storyTitle').textContent=L.state;$('storyText').textContent='The core is idle while the accelerator transfers or plans this tile. Local memories retain their contents.';}
  $('arraySubtitle').textContent=`Physical ${d.a}×${d.a} · row c maps to global c=${resident.c}+row; column k maps to global k=${resident.k}+column`;
 }else renderSchedule(summary);
}
function renderSchedule(summary){
 const s=sim,L=s.layer,d=L.d,j=d.jobs[L.job],e=L.event;
 $('scheduleOverview').innerHTML=`<div class="eyebrow">FULL LAYER / HARDWARE-OWNED TILING</div><h2>${sim.finished?'Layer complete':`Tile ${j.tile+1} of ${d.tiles} · job ${L.job+1} of ${d.jobs.length}`}</h2><p>${summary}</p><div class="capacity"><span>${d.tapMode?'One-tap fallback':'Full-kernel jobs'}</span><span>Ct ≤ ${d.ct} · Kt ≤ ${d.a} · Qt ≤ ${d.qt}</span><span>${L.completed}/${d.jobs.length} jobs complete</span><span>${L.reads}/${d.reads} reads · ${L.stores}/${d.stores} stores</span></div><p>Loop order: image → output-channel block → output row → output-column block → input-channel block${d.tapMode?' → kernel tap':''}. SRAM sums remain resident until all contributions complete.</p>`;
 const current=L.state,groups=[['Plan',['IDLE','SETUP','PLAN_TILE','PREPARE']],['Input DMA',['INPUT_READ','INPUT_WRITE']],['Kernel DMA',['KERNEL_READ','KERNEL_WRITE']],['Convolve tile',['START_CORE','WAIT_CORE']],['Output DMA',['OUTPUT_READ','OUTPUT_WRITE']],['Advance',['NEXT_TILE']]];
 $('scheduleProcess').innerHTML=`<div class="tile-process">${groups.map(([name,states])=>`<div class="process-card ${states.includes(current)?'current':''}"><b>${name}</b><span>${name==='Convolve tile'?`1×${j.C}×${j.h}×${j.w}<br>⊛ ${j.K}×${j.C}×${j.R}×${j.S}<br>→ 1×${j.K}×1×${j.Q}`:name==='Input DMA'?`${j.C*j.h*j.w} words`:name==='Kernel DMA'?`${j.K*j.C*j.R*j.S} words`:name==='Output DMA'?`${j.K*j.Q} final words`:name==='Advance'?`Tile ${j.tile+1}/${d.tiles}`:'Clip · select blocks'}</span></div>`).join('')}</div><p class="transfer-detail"><b>${current}${current==='WAIT_CORE'?` · ${s.state}`:''}</b> · ${e?`Last edge: ${e.state}${e.address!==undefined?` · backing @${e.address} ${e.kind==='output'?'←':'→'} ${e.value}`:e.kind?` · local ${e.kind} bank ${e.bank} @${e.word} · ${e.value}`:''}`:'Step to accept the layer start.'}</p><p>Local patch: ${j.h}×${j.w} at (${j.i},${j.j}); local pad (${j.pad_i},${j.pad_j}). ${!j.h||!j.w?'Entirely padded: input DMA skipped.':''} ${j.continue?'Continue resident partial sums.':'Initialize output sums.'}</p><div class="meter"><div style="width:${100*Math.min(s.cycles,d.total)/d.total}%"></div></div><p>${current==='WAIT_CORE'?`Abstract convolution job: ${Math.min(s.edge-j.startEdge,j.cycles)} / ${j.cycles} clocks. Open Current tile convolution to inspect the array.`:'Reads request on one edge; writes consume on the next. Transfers and computation are serialized.'}</p>`;
 const pages=Math.ceil(d.jobs.length/20),old=Number($('jobPage').value||0);
 if($('jobPage').options.length!==pages)$('jobPage').innerHTML=range(pages).map(i=>`<option value="${i}">${i*20+1}–${Math.min(d.jobs.length,(i+1)*20)}</option>`).join('');
 const page=Number($('jobPage').dataset.manual==='true'?old:Math.floor(L.job/20));$('jobPage').value=page;
 $('jobTimeline').innerHTML=rows(['Job / seek','Tile','n · k · p · q','C block','Taps','Local patch','Sum','State'],d.jobs.slice(page*20,page*20+20).map((v,i)=>{const z=page*20+i;return [`<button data-job="${z}" ${z===L.job?'aria-current="step"':''}>${z+1}${z===L.job?' ◀':''}</button>`,v.tile+1,`${v.n} · ${v.k}…${v.k+v.K-1} · ${v.p} · ${v.q}…${v.q+v.Q-1}`,`${v.c}…${v.c+v.C-1}`,d.tapMode?`${v.r},${v.s}`:`${d.r}×${d.s}`,`${v.h}×${v.w}`,v.continue?'add':'init',z<L.completed?'done':z===L.job?current:'pending'];}));
 for(const [id,count]of [['layerImage',d.n],['layerChannel',d.c],['layerFilter',d.k]])if($(id).options.length!==count)$(id).innerHTML=range(count).map(i=>`<option>${i}</option>`).join('');
 const n=Number($('layerImage').value),c=Number($('layerChannel').value),k=Number($('layerFilter').value),grid=(h,w,fn)=>`<div class="global-grid-scroll"><div class="global-grid" style="grid-template-columns:repeat(${w},minmax(35px,1fr))">${range(h*w).map(i=>fn(Math.floor(i/w),i%w)).join('')}</div></div>`;
 $('layerMemory').innerHTML=`<div class="module-grid"><div><h3>Backing input X[${n},${c},:,:]</h3>${grid(d.h,d.w,(h,w)=>{const idx=E.xindex(d,n,c,h,w),inside=n===j.n&&c>=j.c&&c<j.c+j.C&&h>=j.i&&h<j.i+j.h&&w>=j.j&&w<j.j+j.w;return `<span class="cell ${inside?'tile-source':''} ${e?.kind==='input'&&e.address===L.inputBase+idx?'fresh':''}" title="X[${n},${c},${h},${w}] · backing @${L.inputBase+idx}">${L.X[idx]}</span>`;})}</div><div><h3>Backing output Y[${n},${k},:,:]</h3>${grid(d.p,d.q,(p,q)=>{const idx=E.yindex(d,n,k,p,q),inside=n===j.n&&k>=j.k&&k<j.k+j.K&&p===j.p&&q>=j.q&&q<j.q+j.Q;return `<span class="cell ${inside?'tile-output':''} ${L.result[idx]!==null?'written':''} ${e?.state==='OUTPUT_WRITE'&&e.address===L.outputBase+idx?'fresh':''}" title="Y[${n},${k},${p},${q}] · backing @${L.outputBase+idx} · ref ${L.expected[idx]}">${fmt(L.result[idx])}</span>`;})}</div></div><p id="layerResult">${s.finished?(T.check(s).ok?`✓ All ${L.result.length} outputs match the reference.`:'Output mismatch.'):`${L.stores}/${L.result.length} final stores committed; partial sums stay in local SRAM.`}</p><p class="small muted">Word bases: input ${L.inputBase} · kernel ${L.kernelBase} · output ${L.outputBase}. Teaching bases include 64-word gaps. Source defaults A4 and 256 words per bank remain available; the tiling presets use smaller builds to expose boundaries.</p>`;
}
function renderModule(){
 renderModuleLocal();
 if(tab==='schedule')$('moduleBody').insertAdjacentHTML('afterbegin',`<p class="buffer-note">Current local job ${sim.layer.job+1}/${sim.layer.d.jobs.length}. This formula counts core cycles only; layer timing also includes scheduling and serialized DMA. continue_sum=${Number(sim.d.continue)}. Select Tiling schedule to inspect the outer loop.</p>`);
}
function showSource(el){
 showLocalSource(el);if(!el)return;
 const a=el.dataset,kind=a.sourceKind??a.kind,id=Number(a.sourceId??a.id),c=Number(a.sourceC??a.c),i=Number(a.sourceI??a.i),j=Number(a.sourceJ??a.j),L=sim.layer,v=L.d.jobs[L.localJob];
 const coord=kind==='x'?[v.n,v.c+c,v.i+i,v.j+j]:[v.k+id,v.c+c,L.d.tapMode?v.r:i,L.d.tapMode?v.s:j];
 const origin=kind==='x'?L.inputOrigin[c][i*sim.d.w+j]:L.kernelOrigin[id][(c*sim.d.r+i)*sim.d.s+j];
 $('sourceReadout').textContent+=origin?` · global resident ${kind==='x'?'X':'W'}[${origin.join(',')}]${origin.some((v,i)=>v!==coord[i])?' · retained from earlier tile':''}`:' · unknown SRAM word; source has not been loaded';
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
 $('jobPage').onchange=()=>{$('jobPage').dataset.manual='true';render();};
 document.addEventListener('click',ev=>{const b=ev.target.closest('[data-job]');if(b){$('jobPage').dataset.manual='false';seek(sim.layer.d.jobs[Number(b.dataset.job)].beginEdge+1);}});
 document.querySelector('.view-tabs').addEventListener('keydown',ev=>{if(ev.key==='ArrowRight'||ev.key==='ArrowLeft'){ev.preventDefault();setView(activeView==='schedule'?'convolution':'schedule');$(activeView==='schedule'?'scheduleTab':'convolutionTab').focus();}});
});
