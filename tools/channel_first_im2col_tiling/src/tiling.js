/* conv_accelerator's serialized edge FSM. The retained core models each job. */
(function(root){
'use strict';
const E=CFEngine, min=Math.min;
function config(raw){
 const d={...E.defaults,...raw};
 for(const key of Object.keys(E.defaults)){
  const lo=key.startsWith('pad')?0:1,hi=['ia','oa','ka'].includes(key)?12:key==='a'?10:32;
  if(!Number.isInteger(d[key])||d[key]<lo||d[key]>hi)throw Error(`${key}: enter an integer ${lo}–${hi}.`);
 }
 d.p=Math.floor((d.h+2*d.pad_i-d.dilation_i*(d.r-1)-1)/d.stride_i)+1;
 d.q=Math.floor((d.w+2*d.pad_j-d.dilation_j*(d.s-1)-1)/d.stride_j)+1;
 if(d.p<1||d.q<1)throw Error('The dilated kernel must fit the padded input.');
 if(d.n*d.c*d.h*d.w>16384||d.k*d.c*d.r*d.s>16384||d.n*d.k*d.p*d.q>16384)throw Error('Use at most 16,384 elements per teaching tensor.');
 d.ei=d.dilation_i*(d.r-1)+1;d.ej=d.dilation_j*(d.s-1)+1;
 d.tapMode=d.r*d.s>2**d.ka||d.ei*d.ej>2**d.ia;
 d.ct=min(d.a,Math.floor(2**d.ka/(d.tapMode?1:d.r*d.s)));
 d.qt=min(2**d.oa,1+Math.floor(d.tapMode?(2**d.ia-1)/d.stride_j:(Math.floor(2**d.ia/d.ei)-d.ej)/d.stride_j));
 d.m=d.n*d.p*d.q;d.taps=d.r*d.s;
 // Exactly the RTL loop order. This list is also the teaching timeline.
 d.jobs=[];let reads=0,stores=0,busy=0,tiles=0;
 for(let n=0;n<d.n;n++)for(let k=0;k<d.k;k+=d.a)for(let p=0;p<d.p;p++)for(let q=0;q<d.q;q+=d.qt){
  const K=min(d.a,d.k-k),Q=min(d.qt,d.q-q);tiles++;stores+=K*Q;
  for(let c=0;c<d.c;c+=d.ct)for(let t=0;t<(d.tapMode?d.taps:1);t++){
   const C=min(d.ct,d.c-c),r=d.tapMode?Math.floor(t/d.s):0,s=d.tapMode?t%d.s:0;
   const ri=p*d.stride_i-d.pad_i+(d.tapMode?r*d.dilation_i:0),rj=q*d.stride_j-d.pad_j+(d.tapMode?s*d.dilation_j:0);
   const i=Math.max(0,ri),j=Math.max(0,rj),h=Math.max(0,min(d.h,ri+(d.tapMode?1:d.ei))-i),w=Math.max(0,min(d.w,rj+(Q-1)*d.stride_j+(d.tapMode?1:d.ej))-j);
   const R=d.tapMode?1:d.r,S=d.tapMode?1:d.s,T=R*S,cycles=1+d.a+T*(Q+2*d.a)+T-1;
   const job={n,k,p,q,c,r,s,K,Q,C,R,S,i,j,h,w,pad_i:i-ri,pad_j:j-rj,continue:!!(c||r||s),tile:tiles-1,cycles};
   d.jobs.push(job);reads+=C*h*w+K*C*R*S;busy+=cycles;
   if(d.jobs.length>30000)throw Error('Use a smaller teaching layer.');
  }
 }
 let cursor=2,previousTile=-1;
 for(let z=0;z<d.jobs.length;z++){
  const j=d.jobs[z];if(j.tile!==previousTile){cursor++;previousTile=j.tile;}
  j.beginEdge=cursor;cursor+=1+2*(j.C*j.h*j.w+j.K*j.C*j.R*j.S)+1;j.startEdge=cursor;
  cursor+=j.cycles+1;j.endEdge=cursor;
  if(z===d.jobs.length-1||d.jobs[z+1].tile!==j.tile)cursor+=2*j.K*j.Q+1;
 }
 d.total=1+2*tiles+3*d.jobs.length+busy+2*(reads+stores);d.reads=reads;d.stores=stores;d.tiles=tiles;d.coreCycles=busy;
 if(d.total>30000)throw Error(`Teaching limit: ${d.total.toLocaleString()} clocks exceeds 30,000.`);
 return d;
}
function localConfig(d,j){const m=j.Q,taps=j.R*j.S;return {...d,_local:true,n:1,c:j.C,k:j.K,h:j.h,w:j.w,r:j.R,s:j.S,p:1,q:j.Q,pad_i:j.pad_i,pad_j:j.pad_j,m,taps,run:m+2*d.a,total:j.cycles,continue:j.continue,jobs:undefined};}
function prepare(s){
 const L=s.layer,d=L.d,j=d.jobs[L.job],ld=localConfig(d,j),oldPE=s.pe;
 const xx=E.range(j.C*j.h*j.w).map(i=>L.input[Math.floor(i/(j.h*j.w))][i%(j.h*j.w)]);
 const ww=E.range(j.K*j.C*j.R*j.S).map(i=>L.kernel[Math.floor(i/(j.C*j.R*j.S))][i%(j.C*j.R*j.S)]);
 const next=E.create(ld,xx.map(v=>v??0),ww.map(v=>v??0));
 Object.assign(s,next);if(oldPE)s.pe=oldPE.map(row=>row.map(pe=>({...pe,a:0,sum:0,token:null,product:0,above:0,weightUsed:0})));
 s.x=xx;s.w=ww;s.mem=L.output;s.layer=L;s.finished=false;L.coreDone=false;L.localJob=L.job;
 L.bank=0;L.word=0;
}
function create(raw,x,w){
 const d=config(raw);
 for(const [name,arr,len]of [['Input',x,d.n*d.c*d.h*d.w],['Kernel',w,d.k*d.c*d.r*d.s]])
  if(arr.length!==len||arr.some(v=>!Number.isInteger(v)||v< -128||v>127))throw Error(`${name}: provide ${len} signed 8-bit integers (−128…127).`);
 const banks=bits=>E.range(d.a).map(()=>Array(2**bits).fill(null));
 const L={d,X:[...x],W:[...w],expected:E.reference(d,x,w),result:Array(d.n*d.k*d.p*d.q).fill(null),storeCounts:Array(d.n*d.k*d.p*d.q).fill(0),input:banks(d.ia),kernel:banks(d.ka),output:banks(d.oa),inputOrigin:banks(d.ia),kernelOrigin:banks(d.ka),state:'IDLE',job:0,bank:0,word:0,coreDone:false,reads:0,stores:0,completed:0,event:null,readData:null,readOutput:null};
 // Stable, nonoverlapping teaching bases. RTL bases are runtime word addresses.
 L.inputBase=0;L.kernelBase=x.length+64;L.outputBase=L.kernelBase+w.length+64;
 const s={layer:L};prepare(s);s.edge=0;s.cycles=0;return s;
}
function step(s){
 if(s.finished)return s;
 const edge=s.edge,cycles=s.cycles,L=s.layer,d=L.d,j=d.jobs[L.job],phase=L.state,b=L.bank,a=L.word;
 L.event={state:phase,job:L.job,bank:b,word:a};
 if((phase!=='WAIT_CORE'||L.coreDone)&&phase!=='START_CORE'){
  s.event=null;s.col=s.pe[d.a-1].map(pe=>pe.sum);
  s.pe=s.pe.map(row=>row.map(pe=>({...pe,a:0,sum:0,token:null,product:0,above:0,weightUsed:0})));
 }
 switch(phase){
 case 'IDLE':L.state='SETUP';break;
 case 'SETUP':L.state='PLAN_TILE';break;
 case 'PLAN_TILE':L.state='PREPARE';break;
 case 'PREPARE':prepare(s);L.state=j.h&&j.w?'INPUT_READ':'KERNEL_READ';break;
 case 'INPUT_READ':{
  const h=j.i+Math.floor(a/j.w),w=j.j+a%j.w,index=E.xindex(d,j.n,j.c+b,h,w);
  L.readData=L.X[index];Object.assign(L.event,{address:L.inputBase+index,value:L.readData,kind:'input',coords:[j.n,j.c+b,h,w]});L.readCoords=L.event.coords;L.reads++;L.state='INPUT_WRITE';break;
 }
 case 'INPUT_WRITE':
  L.input[b][a]=L.readData;L.inputOrigin[b][a]=L.readCoords;s.x[b*j.h*j.w+a]=L.readData;Object.assign(L.event,{value:L.readData,kind:'input'});
  if(++L.word===j.h*j.w){L.word=0;if(++L.bank===j.C){L.bank=0;L.state='KERNEL_READ';break;}}L.state='INPUT_READ';break;
 case 'KERNEL_READ':{
  const c=j.c+Math.floor(a/(j.R*j.S)),r=d.tapMode?j.r:Math.floor(a/j.S)%j.R,t=d.tapMode?j.s:a%j.S,index=E.windex(d,j.k+b,c,r,t);
  L.readData=L.W[index];Object.assign(L.event,{address:L.kernelBase+index,value:L.readData,kind:'kernel',coords:[j.k+b,c,r,t]});L.readCoords=L.event.coords;L.reads++;L.state='KERNEL_WRITE';break;
 }
 case 'KERNEL_WRITE':
  L.kernel[b][a]=L.readData;L.kernelOrigin[b][a]=L.readCoords;s.w[b*j.C*j.R*j.S+a]=L.readData;Object.assign(L.event,{value:L.readData,kind:'kernel'});
  if(++L.word===j.C*j.R*j.S){L.word=0;if(++L.bank===j.K){L.bank=0;L.state='START_CORE';break;}}L.state='KERNEL_READ';break;
 case 'START_CORE':
  s.expected=E.reference(s.d,s.x,s.w);E.step(s);L.state='WAIT_CORE';break;
 case 'WAIT_CORE':
  if(L.coreDone){
   L.completed++;const next=d.jobs[L.job+1];
   if(next&&next.tile===j.tile){L.job++;L.state='PREPARE';}
   else{L.bank=0;L.word=0;L.state='OUTPUT_READ';}
  }else{E.step(s);if(s.finished){L.coreDone=true;s.finished=false;}}
  break;
 case 'OUTPUT_READ':L.readOutput=L.output[b][a];Object.assign(L.event,{value:L.readOutput,kind:'output'});L.state='OUTPUT_WRITE';break;
 case 'OUTPUT_WRITE':{
  const index=E.yindex(d,j.n,j.k+b,j.p,j.q+a);L.result[index]=L.readOutput;L.storeCounts[index]++;L.stores++;
  Object.assign(L.event,{address:L.outputBase+index,value:L.readOutput,kind:'output',coords:[j.n,j.k+b,j.p,j.q+a]});
  if(++L.word===j.Q){L.word=0;if(++L.bank===j.K){L.bank=0;L.state='NEXT_TILE';break;}}L.state='OUTPUT_READ';break;
 }
 case 'NEXT_TILE':if(L.job+1===d.jobs.length){s.finished=true;L.state='IDLE';}else{L.job++;L.state='PLAN_TILE';}break;
 }
 s.edge=edge+1;s.cycles=phase==='IDLE'&&edge===0?0:cycles+1;return s;
}
function check(s){const L=s.layer,bad=L.result.filter((v,i)=>v!==L.expected[i]).length;return {written:L.stores,bad,ok:s.finished&&!bad&&L.storeCounts.every(v=>v===1)};}
function partialReference(s,k,pos){
 const L=s.layer,d=L.d,j=d.jobs[L.localJob];let sum=0;
 const currentWrites=s.writes[k][pos];
 if(!currentWrites&&!j.continue)return null;
 for(let c=0;c<j.c+j.C;c++)for(let r=0;r<d.r;r++)for(let t=0;t<d.s;t++){
  if(c>=j.c){const tap=r*d.s+t;if(d.tapMode?(tap>j.r*d.s+j.s||tap===j.r*d.s+j.s&&!currentWrites):tap>=currentWrites)continue;}
  const h=j.p*d.stride_i+r*d.dilation_i-d.pad_i,w=(j.q+pos)*d.stride_j+t*d.dilation_j-d.pad_j;
  if(h>=0&&h<d.h&&w>=0&&w<d.w)sum=(sum+L.X[E.xindex(d,j.n,c,h,w)]*L.W[E.windex(d,j.k+k,c,r,t)])|0;
 }
 return sum;
}
root.CFTiled={config,create,step,check,partialReference,output:s=>s.layer.result.slice()};
})(globalThis);
