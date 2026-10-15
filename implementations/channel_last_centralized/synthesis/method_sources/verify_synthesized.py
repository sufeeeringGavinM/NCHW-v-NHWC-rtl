"""Compare synthesized core ports against RTL and record netlist power activity."""
from pathlib import Path
import argparse
import re
import subprocess
from project_paths import ROOT


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('variant',choices=['channel_first','centralized','per_row'])
    parser.add_argument('--unisim',type=Path,default=Path('/mnt/f/AMDDesignTools/2026.1/Vivado/data/verilog/src'))
    a=parser.parse_args();v=a.variant
    out=ROOT/'comparison/netlist_validation'/v;out.mkdir(parents=True,exist_ok=True)
    build=ROOT/'comparison/build'/v
    sources=list((build/'rtl').glob('*.v'))
    modules=[m for p in sources for m in re.findall(r'\bmodule\s+(\w+)',p.read_text())]
    pattern=r'\b('+('|'.join(map(re.escape,modules)))+r')\b'
    renamed=[]
    for p in sources:
        dest=out/p.name;dest.write_text(re.sub(pattern,lambda m:'rtl_'+m[0],p.read_text()));renamed.append(dest)
    tb=(ROOT/'comparison/simulation_cfg9'/f'tb_{v}.v').read_text()
    begin=tb.index('  conv_core #(');end=tb.index('\n  );',begin)+len('\n  );')
    instance=tb[begin:end]
    connections=instance[instance.index(' UUT (')+len(' UUT ('):]
    connections=connections.replace('.acc_col_out(acc_col_out)', '.acc_col_out(gate_acc_col_out), .observed_words(gate_observed_words)')
    connections=connections.replace('.done(done)', '.done(gate_done)').replace('.busy(busy)', '.busy(gate_busy)')
    # Vivado emits one escaped port per row for packed multi-dimensional buses.
    for name,width,signal in [('kernel_waddr_ext',8,'kernel_waddr_ext'),
                             ('kernel_wdata_ext',8,'kernel_wdata_ext'),
                             ('sram_waddr_ext',8,'sram_waddr_ext'),
                             ('sram_wdata_ext',8,'sram_wdata_ext'),
                             ('acc_col_out',32,'gate_acc_col_out'),
                             ('observed_words',32,'gate_observed_words')]:
        pieces=[]
        for lane in range(10):
            expr=f'{signal}[{lane*width} +: {width}]' if signal.startswith('gate_') else f'{signal}[{lane}]'
            pieces.append(f'.\\{name}[{lane}] ({expr})')
        connections=connections.replace(f'.{name}({signal})',', '.join(pieces))
    connections=re.sub(r'\.cfg_(\w+)\((\w+)\)',lambda m:f".cfg_{m[1]}(CFG_WIDTH'({m[2]}))",connections)
    gate='  conv_core GATE ('+connections
    ref=instance.replace('conv_core #(','rtl_conv_core #(').replace('.acc_col_out(acc_col_out)', '.acc_col_out(acc_col_out), .observed_words(ref_observed_words)')
    tb=tb[:begin]+'''  wire [ARRAY_SIZE*ACC_WIDTH-1:0] gate_acc_col_out, gate_observed_words;
  wire [ARRAY_SIZE*ACC_WIDTH-1:0] ref_observed_words;
  wire [ARRAY_SIZE*ACC_WIDTH-1:0] ref_acc_col_out = acc_col_out;
  wire gate_busy, gate_done;
  integer compare_bit;
  integer known_bits=0;
  always @(negedge clk) begin
    if (busy || done) begin
      if (gate_busy !== busy || gate_done !== done)
        $fatal(1,"NETLIST_CONTROL_MISMATCH at %0t",$time);
      for(compare_bit=0;compare_bit<ARRAY_SIZE*ACC_WIDTH;compare_bit=compare_bit+1) begin
        if (ref_acc_col_out[compare_bit]===1'b0 || ref_acc_col_out[compare_bit]===1'b1) begin
          known_bits=known_bits+1;
          if(gate_acc_col_out[compare_bit] !== ref_acc_col_out[compare_bit])
            $fatal(1,"NETLIST_ACC_MISMATCH at %0t bit%0d",$time,compare_bit);
        end
        if (ref_observed_words[compare_bit]===1'b0 || ref_observed_words[compare_bit]===1'b1) begin
          known_bits=known_bits+1;
          if(gate_observed_words[compare_bit] !== ref_observed_words[compare_bit])
            $fatal(1,"NETLIST_SRAM_MISMATCH at %0t bit%0d",$time,compare_bit);
        end
      end
    end
  end
'''+ref+'\n'+gate+tb[end:]
    # Let device global set/reset expire before tensor loading and accepted start.
    tb=tb.replace('    load_input_tensor;', '    #200;\n    load_input_tensor;')
    tb=tb.replace('$dumpvars(0, tb_conv_core);','$dumpvars(0, GATE);')
    tb=tb.replace('    $finish;', '    $display("NETLIST_PORT_CHECK_PASS known_bits=%0d",known_bits);\n    $finish;')
    path=out/'tb_conv_core.v';path.write_text(tb)
    binary=out/'gate.vvp'
    compile_result=subprocess.run(['iverilog','-g2012','-s','tb_conv_core','-s','glbl',
        '-y',str(a.unisim/'unisims'),'-o',str(binary),str(a.unisim/'glbl.v'),str(path),
        *map(str,renamed),str(ROOT/'comparison/reports'/f'{v}_core/synthesized.v')],capture_output=True,text=True,timeout=600)
    (out/'compile.log').write_text(compile_result.stdout+compile_result.stderr)
    if compile_result.returncode:raise RuntimeError(compile_result.stderr[-2400:])
    data=ROOT/'comparison/simulation_cfg9/case_0000'
    r=subprocess.run(['vvp',str(binary),f'+INPUT_FILE={data/"input_tensor.txt"}',
      f'+KERNEL_FILE={data/"kernel_tensor.txt"}',f'+OUTPUT_FILE={out/"output.txt"}',
      f'+SRAM_LAYOUT_FILE={out/"sram.txt"}',f'+WAVE_FILE={out/"gate.vcd"}'],capture_output=True,text=True,timeout=600)
    (out/'run.log').write_text(r.stdout+r.stderr)
    if r.returncode or 'NETLIST_PORT_CHECK_PASS' not in r.stdout:raise RuntimeError(r.stdout[-2000:]+r.stderr[-1000:])
    assert (out/'output.txt').read_text()==(data/f'{v}.txt').read_text()
    print(r.stdout[-650:])

if __name__=='__main__':main()
