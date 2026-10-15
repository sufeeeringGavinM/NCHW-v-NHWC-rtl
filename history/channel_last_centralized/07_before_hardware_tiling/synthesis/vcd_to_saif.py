"""Convert a bounded VCD activity window to bit-level SAIF statistics.

This retains observed simulation activity, not physical glitch activity. Times are
scaled uniformly to the comparison clock period; annotation coverage is reported
by Vivado separately.
"""
import argparse
from collections import defaultdict
from pathlib import Path
import re


def convert(path,output,start,end,scale=2,instance="UUT"):
    scopes=[];definitions=defaultdict(list);widths={};events=[]
    timestamp=0;header=True
    with path.open() as handle:
        for raw in handle:
            line=raw.strip()
            if header:
                if line.startswith('$scope'):
                    scopes.append(line.split()[2].lstrip('\\'))
                elif line.startswith('$upscope'): scopes.pop()
                elif line.startswith('$var'):
                    tokens=line.split();kind,width,code,name=tokens[1:5]
                    if kind=='parameter': continue
                    width=int(width)
                    if len(scopes)>=2 and scopes[:2]==['tb_conv_core',instance]:
                        definitions[code].append((tuple(scopes),name.lstrip('\\'),width))
                        widths[code]=width
                elif line.startswith('$enddefinitions'): header=False
                continue
            if line.startswith('#'): timestamp=int(line[1:])
            elif line and line[0] in 'bB':
                value,code=line[1:].split()
                if code in widths: events.append((timestamp,code,value.lower()))
            elif line and line[0] in '01xXzZ':
                code=line[1:]
                if code in widths: events.append((timestamp,code,line[0].lower()))
    stats={code:[[0,0,0,0] for _ in range(width)] for code,width in widths.items()}
    values={code:'x'*width for code,width in widths.items()}
    previous={code:start for code in widths}
    def accrue(code,t):
        begin=max(start,previous[code]);finish=min(end,t)
        if finish>begin:
            dt=(finish-begin)*scale
            for i,bit in enumerate(reversed(values[code])):
                stats[code][i][0 if bit=='0' else 1 if bit=='1' else 2]+=dt
        previous[code]=t
    for t,code,value in events:
        if t>end: break
        width=widths[code]
        fill=value[0] if value[0] in 'xz' else '0'
        value=value.rjust(width,fill)[-width:]
        accrue(code,t)
        if start<=t<end:
            for i,(old,new) in enumerate(zip(reversed(values[code]),reversed(value))):
                if old in '01' and new in '01' and old!=new: stats[code][i][3]+=1
        values[code]=value
    for code in widths: accrue(code,end)
    root={}
    for code,aliases in definitions.items():
        for scope,name,width in aliases:
            node=root
            for s in scope: node=node.setdefault(s,{'nets':{},'children':{}})['children']
            # Store nets on the last instance rather than its children dictionary.
            last=root
            for s in scope[:-1]: last=last[s]['children']
            target=last[scope[-1]]['nets']
            for bit in range(width):
                target[name if width==1 else f'{name}[{bit}]']=stats[code][bit]
    def escape(name):
        return re.sub(r'([\\\[\]()\s])',r'\\\1',name)
    lines=['(SAIFILE','  (SAIFVERSION "2.0")','  (DIRECTION "backward")',
           '  (DESIGN "conv_core")','  (DATE "2026-10-14")',
           '  (VENDOR "VCD activity conversion")','  (PROGRAM_NAME "vcd_to_saif.py")',
           '  (VERSION "1")','  (DIVIDER /)','  (TIMESCALE 1 ps)',f'  (DURATION {(end-start)*scale})']
    def emit(name,node,indent):
        lines.append(' '*indent+f'(INSTANCE {escape(name)}')
        if node['nets']:
            lines.append(' '*(indent+2)+'(NET')
            for net,(t0,t1,tx,tc) in sorted(node['nets'].items()):
                assert t0+t1+tx==(end-start)*scale,(net,t0,t1,tx)
                lines.append(' '*(indent+4)+f'({escape(net)} (T0 {t0}) (T1 {t1}) (TX {tx}) (TC {tc}) (IG 0))')
            lines.append(' '*(indent+2)+')')
        for child,sub in sorted(node['children'].items()): emit(child,sub,indent+2)
        lines.append(' '*indent+')')
    for name,node in root.items(): emit(name,node,2)
    lines.append(')')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text('\n'.join(lines)+'\n')
    print(f'{output}: {sum(len(v) for v in stats.values())} distinct activity bits, {(end-start)*scale} ps')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('vcd',type=Path);parser.add_argument('output',type=Path)
    parser.add_argument('--start',type=int,required=True);parser.add_argument('--end',type=int,required=True)
    parser.add_argument('--scale',type=int,default=2)
    parser.add_argument('--instance',default='UUT',help='Top testbench DUT instance to retain')
    a=parser.parse_args();convert(a.vcd,a.output,a.start,a.end,a.scale,a.instance)
