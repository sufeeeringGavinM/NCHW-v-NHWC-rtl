"""Convert validated default-job synthesized-netlist VCDs to matched 5 MHz SAIF."""
from pathlib import Path
import argparse
import re
from project_paths import ROOT
from vcd_to_saif import convert


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('variants',nargs='*',default=['channel_first','centralized','per_row'])
    args=p.parse_args()
    for variant in args.variants:
        folder=ROOT/'comparison/netlist_validation'/variant
        text=(folder/'run.log').read_text()
        assert 'NETLIST_PORT_CHECK_PASS' in text
        start=int(re.search(r'start_ps: (\d+)',text)[1])
        cycles=int(re.search(r'Run cycles .*?: (\d+)',text)[1])
        convert(folder/'gate.vcd',ROOT/'comparison/build'/variant/'activity_netlist.saif',
                start,start+cycles*10000,scale=20,instance='GATE')

if __name__=='__main__': main()
