from pathlib import Path
import subprocess,os,json,shutil
vis=Path(__file__).resolve().parents[1];src=vis/'reference';out=vis/'validation';env=dict(os.environ,PATH='/tmp/im2col-tools/bin:'+os.environ['PATH'])
monitor='''
  integer trace_tick=0;
  reg trace_active=0;
  always @(posedge clk) if(nrst) begin
    if(start && !busy) trace_active=1;
    if(trace_active && !done) begin
      $display("TRACE,%0d,%0d,%0d,%0d,%0d,%0d,%0d,%0d,%0d,%0d,%0d",trace_tick,DUT.state,DUT.u_core.u_controller.state,DUT.u_core.group_base,DUT.u_core.u_datapath.step_count,DUT.u_core.advance,mem_re,mem_we,mem_raddr,mem_waddr,$signed(mem_wdata));
      trace_tick=trace_tick+1;
    end
  end
  genvar trace_col;
  generate for(trace_col=0;trace_col<ARRAY_SIZE;trace_col=trace_col+1) begin : trace_outputs
    always @(posedge clk) if(nrst && DUT.u_core.u_datapath.g_output[trace_col].u_accumulator.wb_valid)
      $display("WRITE,%0d,%0d,%0d,%0d",trace_tick-1,trace_col,DUT.u_core.u_datapath.g_output[trace_col].u_accumulator.wb_ptr,$signed(DUT.u_core.u_datapath.g_output[trace_col].u_accumulator.wb_data));
  end endgenerate
'''
bench=Path('/tmp/cl_trace_bench.v');bench.write_text((src/'sim/tb_conv_accelerator.v').read_text().replace('endmodule',monitor+'endmodule'))
fixtures=[]
configs=[dict(a=4,n=1,c=4,k=2,h=6,w=6,r=3,s=3,ia=8,oa=8,ka=8),dict(a=3,n=1,c=4,k=4,h=3,w=5,r=3,s=3,pad_i=1,pad_j=1,ia=2,oa=2,ka=2)]
for i,cfg in enumerate(configs):
 folder=Path('/tmp/cl_trace_'+str(i));folder.mkdir(exist_ok=True)
 cmd=['iverilog','-g2012','-I',str(src/'sim'),'-s','tb_conv_accelerator','-o',str(folder/'test.vvp')]+[f'-Ptb_conv_accelerator.{k}={v}' for k,v in dict(ARRAY_SIZE=cfg['a'],INPUT_ADDR_WIDTH=cfg['ia'],OUTPUT_ADDR_WIDTH=cfg['oa'],KERNEL_ADDR_WIDTH=cfg['ka']).items()]+[str(bench)]+list(map(str,(src/'rtl').glob('*.v')))
 subprocess.run(cmd,env=env,check=True)
 names={'n':'N','c':'C','k':'K','h':'H','w':'W','r':'R','s':'S'};args={names.get(k,k):v for k,v in cfg.items() if k not in ['a','ia','oa','ka']}
 gen=['python3',str(src/'gen_matrices.py'),'--out-dir',str(folder),'--seed','196']
 for k,v in args.items():gen+=['--'+k,str(v)]
 subprocess.run(gen,check=True,stdout=subprocess.DEVNULL)
 run=['vvp',str(folder/'test.vvp')]+[f'+{k}={v}' for k,v in args.items()]+[f'+{k}={folder/v}' for k,v in dict(INPUT_FILE='input_tensor.txt',KERNEL_FILE='kernel_tensor.txt',OUTPUT_FILE='actual.txt',SRAM_LAYOUT_FILE='layout.txt').items()]
 result=subprocess.run(run,env=env,check=True,text=True,capture_output=True,timeout=120);(out/f'rtl-{i}.log').write_text(result.stdout)
 def words(p,bits):return [int(t,16)-(1<<bits) if int(t,16)>=(1<<(bits-1)) else int(t,16) for l in p.read_text().splitlines() for t in l.split('//')[0].split()]
 fixture={'config':cfg,'x':words(folder/'input_tensor.txt',8),'w':words(folder/'kernel_tensor.txt',8),'y':words(folder/'actual.txt',32),'trace':[[int(t) for t in l.split(',')[1:]] for l in result.stdout.splitlines() if l.startswith('TRACE,')],'writes':[[int(t) for t in l.split(',')[1:]] for l in result.stdout.splitlines() if l.startswith('WRITE,')]}
 fixtures.append(fixture);print('Captured',i,len(fixture['trace']),'edges',len(fixture['writes']),'local writes',flush=True)
(out/'rtl-fixtures.json').write_text(json.dumps(fixtures,separators=(',',':'))+'\n');shutil.copy2('/tmp/capture_cl_traces.py',out/'capture-rtl-trace.py')
