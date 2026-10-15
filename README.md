# NCHW-v-NHWC-rtl

Signed convolution RTL with hardware-controlled tiling and simple external memory
modeled in each accelerator testbench. Hardware schedules loads, local jobs,
partial-sum continuation and final stores. External tensor order is NCHW/KCRS/NKPQ
in all variants; “channel-last” describes the CRS reduction and banked implicit
im2col architecture, not an NHWC tensor-file format.

| Implementation | Address generation | Accepted source |
|---|---|---|
| [Channel-first](implementations/channel_first/README.md) | Channel rows, one kernel tap per pass | CF checkpoint 44, RTL checkpoint 40 |
| [Channel-last centralized](implementations/channel_last_centralized/README.md) | Shared position/window decoding, CRS rows | CL checkpoint 08 |
| [Channel-last per row](implementations/channel_last_per_row/README.md) | Complete generator per row; synthesis may share logic | CL checkpoint 08 |

Each directory is self-contained. Requires Python 3 with numpy, Bash, and Icarus
Verilog (`iverilog`/`vvp`) supporting SystemVerilog. In the chosen implementation:

```sh
python3 run_case.py --tiled --N 2 --C 7 --K 6 --H 5 --W 6 --R 2 --S 3 \
  --pad_i 1 --pad_j 2 --stride_i 2 --dilation_i 2 --out-dir /tmp/tiled_layer
python3 test_cases.py --tiled --cases 8 --seed 20261016 --out-dir /tmp/tiled_sweep
```

Copy the implementation to a temporary directory before validation: simulation
compiles into sim/, and generators can overwrite reference fixtures. Without
`--tiled`, run a local-capacity direct-core job. Source defaults are A4/CFG32,
signed 8-bit operands, 32-bit sums, and independent 256-word local banks.

Backing memory is a testbench array with one synchronous read and edge write,
one tensor element per word. There is no AXI, backpressure, physical DRAM
controller or transfer/compute overlap. Outputs stay local until all contributions
complete. Oversized kernels/footprints use single-tap fallback.

[Fresh CL validation](reviews/2026-10-16/channel_last_tiling/REPORT.md): 18 layers
and 20 direct-core cases per variant plus independent-depth checks. CF sources
RTL matches accepted checkpoint 44 and reuses its existing evidence. The exported
CF core bench is the validated checkpoint-44 copy; local stray text was preserved
in the original workspace and omitted from this export.
Simulation does not establish physical timing closure. Historical synthesis/
measurement copies inside the CL directories are explicitly pre-tiling sources.

`SOURCE_EXPORT.json` records exact origin and hashes. `history/` includes the CL
before/after source checkpoints and accepted CF source. Detailed legacy reports
and workspace-only process notes referenced by inherited documentation are not
all included in this focused source export; immutable snapshot text is retained.

Hardware/course attribution and AI disclosures are preserved in each implementation.

## Channel-last visualization

Open [the standalone simulator](tools/channel_last_im2col_tiling/dist/index.html)
directly in a browser. It includes the full tiling schedule, selected tensor
planes, CRS systolic array, swizzled input banks, arbitration/stalls and local
partial sums. See [its README](tools/channel_last_im2col_tiling/README.md) and
[validation record](tools/channel_last_im2col_tiling/validation/REPORT.md).
