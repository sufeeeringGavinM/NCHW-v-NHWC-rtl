"""Generate tensors and simulate the convolution with the same configuration."""
from pathlib import Path
import subprocess
import sys

from gen_matrices import TENSOR_ARGUMENTS, create_parser


def read_tensor(path):
    return [int(word, 16) for line in path.read_text().splitlines()
            for word in line.split("//", 1)[0].split()]


def main():
    parser = create_parser()
    parser.description = __doc__
    parser.add_argument("--wave-file", type=Path,
                        help="Optional waveform output path")
    parser.add_argument("--tiled", action="store_true",
                        help="Run the hardware scheduler with testbench backing memory")
    parser.add_argument("--reset-test", action="store_true",
                        help="In tiled mode, abort an initial layer with reset before the normal runs")
    args = parser.parse_args()
    if args.reset_test and not args.tiled:
        parser.error("--reset-test requires --tiled")
    project = Path(__file__).resolve().parent
    output_dir = args.out_dir.resolve()

    generator_args = []
    simulation_args = []
    for name, _ in TENSOR_ARGUMENTS:
        value = str(getattr(args, name))
        generator_args.extend([f"--{name}", value])
        simulation_args.append(f"+{name}={value}")

    subprocess.run(
        [sys.executable, str(project / "gen_matrices.py"), *generator_args,
         "--seed", str(args.seed), "--out-dir", str(output_dir)],
        cwd=project, check=True,
    )
    actual_file = output_dir / ("output_tensor_accelerator.txt" if args.tiled else "output_tensor_core.txt")
    simulation_args.extend([
        f"+INPUT_FILE={output_dir / 'input_tensor.txt'}",
        f"+KERNEL_FILE={output_dir / 'kernel_tensor.txt'}",
        f"+OUTPUT_FILE={actual_file}",
        f"+SRAM_LAYOUT_FILE={output_dir / 'sram_layout.txt'}",
    ])
    if args.wave_file is not None:
        simulation_args.append(f"+WAVE_FILE={args.wave_file.resolve()}")
    if args.reset_test:
        simulation_args.append("+RESET_TEST=1")
    subprocess.run(["bash", str(project / "run.sh"),
                    *(["--tiled"] if args.tiled else []), *simulation_args],
                   cwd=project, check=True)
    if read_tensor(actual_file) != read_tensor(output_dir / "output_tensor.txt"):
        raise ValueError("Simulated output differs from Python golden tensor")


if __name__ == "__main__":
    main()
