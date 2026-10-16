/* CL presentation: CRS rows and real stalled clocks, without changing the model. */
let tensorFront=0,matrixPage=0,kernelPageCL=0;
const weightOrigins=new WeakMap(),bankObservations=new WeakMap();
function termCoord(d,t){return {c:Math.floor(t/(d.r*d.s)),r:Math.floor(t/d.s)%d.r,s:t%d.s};}
function activeRows(s){return Math.max(0,Math.min(s.d.a,s.d.c*s.d.r*s.d.s-s.base));}
function clockEdge(s){
 const d=s.d,b=s.banks,previous=weightOrigins.get(s)??E.range(d.a).map(()=>E.range(d.a).map(()=>null)),snapshot={base:s.base,count:s.runCount,issue:b.issue,issueSlot:b.issueSlot,readSlot:b.readSlot,active:b.active,pending:[...b.pending],occupied:[...b.occupied],ready:[...b.ready],returns:E.clone(b.response),responseSlot:b.responseSlot,readData:[...b.readData],requests:E.range(d.a).map(i=>E.address(d,b.issue,s.base+i))};
 T.step(s);const e=s.event;
 bankObservations.set(s,e?.state==='RUN'?snapshot:null);
 if(e?.ctl.load){const base=e.base+(e.ctl.running?d.a:0),rows=Math.min(d.a,d.c*d.r*d.s-e.base),job=s.layer.d.jobs[s.layer.localJob];
  weightOrigins.set(s,E.range(d.a).map(i=>E.range(d.a).map(k=>{if(k>=d.k||i>=rows)return null;if(i)return previous[i-1][k];const t=base+e.loadRow;if(t>=d.c*d.r*d.s)return null;const z=termCoord(d,t);return {...z,k,global:[job.k+k,job.c+z.c,s.layer.d.tapMode?job.r:z.r,s.layer.d.tapMode?job.s:z.s]};})));
 }
 x=s.x;w=s.w;
}
function currentActivation(s,i,k=0){
 if(s.state!=='RUN')return null;const pos=s.runCount-1-i-k;
 if(pos<0||pos>=s.d.m||i>=activeRows(s))return null;
 return {...E.address(s.d,pos,s.base+i),value:s.pe[i][k].a,row:i};
}
function operandQueues(s,limit=4){
 const d=s.d,result={limit,inputs:E.range(d.a).map(()=>[]),weights:E.range(d.a).map(()=>[]),inputRemaining:Array(d.a).fill(0),weightRemaining:0};
 if(s.finished||s.layer.state!=='WAIT_CORE'||s.layer.coreDone)return result;
 const future=E.clone({...s,layer:undefined}),base=s.base;let weightGroup=null;
 for(let after=1;after<=(d.a+limit+3)*(d.a+4);after++){
  const count=future.runCount;E.step(future);const e=future.event;if(e.base!==base)break;
  if(e.advance)for(let i=0;i<Math.min(d.a,d.c*d.r*d.s-base);i++){
   const pos=count-i;if(pos<0||pos>=d.m||result.inputs[i].length>=limit)continue;
   result.inputs[i].push({...E.address(d,pos,base+i),value:future.pe[i][0].a,after,row:i});
  }
  if(e.ctl.load){const group=e.base+(e.ctl.running?d.a:0),key=`${group}:${e.ctl.writeBuffer}`;if(weightGroup===null)weightGroup=key;
   if(key===weightGroup)for(let k=0;k<d.k;k++){if(result.weights[k].length>=limit)continue;const term=group+e.loadRow,z=termCoord(d,term);result.weights[k].push({...z,value:future.pe[0][k].wo,k,term,row:e.loadRow,buffer:e.ctl.writeBuffer,masked:term>=d.c*d.r*d.s,after});}
  }
  if(future.finished)break;
 }
 for(let i=0;i<d.a;i++)result.inputRemaining[i]=result.inputs[i].length?d.m-result.inputs[i][0].pos:0;
 result.weightRemaining=result.weights[0]?.length?result.weights[0][0].row+1:0;return result;
}
function inputQueueHTML(i,forecast){const list=forecast.inputs[i],remaining=forecast.inputRemaining[i],z=termCoord(sim.d,sim.base+i);return `<div class="queue-label">row ${i} · ${i<activeRows(sim)?`(${z.c},${z.r},${z.s})`:'inactive'}</div><div class="input-queue" data-input-queue="${i}">${remaining>list.length?`<span class="queue-more">+${remaining-list.length}</span>`:''}${list.map((v,j)=>queueChip(v,j,'input')).reverse().join('')}${!list.length?`<span class="queue-empty">${i>=activeRows(sim)?'masked':sim.finished?'done':'no pending feed'}</span>`:''}<span class="queue-port">→</span></div><div class="queue-caption">${list.length?`${remaining} left · next in ${list[0].after} clocks`:'Array advances only on a ready vector'}</div>`;}
function linkAttrs(kind,id,c,i,j){
 const L=sim.layer,d=sim.d;let origin;
 if(kind==='x'){const z=E.placement(d,c,i,j,id);origin=L.inputOrigin[z.bank]?.[z.addr];}else origin=L.kernelOrigin[id]?.[(c*d.r+i)*d.s+j];
 if(!origin)return '';return `data-source-kind="${kind}" data-source-id="${origin[0]}" data-source-c="${origin[1]}" data-source-i="${origin[2]}" data-source-j="${origin[3]}"`;
}
function explicitAttrs(kind,origin){return origin?`data-source-kind="${kind}" data-source-id="${origin[0]}" data-source-c="${origin[1]}" data-source-i="${origin[2]}" data-source-j="${origin[3]}"`:'';}
function sourceButton(kind,origin,value,note=''){const color=origin?`hsl(${((kind==='x'?180:20)+origin[0]*137+origin[1]*37)%360} 62% ${76+(origin[1]%2)*5}%)`:'#eef2ee';return `<button class="matrix-value" style="--source-color:${color}" ${explicitAttrs(kind,origin)} title="${origin?`${kind==='x'?'X':'W'}[${origin.join(',')}]`:'Unknown SRAM word'} = ${fmt(value)} ${note}">${fmt(value)}</button>`;}
function renderLocal(animate=false){
 const s=sim,d=s.d,L=s.layer,e=s.event,groups=Math.ceil(d.c*d.r*d.s/d.a),ctl=E.controls(s),forecast=operandQueues(s,4);displayedQueueLimit=4;
 $('batch').innerHTML=`<option value="0">${L.d.jobs[L.localJob].n} (global)</option>`;
 $('runLabel').textContent=`Group ${Math.floor(s.base/d.a)+1}/${groups} · ${s.runCount}/${d.m+2*d.a} advances · ${s.stalls} waits`;
 $('storyTitle').textContent=`${s.state} · ${e?.advance?'array advanced':s.state==='RUN'?'array held':'pipeline clear'} · B${s.active}`;
 $('storyText').textContent=`Rows reduce CRS terms ${s.base}–${Math.min(d.c*d.r*d.s-1,s.base+d.a-1)}. ${s.retries} conflict retry rounds, ${s.stalls} memory wait clocks. Input/skew/PE sums/writeback hold together during a wait; next-group weight shifts continue independently.`;
 let html='<div class="queue-key"><b>Stream preview</b><b class="quiet-symbol">→ ↓</b><span>Next value is nearest the array.</span><small>Preview only; vector slots shown below are actual hardware.</small></div>'+E.range(d.a).map(k=>`<div class="axis weight-source" data-weight-source="${k}">${weightQueueHTML(k,forecast)}</div>`).join('');
 for(let i=0;i<d.a;i++){html+=`<div class="feeder" data-feeder="${i}">${inputQueueHTML(i,forecast)}</div>`;for(let k=0;k<d.a;k++){const p=s.pe[i][k],token=currentActivation(s,i,k),used=i<activeRows(s)&&k<d.k,z=termCoord(d,s.base+i);html+=`<button class="pe ${used?'':'masked'} ${selected[0]===i&&selected[1]===k?'selected':''} ${token?'lit':''}" data-pe="${i},${k}" aria-label="Inspect PE row ${i}, column ${k}" aria-pressed="${selected[0]===i&&selected[1]===k}"><span class="pe-id">PE [${i},${k}] · ${used?`(${z.c},${z.r},${z.s})`:'masked'}</span><span class="equation"><span class="teal">${p.a}</span> × <span class="amber">${p.weightUsed}</span></span><span class="sum">${p.sum}</span><span class="operand-tag">${token?`${token.valid?'X':'pad 0'} · pos${token.pos}`:'no activation'}</span><span class="regs">${p.weights.map((v,b)=>`<span class="reg ${b===s.active?'active':''} ${e?.ctl.load&&b===e.ctl.writeBuffer?'loading':''}" data-buffer="${b}">B${b} ${v}</span>`).join('')}</span></button>`;}}
 html+='<div class="axis">Registered column<br>output → SRAM</div>'+E.range(d.a).map(k=>{const wr=e?.writes.find(v=>v.k===k);return `<div class="array-out">col = ${s.col[k]}<br>${k>=d.k?'disabled':wr?`@${wr.addr} ← ${wr.value}`:'no write'}</div>`;}).join('');
 $('array').style.gridTemplateColumns=`128px repeat(${d.a},minmax(0,1fr))`;$('array').style.maxWidth=(128+d.a*96)+'px';$('array').innerHTML=html;$('array').classList.toggle('hidden-regs',!$('peDetails').checked);
 const [i,k]=selected,p=s.pe[i][k];$('peInspect').innerHTML=`<div class="eyebrow">PE [${i},${k}]</div><p><strong>${ctl.clear?`sum ${p.sum} · pipeline clear`:!s.runCount?`sum ${p.sum} · waiting for first vector`:`${p.sum} = ${(p.sum-p.product)|0} + <span class="teal">${p.a}</span> × <span class="amber">${p.weightUsed}</span>`}</strong></p><span class="muted">${ctl.clear?'Pipeline held clear; no MAC is performed.':'Values hold on stalled clocks. Equation describes the last advancing MAC.'} B0=${p.weights[0]}, B1=${p.weights[1]}.</span>`;
 $('outputs').innerHTML=E.range(d.k).map(k=>`<div class="map sram-output-bank" data-output-bank="${k}"><h3>k=${k}</h3><div class="map-grid" style="--map-cols:${d.q};grid-template-columns:repeat(${d.q},minmax(0,1fr))">${E.range(d.m).map(q=>`<div class="cell ${s.mem[k][q]===null?'':'written'} ${e?.writes.some(v=>v.k===k&&v.addr===q)?'fresh':''}" title="Bank ${k} @${q} · ${s.writes[k][q]}/${groups} groups">${fmt(s.mem[k][q])}${$('reference').checked?`<span class="expected">ref ${fmt(T.partialReference(s,k,q))}</span>`:''}</div>`).join('')}</div></div>`).join('');
 $('progress').style.width=`${100*s.writes.flat().reduce((a,b)=>a+b,0)/(d.k*d.m*groups)}%`;
 renderTensors();renderInputMatrix(forecast);renderModule();fitWindows();renderFlows(animate);
}
function groupCells(c){const s=sim,d=s.d,cells=new Set();for(let t=s.base;t<Math.min(s.base+d.a,d.c*d.r*d.s);t++){if(termCoord(d,t).c!==c)continue;for(let pos=0;pos<d.m;pos++){const z=E.address(d,pos,t);if(z.valid)cells.add(`${z.h},${z.w}`);}}return cells;}
function localStackSVG(kind,id,front,spread){
 const d=sim.d,h=kind==='x'?d.h:d.r,wid=kind==='x'?d.w:d.s,cell=Math.max(22,Math.min(34,240/Math.max(h,wid))),dx=spread?wid*cell+30:28,dy=spread?0:24,sw=wid*cell+(d.c-1)*dx+12,sh=h*cell+(spread?0:(d.c-1)*dy)+36,order=E.range(d.c).reverse().filter(c=>c!==front);order.push(front);
 let out=`<svg class="tensor-stack" width="${sw}" height="${sh}" viewBox="0 0 ${sw} ${sh}" role="img" aria-label="Local ${kind==='x'?'input':'kernel'} ${id}, ${d.c} channel planes">`;
 for(const c of order){const ox=6+c*dx,oy=28+(spread?0:(d.c-1-c)*dy),usedCells=kind==='x'?groupCells(c):null;out+=`<g class="channel-plane" data-channel="${c}"><rect x="${ox-2}" y="${oy-23}" width="74" height="20" rx="4" fill="${tensorColor(kind,id,c)}" stroke="#173c46"/><text x="${ox+5}" y="${oy-9}" font-size="11" font-weight="700">c = ${c}${c===front?' · front':''}</text>`;
  for(let i=0;i<h;i++)for(let j=0;j<wid;j++){
   const term=(c*d.r+i)*d.s+j,used=kind==='x'?usedCells.has(`${i},${j}`):term>=sim.base&&term<sim.base+d.a,
    now=kind==='x'&&E.range(d.a).some(row=>{const t=currentActivation(sim,row);return t?.valid&&t.c===c&&t.h===i&&t.w===j;}),
    loading=kind==='w'&&sim.event?.ctl.load&&term>=(sim.event.base+(sim.event.ctl.running?d.a:0))&&term<(sim.event.base+(sim.event.ctl.running?2*d.a:d.a)),
    value=kind==='x'?sim.x[E.xindex(d,0,c,i,j)]:sim.w[E.windex(d,id,c,i,j)],cx=ox+j*cell,cy=oy+i*cell;
   out+=`<g><title>Local ${kind==='x'?'X':'W'}[${id},${c},${i},${j}] = ${fmt(value)}</title><rect class="tensor-cell ${used?'tap-used':''} ${now?'input-fed':''} ${loading?'tap-loading':''}" data-kind="${kind}" data-id="${id}" data-c="${c}" data-i="${i}" data-j="${j}" ${linkAttrs(kind,id,c,i,j)} x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="${now?'#087e8b':used?'#d9dde0':tensorColor(kind,id,c)}" stroke="${now?'#023e49':loading?'#b77711':'#677a83'}" stroke-width="${now||loading?3:1}" ${loading?'stroke-dasharray="5 2"':''}/><text x="${cx+cell/2}" y="${cy+cell/2+4}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="12" fill="${now?'white':'#203d45'}">${fmt(value)}</text></g>`;
  }out+=`<rect x="${ox}" y="${oy}" width="${wid*cell}" height="${h*cell}" fill="none" stroke="#173c46" stroke-width="${c===front?2:1}"/></g>`;
 }return out+'</svg>';
}
function renderTensors(){
 const s=sim,d=s.d,front=Math.min(tensorFront,d.c-1),spread=$('spreadChannels').checked;
 $('tensorPass').textContent=`Current CRS group: terms ${s.base}–${Math.min(s.base+d.a-1,d.c*d.r*d.s-1)}. Grey cells belong to the group; teal cells are currently held in PE[i,0].`;
 $('channelSelect').innerHTML=E.range(d.c).map(c=>`<button data-front="${c}" aria-pressed="${c===front}" style="--channel:${tensorColor('x',0,c)}">c = ${c}</button>`).join('');
 $('inputStacks').innerHTML=`<div class="stack-card"><h4>Local image 0 · ${d.c} channels</h4><div class="stack-scroll">${localStackSVG('x',0,front,spread)}</div></div>`;
 $('kernelStacks').innerHTML=E.range(d.k).map(k=>`<div class="stack-card"><h4>Local filter ${k} · ${d.c} channels</h4><div class="stack-scroll">${localStackSVG('w',k,front,spread)}</div></div>`).join('');
 $('feedSummary').innerHTML=E.range(activeRows(s)).map(i=>{const t=currentActivation(s,i);return `<span class="feed-chip">row ${i}: ${t?`${t.valid?'X':'pad'} ${t.value} · pos${t.pos}`:'—'}</span>`;}).join('');
}
function renderInputMatrix(forecast=operandQueues(sim,4)){
 showSource(null);const s=sim,d=s.d,L=s.layer,physical=$('inputView').value==='physical',size=12,total=physical?2**d.ia:d.m;
 matrixPage=Math.min(matrixPage,Math.max(0,Math.ceil(total/size)-1));const start=matrixPage*size,cols=E.range(Math.min(size,total-start)).map(i=>start+i),feeds=E.range(d.a).map(i=>({now:currentActivation(s,i),next:forecast.inputs[i][0]}));
 $('matrixPager').innerHTML=`<span>${physical?'Stored addresses':'Output positions'} ${start}–${start+cols.length-1}/${total}</span><div><button data-input-page="-1" ${matrixPage?'':'disabled'}>←</button><button data-input-page="1" ${start+size<total?'':'disabled'}>→</button></div>`;
 $('bankFeeds').innerHTML=feeds.slice(0,activeRows(s)).map((f,i)=>`<div class="bank-feed-summary"><b>row ${i}</b><span>Now ${f.now?`${f.now.value} · ${f.now.valid?`b${f.now.bank}@${f.now.addr}`:'pad'}`:'—'}</span><span>Next ${f.next?`${f.next.value} · +${f.next.after} clk`:'—'}</span></div>`).join('');
 const mark=(now,next)=>`${now?'feed-current':''} ${next?'feed-next':''}`;
 if(physical)$('inputMatrix').innerHTML=E.range(d.a).map(b=>`<section class="sram-bank input-bank" data-input-bank="${b}"><h4>bank ${b}</h4><div class="bank-matrix-scroll"><table class="lowered-matrix"><thead><tr>${cols.map(a=>`<th>@${a}</th>`).join('')}</tr></thead><tbody><tr>${cols.map(a=>{const now=feeds.some(f=>f.now?.valid&&f.now.bank===b&&f.now.addr===a),next=feeds.some(f=>f.next?.valid&&f.next.bank===b&&f.next.addr===a);return `<td data-bank="${b}" data-address="${a}" class="${mark(now,next)}">${sourceButton('x',L.inputOrigin[b][a],L.input[b][a],`· bank ${b} @${a}`)}</td>`;}).join('')}</tr></tbody></table></div></section>`).join('');
 else $('inputMatrix').innerHTML=`<section class="sram-bank"><div class="bank-matrix-scroll"><table class="lowered-matrix"><thead><tr><th>row · (c,r,s)</th>${cols.map(pos=>`<th>q${pos}</th>`).join('')}</tr></thead><tbody>${E.range(d.a).map(i=>{const z=termCoord(d,s.base+i);return `<tr><th>${i} · (${z.c},${z.r},${z.s})</th>${cols.map(pos=>{const t=E.address(d,pos,s.base+i),f=feeds[i],now=f.now?.pos===pos,next=f.next?.pos===pos,value=t.valid?L.input[t.bank][t.addr]:0;return `<td data-row="${i}" data-pos="${pos}" class="${mark(now,next)}" title="${t.valid?`bank ${t.bank} @${t.addr}`:'Generated zero; no SRAM source'}">${t.valid?sourceButton('x',L.inputOrigin[t.bank][t.addr],value,`· bank ${t.bank} @${t.addr}`):'<span class="matrix-padding">0</span>'}</td>`;}).join('')}</tr>`;}).join('')}</tbody></table></div></section>`;
 renderKernelBanks();renderBankArbitration();
}
function renderKernelBanks(){const d=sim.d,L=sim.layer,total=d.c*d.r*d.s,size=12;kernelPageCL=Math.min(kernelPageCL,Math.max(0,Math.ceil(total/size)-1));const start=kernelPageCL*size,cols=E.range(Math.min(size,total-start)).map(i=>start+i);
 $('kernelPager').innerHTML=`<span>CRS terms ${start}–${start+cols.length-1}/${total}</span><div><button data-kernel-page="-1" ${kernelPageCL?'':'disabled'}>←</button><button data-kernel-page="1" ${start+size<total?'':'disabled'}>→</button></div>`;
 $('kernelBanks').innerHTML=E.range(d.k).map(k=>`<section class="sram-bank kernel-bank" data-kernel-bank="${k}"><h4>k=${k}</h4><div class="bank-matrix-scroll"><table class="lowered-matrix"><thead><tr>${cols.map(t=>{const z=termCoord(d,t);return `<th>@${t}<br>${z.c},${z.r},${z.s}</th>`;}).join('')}</tr></thead><tbody><tr>${cols.map(t=>`<td data-kernel-address="${t}" class="${t>=sim.base&&t<sim.base+d.a?'current-kernel-tap':''}">${sourceButton('w',L.kernelOrigin[k][t],L.kernel[k][t])}</td>`).join('')}</tr></tbody></table></div></section>`).join('');
}
function renderBankArbitration(){
 const s=sim,d=s.d,b=s.banks,o=bankObservations.get(s),e=s.event,live=e?.state==='RUN'&&o;
 const req=live?o.requests:[],grants=e?.grants??[];
 let lanes=E.range(d.a).map(i=>{const z=req[i],pending=live&&(o.active?o.pending[i]:z.valid),grant=pending&&grants.some(g=>g.bank===z.bank&&g.addr===z.addr),retry=pending&&!grant&&e.retry;
  return `<div class="request-lane ${grant?'granted':''} ${retry?'retrying':''}" data-request-row="${i}" data-granted="${!!grant}" data-retry="${!!retry}"><b>row ${i}</b><span>${!z?'idle':!z.valid?'generated zero':`${z.c},${z.r},${z.s} → bank ${z.bank} @${z.addr}`}</span><strong>${grant?'read granted':retry?'retry':pending?'slot wait':z&&!z.valid?'0':'—'}</strong></div>`;
 }).join('');
 $('bankArbitration').innerHTML=`<div class="arb-head"><b>${s.state==='RUN'?(e?.advance?'Advance = 1 · array moved':'Advance = 0 · array holds'):'Array idle'}</b><span>${s.stalls} wait clocks · ${s.retries} retry rounds</span></div><div class="arb-columns"><div><h4>Last-edge row requests · position ${live?o.issue:'—'}</h4><div class="request-lanes">${lanes}</div></div><div><h4>Independent synchronous banks</h4><div class="bank-port-list">${E.range(d.a).map(bank=>{const g=grants.find(g=>g.bank===bank);return `<div class="bank-port ${g?'granted':''}" data-bank-port="${bank}"><b>bank ${bank}</b><span>${g?`read @${g.addr} → ${g.value}`:'no read'}</span></div>`;}).join('')}</div><p class="small">Lowest row wins a bank; identical addresses share a read. Different words retry.</p></div><div><h4>Two vector slots · state after edge</h4>${E.range(2).map(slot=>`<div class="vector-slot ${b.ready[slot]?'ready':''}" data-slot="${slot}" data-ready="${b.ready[slot]}"><b>S${slot} · ${b.ready[slot]?'ready':b.occupied[slot]?'filling':'free'}</b><span>${slot===b.issueSlot?'producer ':''}${slot===b.readSlot?'consumer':''}</span><div>${b.values[slot].map((v,i)=>`<span class="slot-value" title="row ${i}">${v.value}</span>`).join('')}</div></div>`).join('')}<p class="small">${live&&o.returns.length?`Returned from previous reads: ${o.returns.map(t=>`row ${t.row} ← ${o.readData[t.bank]}`).join(' · ')}`:'No read returns on the last edge.'}</p><p class="small">${e?.consume?`Consumed S${o.readSlot} → row-skew registers.`:'No vector consumed.'}</p></div></div>`;
}
function renderModule(){
 const s=sim,d=s.d,e=s.event,b=s.banks;
 if(tab==='input')$('moduleBody').innerHTML=`<div class="module-grid"><div><h3>One request per CRS row</h3><div class="formula">t = group_base + i<br>c = floor(t/(R·S)); r = floor(t/S)%R; s = t%S<br>h = p·stride_i + r·dilation_i − pad_i<br>w = q·stride_j + s·dilation_j − pad_j<br>slot = c·R·S + (h%R)·S + w%S<br>bank = slot%A<br>@ = (floor(slot/A)·ceil(H/R)·ceil(W/S)<br> + floor(h/R)·ceil(W/S) + floor(w/S))·N+n</div><p>Padding is masked before arbitration. Banks are selected by the swizzled slot, not by channel alone. No lowered matrix is stored.</p></div><div><h3>Real vector buffering</h3><p>Producer S${b.issueSlot}; consumer S${b.readSlot}; issue position ${b.issue}. A vector is consumed only when complete. Stalls freeze the activation skew, PEs, column registers and output write pointers together.</p>${rows(['Slot','Occupied','Ready'],E.range(2).map(i=>[i,b.occupied[i],b.ready[i]]))}<h3>Last enabled bank reads</h3>${rows(['Bank','Address','Value'],e?.grants?.map(g=>[g.bank,g.addr,g.value])??[])}</div></div>`;
 else if(tab==='weights')$('moduleBody').innerHTML=`<div class="module-grid"><div><h3>Compute B${s.active}; prepare B${1-s.active}</h3><div class="formula">Kernel @ = group_base + read_row<br>Initial: PRIME then A descending shifts<br>Loader: ${s.loadPhase}; next physical row ${s.loadRow}</div><p>Every physical row takes a shift. The inactive weight registers can load while the array is stalled. Buffer switching waits for the current group's final drain write.</p></div><div>${rows(['PE','B0','B1'],s.pe.flatMap((row,i)=>row.map((p,k)=>[`[${i},${k}]`,...p.weights])))}</div></div>`;
 else if(tab==='output')$('moduleBody').innerHTML=`<div class="module-grid"><div><h3>Resident group/job accumulation</h3><div class="formula">Bank = k; @ = (p·Q+q)·N+n<br>First contribution overwrites<br>Later groups / continue_sum add old SRAM<br>ACC_WIDTH = 32; signed wraparound</div><p>SRAM writeback advances only with the array. Idle-only synchronous output readback precedes each final DMA store.</p></div><div>${rows(['Column','Address','Old','Array result','Stored'],e?.writes?.map(v=>[v.k,v.addr,fmt(v.before),v.result,v.value])??[])}</div></div>`;
 else $('moduleBody').innerHTML=`<h3>CRS reduction groups</h3><div class="formula">G = ceil(C·R·S/A) = ${Math.ceil(d.c*d.r*d.s/d.a)}<br>Advances/group = N·P·Q + 2A = ${d.m+2*d.a}<br>Core clocks = 1+A + G·(N·P·Q+2A) + (G−1) + measured waits<br>Current waits: ${s.stalls}; job latency: ${d.total}</div><p>Group boundaries follow actual bank service and synchronous return timing. Each button replays to that group's RUN entry.</p><div class="taps">${E.range(Math.ceil(d.c*d.r*d.s/d.a)).map(g=>`<button data-group="${g}" class="${g*d.a===s.base?'current':''}">Group ${g+1} · t${g*d.a}–${Math.min((g+1)*d.a-1,d.c*d.r*d.s-1)}</button>`).join('')}</div>`;
}
function seekGroup(group){if(!valid)return;const job=sim.layer.localJob,target=group*sim.d.a;seek(sim.layer.d.jobs[job].startEdge);while(!sim.finished&&sim.layer.localJob===job&&(sim.base<target||sim.state!=='RUN'))clockEdge(sim);render();}
function sourceElement(target){return target.closest('[data-source-kind],.tensor-cell');}
function showSource(el){
 document.querySelectorAll('.source-linked').forEach(v=>v.classList.remove('source-linked'));$('sourceMini').replaceChildren();
 if(!el){$('sourceReadout').textContent='Hover: global source · click: tensor';return;}
 const a=el.dataset;if(!a.sourceKind){$('sourceReadout').textContent='Unknown SRAM word; no source has been loaded.';return;}
 const kind=a.sourceKind,id=Number(a.sourceId),c=Number(a.sourceC),i=Number(a.sourceI),j=Number(a.sourceJ),d=sim.layer.d,job=d.jobs[sim.layer.localJob],value=kind==='x'?sim.layer.X[E.xindex(d,id,c,i,j)]:sim.layer.W[E.windex(d,id,c,i,j)],localC=c-job.c;
 if(localC>=0&&localC<sim.d.c&&tensorFront!==localC){tensorFront=localC;renderTensors();}
 document.querySelectorAll('[data-source-kind]').forEach(node=>{const b=node.dataset;if(b.sourceKind===kind&&Number(b.sourceId)===id&&Number(b.sourceC)===c&&Number(b.sourceI)===i&&Number(b.sourceJ)===j)node.classList.add('source-linked');});
 $('sourceReadout').textContent=`Global ${kind==='x'?'X':'W'}[${id},${c},${i},${j}] = ${value}`;
 const h=kind==='x'?d.h:d.r,w=kind==='x'?d.w:d.s,cell=14;$('sourceMini').innerHTML=`<svg viewBox="0 0 ${w*cell} ${h*cell}" role="img" aria-label="Global source plane"><title>Global ${kind==='x'?'X':'W'}[${id},${c},:,:]</title>${E.range(h*w).map(p=>`<rect x="${p%w*cell+1}" y="${Math.floor(p/w)*cell+1}" width="12" height="12" fill="#c9e3df" stroke="${Math.floor(p/w)===i&&p%w===j?'#173c46':'white'}" stroke-width="${Math.floor(p/w)===i&&p%w===j?3:1}"/>`).join('')}</svg>`;
}
function renderFlows(animate){
 if(activeView!=='convolution'||!$('array').children.length||!$('array').getClientRects().length)return;
 const layer=$('flowLayer'),grid=$('array'),s=sim,d=s.d,e=s.event,base=grid.getBoundingClientRect(),scale=base.width/Math.max(1,grid.offsetWidth),get=(i,k)=>grid.querySelector(`[data-pe="${i},${k}"]`),center=el=>{const b=el.getBoundingClientRect();return {x:(b.left-base.left+b.width/2)/scale,y:(b.top-base.top+b.height/2)/scale};},target=(i,k)=>{const pe=get(i,k),reg=pe.querySelectorAll('.reg')[e?.ctl.writeBuffer??s.active];return reg?.getClientRects().length?reg:pe;},lines=[];
 layer.replaceChildren();const cb=grid.closest('.array-canvas').getBoundingClientRect();layer.style.left=((base.left-cb.left)/scale)+'px';layer.style.top=((base.top-cb.top)/scale)+'px';layer.style.width=grid.scrollWidth+'px';layer.style.height=grid.scrollHeight+'px';
 for(let i=0;i<activeRows(s);i++)for(let k=0;k<d.k;k++){const to=center(get(i,k)),from=center(k?get(i,k-1):grid.querySelector(`[data-feeder="${i}"] .queue-port`)),wt=center(target(i,k)),top=center(i?target(i-1,k):grid.querySelector(`[data-weight-source="${k}"] .queue-port`));lines.push(`<path class="activation-path" d="M${from.x},${to.y} H${to.x}"/><path class="weight-path" d="M${top.x},${top.y} L${wt.x},${wt.y}"/>`);}
 layer.innerHTML=`<svg class="flow-wires" width="${grid.scrollWidth}" height="${grid.scrollHeight}">${lines.join('')}</svg>`;
 if(!animate||!e||!$('motion').checked||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const duration=Math.max(160,Math.min(850,Number($('speed').value)*.72)),move=(type,value,from,to,label,attrs)=>{const chip=document.createElement('div');chip.className=`moving-token ${type}`;chip.innerHTML=`<b>${value}</b><small>${label}</small>`;Object.assign(chip.dataset,attrs);layer.append(chip);chip.animate([{transform:`translate(${from.x}px,${from.y}px) translate(-50%,-50%)`,opacity:1},{transform:`translate(${to.x}px,${to.y}px) translate(-50%,-50%)`,opacity:1,offset:.85},{transform:`translate(${to.x}px,${to.y}px) translate(-50%,-50%)`,opacity:0}],{duration,fill:'forwards',easing:'ease-in-out'});};
 if(e.advance)for(let i=0;i<d.a;i++)for(let k=0;k<d.k;k++){const token=currentActivation(s,i,k);if(!token)continue;move('activation-token',s.pe[i][k].a,center(k?get(i,k-1):grid.querySelector(`[data-feeder="${i}"] .queue-port`)),center(get(i,k)),`${token.valid?'X':'pad'} · pos${token.pos}`,{row:i,k,pos:token.pos});}
 if(e.ctl.load)for(let i=0;i<activeRows(s);i++)for(let k=0;k<d.k;k++){const origin=weightOrigins.get(s)?.[i][k];move('weight-token',s.pe[i][k].wo,center(i?target(i-1,k):grid.querySelector(`[data-weight-source="${k}"] .queue-port`)),center(target(i,k)),origin?`W[${origin.global.join(',')}]`:'masked 0',{row:i,k,buffer:e.ctl.writeBuffer,sourceC:origin?.c??-1});}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('inputView').onchange=()=>{matrixPage=0;render();};
 $('matrixPager').addEventListener('click',ev=>{const b=ev.target.closest('[data-input-page]');if(b){matrixPage+=Number(b.dataset.inputPage);renderInputMatrix();}});
 $('kernelPager').addEventListener('click',ev=>{const b=ev.target.closest('[data-kernel-page]');if(b){kernelPageCL+=Number(b.dataset.kernelPage);renderKernelBanks();}});
 document.addEventListener('pointerover',ev=>{const el=sourceElement(ev.target),prior=ev.relatedTarget instanceof Element?sourceElement(ev.relatedTarget):null;if(el!==prior)showSource(el);});
 document.addEventListener('focusin',ev=>{const el=sourceElement(ev.target);if(el)showSource(el);});
 document.addEventListener('click',ev=>{const el=ev.target.closest('[data-source-kind]');if(!el)return;showSource(el);const panel=document.querySelector('[data-panel="tensors"]');if(panel.hidden)document.querySelector('[data-window="tensors"]').click();panel.scrollIntoView({block:'start',behavior:'instant'});});
});
