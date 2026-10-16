"""Render exact simulator sweeps with Matplotlib and offline Plotly. AI-assisted."""
import sys, json, csv, math, hashlib
from pathlib import Path
# Optional workstation bundle; ordinary pip-installed matplotlib/plotly also work.
bundle = Path('C:/Users/RageAgainstW10/.codex/visualizations/2026/10/15/01a13fed-1b16-7e12-b37a-ae0e492dc20c/plot-packages')
if bundle.exists(): sys.path.insert(0, str(bundle))
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import plotly.graph_objects as go
from plotly.offline import get_plotlyjs

HERE=Path(__file__).resolve().parent
D=json.loads((HERE/'cycles.json').read_text())
OUT=HERE/'plots'; OUT.mkdir(exist_ok=True)
COLORS={'CF':'#1e6091','CL':'#c75416'}
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.dpi':130,'savefig.dpi':180})
BASE='Baseline: A=4, N=1, C=4, K=2, H=W=6, R=S=3; input/output/kernel=256 words per bank.\nStride=1, dilation=1, padding=0. Each panel changes only its labeled dimension(s).'

def rows(sid): return [r for r in D['rows'] if r['sweep']==sid]
def values(rr,key,metric): return [r[key].get(metric,float('nan')) for r in rr]
def decorate(ax,s):
    ax.set_xlabel(s['label']); ax.set_ylabel('Whole-layer cycles'); ax.grid(alpha=.2)
    if s['id'].startswith('sram'): ax.set_xscale('log',base=2)
def save(fig,name):
    fig.savefig(OUT/(name+'.png'),bbox_inches='tight')
    fig.savefig(OUT/(name+'.pdf'),bbox_inches='tight'); plt.close(fig)

fig,axs=plt.subplots(4,3,figsize=(16,15))
for ax,s in zip(axs.flat,D['sweeps']):
    rr=rows(s['id']); xx=[r['x'] for r in rr]
    for key in COLORS: ax.plot(xx,values(rr,key,'cycles'),'-o',ms=3,color=COLORS[key],label=key)
    decorate(ax,s);ax.set_title(s['label']); ax.legend(frameon=False)
fig.suptitle('Channel-first vs channel-last: exact modeled layer cycles',fontsize=19,y=.995)
fig.text(.02,.012,BASE+'\nIncludes serialized DMA, scheduler overhead and CL memory stalls. Gaps are rejected teaching-limit configurations.',fontsize=10)
fig.tight_layout(rect=(0,.075,1,.98));save(fig,'01_cycle_sweeps')
# Separate export of every curve for slides/reports.
for s in D['sweeps']:
    fig,ax=plt.subplots(figsize=(8,5));rr=rows(s['id'])
    for key in COLORS:ax.plot([r['x'] for r in rr],values(rr,key,'cycles'),'-o',color=COLORS[key],label=key)
    decorate(ax,s);ax.set_title(s['label']+' — total cycles');ax.legend();fig.text(.02,-.08,BASE,fontsize=9);fig.tight_layout();save(fig,s['id'])
# Positive speedup means CL takes fewer cycles.
z=np.full((12,10),np.nan)
for r in rows('array_channels'):
    if 'cycles' in r['CF'] and 'cycles' in r['CL']: z[r['cfg']['c']-1,r['cfg']['a']-1]=r['CF']['cycles']/r['CL']['cycles']
fig,ax=plt.subplots(figsize=(11,7));span=max(abs(np.nanmin(z)-1),abs(np.nanmax(z)-1))
im=ax.imshow(z,origin='lower',aspect='auto',extent=(.5,10.5,.5,12.5),cmap='RdBu',vmin=1-span,vmax=1+span)
for c in range(12):
    for a in range(10):
        if not np.isnan(z[c,a]):ax.text(a+1,c+1,f'{z[c,a]:.2f}',ha='center',va='center',fontsize=8)
ax.set_xticks(range(1,11));ax.set_yticks(range(1,13));ax.set_xlabel('Array side A');ax.set_ylabel('Input channels C');ax.set_title('CF cycles / CL cycles: above 1 favors CL; below 1 favors CF')
fig.colorbar(im,ax=ax,label='Cycle ratio');fig.text(.02,.012,BASE,fontsize=9);fig.tight_layout(rect=(0,.10,1,1));save(fig,'02_winner_map')
# Breakdowns: no double-counting retries as array stalls.
fig,axs=plt.subplots(2,2,figsize=(14,10));parts=['idealCore','wait','dma','control'];pc=['#477caa','#e39b28','#5f9c79','#9c89b8']
for ax,sid in zip(axs.flat,['array','channels','kernel','sram_all']):
    rr=rows(sid);loc=np.arange(len(rr));width=.38
    for off,key in [(-width/2,'CF'),(width/2,'CL')]:
        bottom=np.zeros(len(rr))
        for part,color in zip(parts,pc):
            yy=np.array(values(rr,key,part));ax.bar(loc+off,yy,width,bottom=bottom,color=color,label=part if key=='CF' else None);bottom+=yy
    ax.set_xticks(loc,[str(r['x']) for r in rr],rotation=45);ax.set_xlabel(next(s['label'] for s in D['sweeps'] if s['id']==sid));ax.set_ylabel('Cycles');ax.set_title('CF left / CL right');ax.grid(axis='y',alpha=.15)
