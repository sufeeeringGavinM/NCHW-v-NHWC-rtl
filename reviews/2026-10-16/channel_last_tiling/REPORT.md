# Channel-last hardware tiling — 2026-10-16

Both CL variants now wrap their original CRS-group core in `conv_accelerator`.
The CF checkpoint-44 scheduler/bench/runner are the seed for the outer scheduler,
with swizzled-bank capacity planning and input placement adapted for CL.
Checkpoint 07 preserves each exact pre-change implementation/tensors; checkpoint
08 preserves the validated result. The source defaults and reference fixtures
are retained. Centralized/per-row RTL remains byte-identical except for its
original address generator. No channel-first source was changed.

Fresh Icarus simulation in temporary source copies, using the existing runners:

| Check | Centralized | Per-row |
|---|---:|---:|
| Full layers: 10 directed + 8 random, seed 20261016 | 18/18, 12,661 outputs | 18/18, 12,661 outputs |
| Direct cores: 16 directed + 4 random, seed 20261016 | 20/20, 4,668 outputs | 20/20, 4,668 outputs |
| Independent-depth directed layers | 6/6 | 3/3 |

Tiled cases cover C/K beyond the array, output-row/width tails, batch, signed
values, padding, stride/dilation, entirely padded jobs, huge kernel/footprint
fallback and retained sums. Both variants have identical full-layer cycles and
backing transfer counts for matched cases. The default layer takes 1,865 clocks,
576 backing reads and 32 stores on the A4 build. Core regressions retain the
existing golden-output, measured stall/cycle equation and bank-memory checks.
The A1 build uses input/output/kernel address widths 2/1/1; A3 uses 3/2/4.
Three layers on each small build check different axes, dilated fallback, full
kernels, width tails and empty patches. All completed outputs matched the
independent signed testbench reference and Python golden tensor. Summaries,
configurations and logs are adjacent; `edges/` retains the parameterized checks.

Reproduction (run in a source copy, with Python 3/numpy, Bash, Icarus available):

```sh
python3 test_cases.py --tiled --cases 8 --seed 20261016 --out-dir /tmp/cl_tiled
python3 test_cases.py --cases 4 --seed 20261016 --out-dir /tmp/cl_core
```

Scope: one reset/start/completed layer per system-bench invocation. No new
reset-abort/busy-descriptor/consecutive-layer verification or exhaustive RTL
proof is claimed. SRAM-like memory has fixed synchronous latency, no bandwidth
backpressure, no transfer overlap and no physical external-memory controller.
No synthesis, area, power, Fmax or physical timing closure was performed. The
`synthesis/` measurement copies and old physical reports remain historical.
