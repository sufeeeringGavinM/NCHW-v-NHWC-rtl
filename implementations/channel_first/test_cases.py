"""Sweep valid convolution configurations through run_case.py."""
import argparse
import json
import os
from pathlib import Path
import random
import re
import signal
import subprocess
import sys

from gen_matrices import TENSOR_ARGUMENTS
from run_case import read_tensor

PROJECT = Path(__file__).resolve().parent
NAMES = [name for name, _ in TENSOR_ARGUMENTS]


def hardware_limits(tiled=False):
    source = (PROJECT / ("sim/tb_conv_accelerator.v" if tiled else "sim/tb_conv_core.v")).read_text()
    def parameter(name):
        return int(re.search(r'\bparameter\s+' + name + r'\s*=\s*(\d+)\s*;', source)[1])
    return (parameter('ARRAY_SIZE'), 1 << parameter('INPUT_ADDR_WIDTH'),
            1 << parameter('OUTPUT_ADDR_WIDTH'), 1 << parameter('KERNEL_ADDR_WIDTH'))


def output_shape(c):
    P = (c['H'] + 2*c['pad_i'] - c['dilation_i']*(c['R']-1) - 1) // c['stride_i'] + 1
    Q = (c['W'] + 2*c['pad_j'] - c['dilation_j']*(c['S']-1) - 1) // c['stride_j'] + 1
    return P, Q


def fits(c, limits):
    array, input_words, output_words, kernel_words = limits
    P, Q = output_shape(c)
    return (P > 0 and Q > 0 and c['C'] <= array and c['K'] <= array
            and c['N']*c['H']*c['W'] <= input_words and c['N']*P*Q <= output_words
            and c['C']*c['R']*c['S'] <= kernel_words)


def make_cases(count, seed, random_only=False, tiled=False):
    if tiled:
        return make_tiled_cases(count, seed, random_only)
    limits = hardware_limits()
    defaults = dict(TENSOR_ARGUMENTS)
    # Batches, independent axes, long kernels, idle PEs and memory boundaries.
    directed = [defaults, *[dict(zip(NAMES, values)) for values in [
        (2,2,5,6,3,2,3,1,2,2,1,2,1),
        (2,1,8,8,2,1,1,0,0,1,1,1,1),
        (1,1,17,2,4,17,1,0,0,1,1,1,1),
        (3,3,3,4,2,1,2,0,1,1,2,1,2),
        (4,1,1,1,1,1,1,0,0,1,1,1,1),
        (1,1,1,1,1,3,3,1,1,1,1,1,1),
        (1,1,8,16,2,1,1,0,0,1,1,1,1),
        # Input and output arrays can each use their entire capacity.
        (2,2,8,16,3,1,1,0,0,1,1,1,1),
        (1,1,1,1,2,2,2,8,8,1,1,1,1),
        (1,4,8,8,2,8,8,0,0,1,1,1,1),
        (1,10,8,8,10,5,5,0,0,1,1,1,1),
        (1,1,6,7,10,2,3,1,2,2,3,2,1),
        (2,10,4,5,1,2,2,1,0,1,2,1,2),
        (1,2,3,7,3,1,3,0,2,1,2,1,3),
        (1,2,7,3,3,3,1,2,0,2,1,3,1),
    ]]]
    cases = [] if random_only else [c for c in directed if fits(c, limits)]
    rng = random.Random(seed)
    for _ in range(count):
        while True:
            c = dict(zip(NAMES, [rng.randint(1,4), rng.randint(1,limits[0]),
                rng.randint(1,12), rng.randint(1,12), rng.randint(1,limits[0]),
                rng.randint(1,5), rng.randint(1,5), rng.randint(0,4), rng.randint(0,4),
                rng.randint(1,4), rng.randint(1,4), rng.randint(1,3), rng.randint(1,3)]))
            if fits(c, limits):
                cases.append(c)
                break
    return cases