axs[0,0].legend();fig.suptitle('Where clocks go: ideal core + memory waits + serialized DMA + control',fontsize=16)
fig.text(.02,.012,BASE,fontsize=9);fig.tight_layout(rect=(0,.09,1,.96));save(fig,'03_cycle_breakdown')
fig,axs=plt.subplots(2,2,figsize=(13,9))
for ax,metric,title in zip(axs.flat,['ct','qt','jobs','wait'],['Channels per reduction tile','Output width capacity per tile','Total local jobs','CL memory wait clocks']):
    for key in COLORS:
        rr=rows('sram_all');ax.step([r['x'] for r in rr],values(rr,key,metric),where='mid',color=COLORS[key],label=key);ax.scatter([r['x'] for r in rr],values(rr,key,metric),s=15,color=COLORS[key])
    ax.set_xscale('log',base=2);ax.set_xlabel('Words per bank (all SRAMs)');ax.set_ylabel(metric);ax.set_title(title);ax.grid(alpha=.2);ax.legend()
fig.suptitle('SRAM thresholds change tiling, reuse and wait clocks',fontsize=16);fig.text(.02,.012,BASE+'\nQt is planner capacity; an actual job is clipped to remaining output width.',fontsize=9);fig.tight_layout(rect=(0,.10,1,.96));save(fig,'04_sram_transitions')
# CSV includes every measurement/error and all explicit matched build parameters.
fields=['sweep','x','implementation',*D['base'], 'cycles','core','idealCore','wait','dma','control','jobs','tiles','ct','qt','tapMode','reads','stores','p','q','error']
with (HERE/'cycles.csv').open('w',newline='') as f:
    w=csv.DictWriter(f,fields);w.writeheader()
    for r in D['rows']:
        for key in COLORS:w.writerow({'sweep':r['sweep'],'x':r['x'],'implementation':key,**r['cfg'],**r[key]})
