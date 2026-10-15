from pathlib import Path
import subprocess,json,os,sys
sys.path.insert(0,'/tmp/cl_tiling_stage/channel_last_centralized')
from test_cases import make_tiled_cases
from gen_matrices import TENSOR_ARGUMENTS
root=Path('/tmp/cl_tiling_stage');out=Path('/tmp/cl_tiling_tests/edges');out.mkdir(exist_ok=True)
env=dict(os.environ,PATH='/tmp/im2col-tools/bin:'+os.environ['PATH']);results=[]
for variant,A,ia,oa,ka in [('centralized',1,2,1,1),('centralized',3,3,2,4),('per_row',3,3,2,4)]:
 src=root/('channel_last_'+variant);tag=f'{variant}_A{A}_{ia}_{oa}_{ka}';folder=out/tag;folder.mkdir(exist_ok=True)
 # Compile the existing demonstration bench with independent local depths.
 cmd=['iverilog','-g2012','-I',str(src/'sim'),'-s','tb_conv_accelerator','-o',str(folder/'test.vvp')]+[f'-Ptb_conv_accelerator.{k}={v}' for k,v in dict(ARRAY_SIZE=A,INPUT_ADDR_WIDTH=ia,OUTPUT_ADDR_WIDTH=oa,KERNEL_ADDR_WIDTH=ka).items()]+[str(src/'sim/tb_conv_accelerator.v')]+list(map(str,(src/'rtl').glob('*.v')))
 subprocess.run(cmd,env=env,check=True)
 for i,change in enumerate([dict(N=2,C=5,K=4,H=4,W=7,R=2,S=3,pad_i=1,pad_j=2,dilation_j=2),dict(C=4,K=5,H=3,W=8,R=1,S=3,pad_i=2,pad_j=2),dict(C=3,K=2,H=1,W=1,R=1,S=1,pad_i=2,pad_j=3)]):
  c={**dict(TENSOR_ARGUMENTS),**change};d=folder/str(i);d.mkdir(exist_ok=True)
  gen=[sys.executable,str(src/'gen_matrices.py'),'--out-dir',str(d),'--seed','196']
  for k,v in c.items():gen += ['--'+k,str(v)]
  subprocess.run(gen,check=True,stdout=subprocess.DEVNULL)
  run=['vvp',str(folder/'test.vvp')]+[f'+{k}={v}' for k,v in c.items()]+[f'+{k}={d/v}' for k,v in dict(INPUT_FILE='input_tensor.txt',KERNEL_FILE='kernel_tensor.txt',OUTPUT_FILE='actual.txt',SRAM_LAYOUT_FILE='layout.txt').items()]
  result=subprocess.run(run,env=env,check=True,text=True,capture_output=True,timeout=120);(d/'run.log').write_text(result.stdout)
  def words(p):return [int(t,16) for l in p.read_text().splitlines() for t in l.split('//')[0].split()]
  assert words(d/'actual.txt')==words(d/'output_tensor.txt')
  results.append(dict(build=tag,config=c,outputs=len(words(d/'actual.txt'))));print('PASS',tag,i,flush=True)
(out/'summary.json').write_text(json.dumps(results,indent=2)+'\n')
