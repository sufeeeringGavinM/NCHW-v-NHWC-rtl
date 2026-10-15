/* Channel-last edge model: CRS rows, synchronous banks, two vector slots and stalled array. */
(function(root){'use strict';
const range=n=>Array.from({length:n},(_,i)=>i),clone=x=>JSON.parse(JSON.stringify(x));
const defaults={a:4,n:1,c:2,k:2,h:3,w:3,r:2,s:2,pad_i:0,pad_j:0,stride_i:1,stride_j:1,dilation_i:1,dilation_j:1,ia:8,oa:8,ka:8};
const xindex=(d,n,c,h,w)=>((n*d.c+c)*d.h+h)*d.w+w,windex=(d,k,c,r,s)=>((k*d.c+c)*d.r+r)*d.s+s,yindex=(d,n,k,p,q)=>((n*d.k+k)*d.p+p)*d.q+q;
function reference(d,x,w){const y=Array(d.n*d.k*d.p*d.q).fill(0);for(let n=0;n<d.n;n++)for(let k=0;k<d.k;k++)for(let p=0;p<d.p;p++)for(let q=0;q<d.q;q++){let sum=0;for(let c=0;c<d.c;c++)for(let r=0;r<d.r;r++)for(let s=0;s<d.s;s++){const h=p*d.stride_i+r*d.dilation_i-d.pad_i,v=q*d.stride_j+s*d.dilation_j-d.pad_j;if(h>=0&&h<d.h&&v>=0&&v<d.w)sum=(sum+x[xindex(d,n,c,h,v)]*w[windex(d,k,c,r,s)])|0;}y[yindex(d,n,k,p,q)]=sum;}return y;}
function placement(d,c,h,w,n=0){const slot=c*d.r*d.s+(h%d.r)*d.s+w%d.s,tr=Math.ceil(d.h/d.r),tc=Math.ceil(d.w/d.s);return {bank:slot%d.a,addr:(Math.floor(slot/d.a)*tr*tc+Math.floor(h/d.r)*tc+Math.floor(w/d.s))*d.n+n};}
function address(d,pos,term){const n=pos%d.n,p=Math.floor(pos/d.n/d.q),q=Math.floor(pos/d.n)%d.q,c=Math.floor(term/(d.r*d.s)),r=Math.floor(term/d.s)%d.r,s=term%d.s,h=p*d.stride_i+r*d.dilation_i-d.pad_i,w=q*d.stride_j+s*d.dilation_j-d.pad_j,valid=term<d.c*d.r*d.s&&h>=0&&h<d.h&&w>=0&&w<d.w;return {pos,n,p,q,c,r,s,h,w,term,valid,...(valid?placement(d,c,h,w,n):{bank:0,addr:0})};}
function emptyBanks(d){return {issue:0,issueSlot:0,readSlot:0,active:false,occupied:[false,false],ready:[false,false],pending:range(d.a).map(()=>false),values:range(2).map(()=>range(d.a).map(()=>({value:0,token:null}))),response:[],responseSlot:0,responseFinal:false,readData:Array(d.a).fill(0)};}
function create(d,x,w){return {d,x:[...x],w:[...w],expected:reference(d,x,w),state:'IDLE',started:false,finished:false,edge:0,cycles:0,base:0,r:0,s:0,active:0,runCount:0,loadRow:d.a-1,loadPhase:'PREFETCH',kernelData:Array(d.a).fill(0),pe:range(d.a).map(()=>range(d.a).map(()=>({weights:[0,0],a:0,sum:0,wo:0,token:null,product:0,above:0,weightUsed:0}))),col:Array(d.a).fill(0),mem:range(d.a).map(()=>Array(2**d.oa).fill(null)),writes:range(d.k).map(()=>Array(d.m).fill(0)),oldOut:Array(d.a).fill(0),ptr:Array(d.a).fill(0),skew:range(d.a).map(i=>range(i).map(()=>({value:0,token:null}))),banks:emptyBanks(d),stalls:0,retries:0,reads:0,event:null};}
function controls(s){const d=s.d,running=s.state==='RUN',hasNext=s.base+d.a<d.c*d.r*d.s,preload=running&&hasNext,load=s.state==='LOAD_WEIGHTS'||preload&&s.loadPhase==='SHIFT_WEIGHTS',readRow=load&&s.loadRow? s.loadRow-1:s.loadRow;return {running,clear:!running,hasNext,preload,load,readRow,writeBuffer:running?1-s.active:s.active,kernelRead:s.state==='PRIME'||s.state==='LOAD_WEIGHTS'||preload&&s.loadPhase!=='WEIGHTS_READY',term:(running?s.base+d.a:s.base)+readRow};}
function step(s){if(s.finished)return s;const d=s.d,ctl=controls(s),old=s.pe,phase=s.state,b=s.banks,first=phase==='IDLE'&&!s.started,advance=ctl.running&&s.runCount<d.m+2*d.a&&(s.runCount>=d.m||b.ready[b.readSlot]),consume=advance&&s.runCount<d.m,activeRows=Math.min(d.a,d.c*d.r*d.s-s.base);
 const vectors=range(d.a).map(i=>consume?b.values[b.readSlot][i]:{value:0,token:null}),activations=range(d.a).map(i=>i?s.skew[i][i-1]:vectors[i]);
 const ev={state:phase,base:s.base,advance,consume,activations:clone(activations),writes:[],grants:[],retry:false,ctl,loadRow:s.loadRow,kernelAddr:ctl.term};
 // SRAM read-modify-write captures the old memory before this edge's write.
 const nextOld=s.oldOut.slice();for(let k=0;k<d.a;k++){const valid=advance&&k<d.k&&s.runCount>=k+d.a+1&&s.runCount-(k+d.a+1)<d.m,ptr=s.ptr[k],readPtr=ctl.clear?0:valid?ptr+1:ptr;nextOld[k]=s.mem[k]?.[readPtr]??0;if(valid){const before=s.mem[k][ptr],value=(s.col[k]+((s.base||d.continue)?s.oldOut[k]:0))|0;s.mem[k][ptr]=value;s.writes[k][ptr]++;ev.writes.push({k,addr:ptr,before,result:s.col[k],value});}s.ptr[k]=ctl.clear?0:valid?ptr+1:ptr;}s.oldOut=nextOld;
 s.pe=old.map((row,i)=>row.map((pe,k)=>{const a=k?old[i][k-1].a:activations[i].value,above=i?old[i-1][k].sum:0,wi=i?(i<activeRows&&k<d.k?old[i-1][k].wo:0):(k<d.k?s.kernelData[k]:0),weights=pe.weights.slice();if(ctl.load)weights[ctl.writeBuffer]=wi;return {...pe,weights,a:ctl.clear?0:advance?a:pe.a,sum:ctl.clear?0:advance?(above+a*pe.weights[s.active])|0:pe.sum,wo:ctl.load?wi:pe.wo,token:ctl.clear?null:advance?(k?old[i][k-1].token:activations[i].token):pe.token,weightUsed:pe.weights[s.active],product:advance?a*pe.weights[s.active]:pe.product,above};}));
 if(advance)s.col=old[d.a-1].map(pe=>pe.sum);
 if(ctl.clear)s.skew=range(d.a).map(i=>range(i).map(()=>({value:0,token:null})));else if(advance)s.skew=range(d.a).map(i=>i?[clone(vectors[i]),...s.skew[i].slice(0,i-1)]:[]);
 if(ctl.kernelRead)s.kernelData=range(d.a).map(k=>k<d.k&&ctl.term<d.c*d.r*d.s?(s.w[k*d.c*d.r*d.s+ctl.term]??0):0);
 if(ctl.clear)s.banks=emptyBanks(d);else{
  const next=clone(b),available=!b.occupied[b.issueSlot]||consume&&b.readSlot===b.issueSlot,enable=b.issue<d.m&&(b.active||available),req=range(d.a).map(i=>address(d,b.issue,s.base+i)),pending=range(d.a).map(i=>b.active?b.pending[i]:req[i].valid),readMap=new Map(),grant=Array(d.a).fill(false);
  if(enable)for(let i=0;i<d.a;i++)if(pending[i]){const z=req[i];if(!readMap.has(z.bank)){readMap.set(z.bank,z.addr);grant[i]=true;}else if(readMap.get(z.bank)===z.addr)grant[i]=true;}
  if(consume){next.ready[b.readSlot]=false;next.occupied[b.readSlot]=false;next.readSlot=1-b.readSlot;}
  for(const z of b.response)next.values[b.responseSlot][z.row]={value:b.readData[z.bank],token:z};
  if(b.responseFinal)next.ready[b.responseSlot]=true;
  next.response=range(d.a).filter(i=>grant[i]).map(i=>({...req[i],row:i}));next.responseSlot=b.issueSlot;next.responseFinal=false;
  if(enable){if(!b.active){next.occupied[b.issueSlot]=true;next.ready[b.issueSlot]=false;next.values[b.issueSlot]=range(d.a).map(()=>({value:0,token:null}));}next.pending=pending.map((v,i)=>v&&!grant[i]);if(!next.pending.some(Boolean)){next.active=false;next.issueSlot=1-b.issueSlot;next.issue++;if(!grant.some(Boolean))next.ready[b.issueSlot]=true;else next.responseFinal=true;}else next.active=true;}
  for(const [bank,addr]of readMap){const z=req.find((z,i)=>grant[i]&&z.bank===bank);next.readData[bank]=s.layer?s.layer.input[bank][addr]:(s.x[xindex(d,z.n,z.c,z.h,z.w)]??0);ev.grants.push({bank,addr,value:next.readData[bank]});}
  ev.retry=enable&&next.pending.some(Boolean);s.retries+=Number(ev.retry);s.reads+=readMap.size;if(!advance&&s.runCount<d.m)s.stalls++;s.banks=next;
 }
 const passDone=advance&&s.runCount===d.m+2*d.a-1,restart=first||passDone&&ctl.hasNext&&s.loadPhase==='WEIGHTS_READY';
 if(restart){s.loadRow=d.a-1;s.loadPhase='PREFETCH';}else if(phase==='LOAD_WEIGHTS'){if(!s.loadRow){s.loadRow=d.a-1;s.loadPhase='PREFETCH';}else s.loadRow--;}else if(ctl.preload){if(s.loadPhase==='PREFETCH')s.loadPhase='SHIFT_WEIGHTS';else if(s.loadPhase==='SHIFT_WEIGHTS'){if(!s.loadRow)s.loadPhase='WEIGHTS_READY';else s.loadRow--;}}
 if(ctl.clear)s.runCount=0;else if(advance)s.runCount++;
 if(first){s.state='PRIME';s.started=true;}else if(phase==='PRIME')s.state='LOAD_WEIGHTS';else if(phase==='LOAD_WEIGHTS'&&ev.loadRow===0)s.state='RUN';else if(phase==='SWITCH_GROUP')s.state='RUN';else if(passDone){if(!ctl.hasNext){s.state='IDLE';s.finished=true;}else if(restart){s.base+=d.a;s.active=1-s.active;s.state='SWITCH_GROUP';}}
 if(!first)s.cycles++;s.edge++;s.event=ev;return s;
}
function jobCycles(d){const s=create(d,Array(d.n*d.c*d.h*d.w).fill(0),Array(d.k*d.c*d.r*d.s).fill(0));while(!s.finished&&s.edge<=30000)step(s);if(!s.finished)throw Error('Core exceeds teaching clock limit.');return s.cycles;}
root.CLEngine={defaults,create,step,controls,address,placement,reference,clone,range,xindex,windex,yindex,jobCycles};
})(globalThis);