# One offline interactive explorer. Controls switch precomputed sweeps and metrics.
meta={s['id']:s['label'] for s in D['sweeps']}
heat=go.Figure(go.Heatmap(z=z,x=list(range(1,11)),y=list(range(1,13)),colorscale='RdBu',zmid=1,colorbar_title='CF / CL',hovertemplate='A=%{x}, C=%{y}<br>CF / CL=%{z:.3f}<extra></extra>'))
heat.update_layout(title='Winner map — above 1 favors CL; below 1 favors CF',xaxis_title='Array side A',yaxis_title='Input channels C',height=620,template='plotly_white')
html='''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Im2col cycle comparisons</title><style>body{font:16px system-ui;margin:0;background:#f4f6fa;color:#203047}main{max-width:1250px;margin:auto;padding:25px}h1{font-size:30px}p{line-height:1.6}.controls{display:flex;gap:18px;flex-wrap:wrap;padding:16px;background:white;border-radius:12px}select{font:inherit;padding:7px;max-width:100%}.plot{background:white;margin:18px 0;border-radius:12px;overflow:hidden}#curve{height:570px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:8px;border-bottom:1px solid #ccd3dd;text-align:right}th:first-child,td:first-child{text-align:left}.scroll{overflow:auto}a{color:#1e6091}code{background:#e4eaf2;padding:2px 5px}</style><script>'''+get_plotlyjs()+'''</script></head><body><main><h1>Channel-first vs channel-last cycles</h1><p>Exact existing simulator models, including tiling, serialized transfers and channel-last bank arbitration. Hover to inspect configurations; drag to zoom, double-click to reset, use the camera to export.</p><p><b>Baseline:</b> A=4, N=1, C=4, K=2, H=W=6, R=S=3; each SRAM has 256 words per bank. Stride and dilation 1, padding 0. Only the selected dimension(s) change. In the kernel sweep, larger kernels shrink the output because input dimensions and padding stay fixed. Images run sequentially; the batch sweep has no cross-image overlap. Changing A changes the number of banks and PEs: this is not an equal-area comparison.</p><div class="controls"><label>Sweep <select id="sweep"></select></label><label>Metric <select id="metric"><option value="cycles">Whole-layer cycles</option><option value="core">Core cycles, including waits</option><option value="ratio">CF cycles / CL cycles</option><option value="wait">Memory wait clocks</option><option value="dma">Serialized DMA cycles</option><option value="control">Scheduler control cycles</option><option value="jobs">Local jobs</option><option value="tiles">Output tiles</option><option value="ct">Channels per tile (Ct)</option><option value="qt">Planned output width capacity (Qt)</option></select></label><label>Scale <select id="scale"><option value="linear">Linear Y</option><option value="log">Log Y</option></select></label></div><div id="curve" class="plot"></div><p id="status"></p><div class="scroll"><table id="table"></table></div><div class="plot">'''+heat.to_html(full_html=False,include_plotlyjs=False)+'''</div><h2>Reading the costs</h2><p>For each local job, the ideal core cost is <code>1 + A + G × (Q + 2A) + (G − 1)</code>. CF uses G=R×S. CL uses G=ceil(C×R×S/A), then adds actual modeled wait clocks from its synchronous input-bank scheduler and two vector slots. Retry rounds are not added separately: some retries are hidden.</p><p>Whole-layer cost is <code>ideal core + memory waits + 2×(backing reads + stores) + 1 + 2×output tiles + 3×local jobs</code>. Counts are summed over the actual jobs selected independently by each design. Every tiled job uses local N=P=1. Larger SRAM can reduce reloads or change the planner, so curves have steps and need not be monotonic.</p><p>Input/kernel words are 8-bit; output words are 32-bit. Each memory has A banks. With all depths D, payload storage is A×D×(8+8+32) bits; no circuit overhead included. Independent SRAM sweeps hold the other two depths at 256.</p><p>Gaps retain rejected configurations (30,000-clock or tensor-size teaching limits). Empty table cells are unavailable results, never zero cycles. No new RTL sweep, synthesis or frequency measurement was performed. Source hashes and validation scope are in <a href="provenance.json">provenance.json</a>.</p><p><a href="plots/01_cycle_sweeps.png">All cycle plots</a> · <a href="plots/03_cycle_breakdown.png">Cost breakdown</a> · <a href="plots/04_sram_transitions.png">SRAM thresholds</a> · <a href="cycles.csv">CSV data</a> · <a href="plot.py">Python plotting source</a></p></main><script>const DATA='''+json.dumps(D)+''';const LABELS='''+json.dumps(meta)+''';const $=s=>document.getElementById(s);for(const [id,label]of Object.entries(LABELS))$('sweep').add(new Option(label,id));
function draw(){const sid=$('sweep').value,m=$('metric').value,rr=DATA.rows.filter(r=>r.sweep===sid),metricLabel=$('metric').selectedOptions[0].text;const series=m==='ratio'?['ratio']:['CF','CL'];const traces=series.map(k=>({x:rr.map(r=>r.x),y:rr.map(r=>m==='ratio'?(r.CF.cycles&&r.CL.cycles?r.CF.cycles/r.CL.cycles:null):(r[k][m]??null)),mode:'lines+markers',name:k==='ratio'?'CF / CL':k,line:{color:k==='CF'?'#1e6091':k==='CL'?'#c75416':'#6544a0'},connectgaps:false,customdata:rr.map(r=>JSON.stringify(r.cfg)),hovertemplate:'x=%{x}<br>'+metricLabel+'=%{y:.4g}<br>%{customdata}<extra>%{fullData.name}</extra>'}));Plotly.react('curve',traces,{title:LABELS[sid]+' — '+metricLabel,template:'plotly_white',xaxis:{title:LABELS[sid],type:sid.startsWith('sram')?'log':'linear'},yaxis:{title:metricLabel,type:$('scale').value},margin:{t:65,b:70},legend:{orientation:'h'},shapes:m==='ratio'?[{type:'line',xref:'paper',x0:0,x1:1,y0:1,y1:1,line:{dash:'dot',color:'#666'}}]:[]},{responsive:true});let errors=[];for(const r of rr)for(const k of ['CF','CL'])if(r[k].error)errors.push(k+' @ '+r.x+': '+r[k].error);$('status').textContent=errors.length?errors.join(' | '):'All displayed configurations are within the accepted model bounds. Each point is an exact cycle count.';let t='<tr><th>Value</th><th>CF cycles</th><th>CL cycles</th><th>CF / CL</th><th>CF jobs</th><th>CL jobs</th><th>CL waits</th><th>CF Ct / Qt</th><th>CL Ct / Qt</th><th>Tap fallback CF / CL</th></tr>';for(const r of rr)t+='<tr><td>'+r.x+'</td><td>'+(r.CF.cycles??'—')+'</td><td>'+(r.CL.cycles??'—')+'</td><td>'+(r.CF.cycles&&r.CL.cycles?(r.CF.cycles/r.CL.cycles).toFixed(3):'—')+'</td><td>'+(r.CF.jobs??'—')+'</td><td>'+(r.CL.jobs??'—')+'</td><td>'+(r.CL.wait??'—')+'</td><td>'+(r.CF.ct??'—')+' / '+(r.CF.qt??'—')+'</td><td>'+(r.CL.ct??'—')+' / '+(r.CL.qt??'—')+'</td><td>'+[r.CF,r.CL].map(v=>v.error?'—':v.tapMode?'yes':'no').join(' / ')+'</td></tr>';$('table').innerHTML=t;}for(const id of ['sweep','metric','scale'])$(id).onchange=draw;draw();</script></body></html>'''
(HERE/'index.html').write_text(html,encoding='utf-8')
print(json.dumps({'sweep_configurations':len(D['rows']),'pngs':len(list(OUT.glob('*.png'))),'pdfs':len(list(OUT.glob('*.pdf'))),'dashboard_bytes':len(html)}))