def make_tiled_cases(count, seed, random_only=False):
    defaults = dict(TENSOR_ARGUMENTS)
    directed = [defaults]
    for changes in [
        dict(N=2,C=7,K=6,H=5,W=6,R=2,S=3,pad_i=1,pad_j=2,stride_i=2,dilation_i=2),
        dict(C=7,K=6,H=3,W=200,R=3,S=3),
        dict(C=5,K=7,H=1,W=600,R=1,S=1),
        dict(C=7,K=5,H=9,W=9,R=9,S=9),
        dict(C=1,K=1,H=1,W=1,R=17,S=17,pad_i=8,pad_j=8),
        dict(C=5,K=6,H=4,W=5,R=3,S=3,pad_i=16,pad_j=16,dilation_i=16,dilation_j=16),
        dict(C=5,K=6,H=1,W=1,R=1,S=1,pad_i=2,pad_j=9,stride_i=2,stride_j=3),
        dict(N=2,C=9,K=2,H=8,W=16,R=1,S=1),
        dict(C=1,K=9,H=1,W=1,R=1,S=1),
    ]:
        directed.append({**defaults, **changes})
    source = (PROJECT / 'sim/tb_conv_accelerator.v').read_text()
    depth = 1 << int(re.search(r'\bparameter\s+MEM_ADDR_WIDTH\s*=\s*(\d+)\s*;', source)[1])
    def fits_memory(c):
        P,Q = output_shape(c)
        return P>0 and Q>0 and c['N']*c['C']*c['H']*c['W'] + c['K']*c['C']*c['R']*c['S'] + c['N']*c['K']*P*Q+32 <= depth
    cases = [] if random_only else [c for c in directed if fits_memory(c)]
    rng = random.Random(seed)
    array = hardware_limits(True)[0]
    for _ in range(count):
        while True:
            c = dict(zip(NAMES,[rng.randint(1,3),rng.randint(1,2*array+3),
                rng.randint(1,20),rng.randint(1,30),rng.randint(1,2*array+3),
                rng.randint(1,5),rng.randint(1,5),rng.randint(0,4),rng.randint(0,4),
                rng.randint(1,4),rng.randint(1,4),rng.randint(1,3),rng.randint(1,3)]))
            if fits_memory(c):
                cases.append(c)
                break
    return cases



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases', type=int, default=100, help='Random cases in addition to directed cases')
    parser.add_argument('--seed', type=int, default=20261009)
    parser.add_argument('--timeout', type=float, default=120, help='Maximum seconds per case')
    parser.add_argument('--random-only', action='store_true')
    parser.add_argument('--limit', type=int, help='Run only the first few cases')
    parser.add_argument('--out-dir', type=Path, default=PROJECT / 'sim/case_sweep')
    parser.add_argument("--tiled", action="store_true", help="Sweep complete layers through the hardware scheduler")
    args = parser.parse_args()
    cases = make_cases(args.cases, args.seed, args.random_only, args.tiled)
    if args.limit is not None:
        cases = cases[:args.limit]
    output_dir = args.out_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    failures = []
    results = []
    total_outputs = 0
    array = hardware_limits(args.tiled)[0]
    for index, config in enumerate(cases, 1):
        folder = output_dir / f'case_{index:04d}'
        folder.mkdir(exist_ok=True)
        case_seed = args.seed + index
        (folder / 'config.json').write_text(json.dumps({**config, 'seed': case_seed}, indent=2) + '\n')
        command = [sys.executable, str(PROJECT / 'run_case.py'), '--seed', str(case_seed), '--out-dir', str(folder)]
        if args.tiled:
            command.append("--tiled")
        for name in NAMES:
            command.extend([f'--{name}', str(config[name])])
        try:
            with (folder / 'run.log').open('w') as log:
                with subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                      start_new_session=True) as process:
                    try:
                        status = process.wait(timeout=args.timeout)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
                        raise
                    if status:
                        raise subprocess.CalledProcessError(status, command)
            expected = read_tensor(folder / 'output_tensor.txt')
            actual = read_tensor(folder / ('output_tensor_accelerator.txt' if args.tiled else 'output_tensor_core.txt'))
            P, Q = output_shape(config)
            if actual != expected or len(actual) != config['N']*config['K']*P*Q:
                raise ValueError('Simulated output differs from Python golden tensor')
            text = (folder / 'run.log').read_text()
            if args.tiled:
                cycle_values = [int(v) for v in re.findall(r'Layer cycles .*?: (\d+)',text)]
                metrics = re.findall(r'Backing reads: (\d+); writes: (\d+)',text)
                if len(cycle_values)!=1 or len(metrics)!=1:
                    raise ValueError('Expected exactly one completed layer')
                reads,writes = map(int,metrics[0])
                if cycle_values[0]<1 or writes!=len(actual):
                    raise ValueError('Layer cycle/output accounting mismatch')
                results.append({'case':index,'config':config,'outputs':len(actual),
                                'layer_cycles':cycle_values,'backing_reads':reads,'backing_writes':writes})
                detail=f'{cycle_values[0]} layer cycles, {reads} reads, {writes} writes'
            else:
                cycles = int(re.search(r'Run cycles .*?: (\d+)', text)[1])
                utilization = re.search(
                    r'Useful PE utilization \(channels only\): ([\d.]+)% \((\d+)/(\d+) PEs', text)
                utilization_percent = float(utilization[1])
                useful_pes, total_pes = int(utilization[2]), int(utilization[3])
                taps = config['R']*config['S']
                if cycles != 1 + array + taps*(config['N']*P*Q + 2*array) + taps-1:
                    raise ValueError('Unexpected cycle count')
                results.append({'case': index, 'config': config, 'outputs': len(actual),
                                'cycles': cycles, 'useful_pes': useful_pes, 'total_pes': total_pes,
                                'channel_utilization_percent': utilization_percent})
                detail=f'{cycles} cycles, utilization {utilization_percent:.2f}% ({useful_pes}/{total_pes} PEs)'
            if not (folder / 'sram_layout.txt').is_file():
                raise ValueError('SRAM report missing')
            total_outputs += len(actual)
            print(f'PASS {index}/{len(cases)}: N={config["N"]} C={config["C"]} K={config["K"]}, '
                  f'{len(actual)} outputs, {detail}', flush=True)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, ValueError, TypeError) as error:
            failures.append({'case': index, 'error': str(error), 'directory': str(folder)})
            print(f'FAIL {index}/{len(cases)}: {error}; see {folder / "run.log"}', flush=True)
    summary = {'cases': len(cases), 'passed': len(cases)-len(failures),
               'outputs_checked': total_outputs, 'results': results, 'failures': failures}
    (output_dir / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(f'{summary["passed"]}/{len(cases)} passed; {total_outputs} outputs checked. Results: {output_dir}')
    return bool(failures)


if __name__ == '__main__':
    sys.exit(main())
