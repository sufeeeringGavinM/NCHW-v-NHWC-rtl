# Usage: python capture-rtl-trace.py default|fallback VCD TENSOR_DIR OUTPUT_JSON
from pathlib import Path
import json,re,sys
name=sys.argv[1];vcd=Path(sys.argv[2]);base=Path(sys.argv[3])
scopes=[];names={};values={};events=[];started=False;done=False
root='tb_conv_accelerator';dut=root+'.DUT'
def number(v):
 try:return int(v,2)
 except (ValueError,TypeError):return None
def get(vals,n):return number(vals.get(names[n]))
def record(lines):
 global started,done
 if done:return
 old=values.copy()
 for line in lines:
  if line.startswith('b'):
   val,key=line[1:].split();values[key]=val
  elif line and line[0] in '01xz':values[line[1:]]=line[0]
 if get(old,root+'.clk')!=0 or get(values,root+'.clk')!=1:return
 if not started:
  if get(old,root+'.start')!=1 or get(old,dut+'.state')!=0 or get(old,root+'.nrst')!=1:return
  started=True
 event={'state':get(values,dut+'.state'),'core':get(values,dut+'.u_core.u_controller.state'),'done':get(values,root+'.done')}
 for flag in ['mem_re','mem_we']:
  if get(old,root+'.'+flag):
   read=flag=='mem_re';address=get(old,root+('.mem_raddr' if read else '.mem_waddr'));kind='input' if read and get(old,dut+'.state')==4 else 'kernel' if read else 'output'
   event['transfer']={'kind':kind,'index':address-get(old,root+'.'+kind+'_base')}
   if not read:
    value=get(old,root+'.mem_wdata');event['transfer']['value']=value-(1<<32) if value>=1<<31 else value
 if get(old,dut+'.state') in [5,7]:
  kind='input' if get(old,dut+'.state')==5 else 'kernel';bank=get(old,dut+'.bank_index')
  data=get(old,dut+'.'+kind+'_data');addr=get(old,dut+'.'+kind+'_addr');value=(data>>(bank*8))&255
  event['local']={'kind':kind,'bank':bank,'word':(addr>>(bank*8))&255,'value':value-256 if value>=128 else value}
 if event['state']==9:event['patch']=[get(values,dut+'.'+n) for n in ['n0','k0','p0','q0','c0','tap_r','tap_s','tile_k','tile_q','tile_c','patch_h','patch_w','patch_i','patch_j','local_pad_i','local_pad_j']]
 events.append(event)
 if event['done']:done=True
with vcd.open() as f:
 for line in f:
  tok=line.split()
  if line.startswith('$scope'):scopes.append(tok[2])
  elif line.startswith('$upscope'):scopes.pop()
  elif line.startswith('$var'):names['.'.join(scopes+[tok[4]])]=tok[3]
  elif line.startswith('$enddefinitions'):break
 group=[]
 for line in f:
  line=line.strip()
  if line.startswith('#'):record(group);group=[]
  elif not line.startswith('$'):group.append(line)
 record(group)
def words(file,bits):
 data=re.sub(r'//[^\n]*','',(base/file).read_text());v=[int(x,16) for x in data.split()];return [x-(1<<bits) if x>=1<<(bits-1) else x for x in v]
raw={'n':1,'c':4,'k':2,'h':6,'w':6,'r':3,'s':3} if name=='default' else {'n':1,'c':1,'k':1,'h':1,'w':1,'r':17,'s':17,'pad_i':8,'pad_j':8}
out={'name':name,'config':raw,'x':words('input_tensor.txt',8),'w':words('kernel_tensor.txt',8),'y':words('output_tensor_accelerator.txt',32),'edges':events}
Path(sys.argv[4]).write_text(json.dumps(out,separators=(',',':'))+'\n');print(name,len(events))
