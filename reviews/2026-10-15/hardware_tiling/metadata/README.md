# im2col development milestones

The first three standalone projects capture the main architecture stages of the design.
Subsequent numbered checkpoints preserve the working project before and after changes.
Each has its own RTL, testbenches, scripts, Python golden model, and tensor fixtures.
The active project is [channel_first_im2col_implementation](../channel_first_im2col_implementation/README.md);
`cleaner_MMU_sram_per_row` remains a separate project.
The active directory was renamed from `im2col_add_gen_MMU` on 2026-10-14.
Captured checkpoint contents and provenance retain their historical source names and paths.

| Version | Tap loading and sequencing | Geometry | Logical channels | Memory banks |
|---|---|---|---|---|
| [01_testbench_taps](01_testbench_taps/README.md) | Testbench supplies each tap to MMU | Compile-time | `C=K=ARRAY_SIZE` | `ARRAY_SIZE` input/output banks |
| [02_conv_core_compiletime](02_conv_core_compiletime/README.md) | `conv_core` reads kernel banks and controls passes | Compile-time | Independent `C,K <= ARRAY_SIZE` | `ARRAY_SIZE` input/output banks + `K` kernel banks |
| [03_conv_core_runtime](03_conv_core_runtime/README.md) | `conv_core` reads kernel banks and controls passes | Captured from `cfg_*` ports on `start` | Independent runtime `C,K <= ARRAY_SIZE` | `ARRAY_SIZE` input/output banks + `ARRAY_SIZE` fixed-capacity kernel banks |
| [04_runtime_unsigned_checkpoint](04_runtime_unsigned_checkpoint/README.md) | Hardware-controlled taps; exact working source before signed arithmetic | Runtime | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [05_runtime_signed](05_runtime_signed/README.md) | Hardware-controlled taps; signed convolution | Runtime | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [06_signed_metrics_checkpoint](06_signed_metrics_checkpoint/README.md) | Signed core with cycle counting and useful-PE metrics | Runtime | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [07_before_pe_weight_buffers](07_before_pe_weight_buffers/README.md) | Exact working source before restart; superseded whole-kernel SRAM buffering | Runtime | Independent runtime `C,K <= ARRAY_SIZE` | `3*ARRAY_SIZE` |
| [08_pe_weight_buffers](08_pe_weight_buffers/README.md) | Two stationary weight registers per PE; next-tap loading overlaps computation | Runtime | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [09_before_interleaved_images](09_before_interleaved_images/README.md) | Exact working source before image interleaving | Runtime; `N=1` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [10_interleaved_images](10_interleaved_images/README.md) | Double-buffered PE weights; separate-word interleaved images | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [11_before_single_test](11_before_single_test/README.md) | Exact source before test-suite consolidation | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [12_single_conv_test](12_single_conv_test/README.md) | One tensor-file core test with metrics and SRAM reporting | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [13_before_shared_arguments](13_before_shared_arguments/README.md) | Exact source before shared geometry arguments | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [14_shared_arguments](14_shared_arguments/README.md) | One tensor-file test; shared Python generation/simulation arguments | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [15_before_case_sweep](15_before_case_sweep/README.md) | Exact source before Python case sweep | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [16_case_sweep](16_case_sweep/README.md) | One tensor-file test with directed/random Python case sweep | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [17_before_per_pe_wires](17_before_per_pe_wires/README.md) | Exact source before unpacking internal PE connections | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [18_per_pe_wires](18_per_pe_wires/README.md) | Unpacked per-PE nets and registered column outputs | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [19_before_sweep_utilization](19_before_sweep_utilization/README.md) | Before Python sweep utilization reporting | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [20_sweep_utilization](20_sweep_utilization/README.md) | Per-case channel utilization in terminal and JSON | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [21_before_module_split](21_before_module_split/README.md) | Before extracting RTL modules | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [22_module_split](22_module_split/README.md) | Separate PE grid, channel-bank components, kernel banks and weight loader | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [23_before_module_ownership](23_before_module_ownership/README.md) | Before relocating module responsibilities | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [24_module_ownership](24_module_ownership/README.md) | Feeder skew, local writeback timing, separate convolution controller | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [25_before_batch_address](25_before_batch_address/README.md) | Before moving batch decoding into the address generator | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [26_batch_address](26_batch_address/README.md) | Batch-aware im2col SRAM address generation | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [27_before_split_sram](27_before_split_sram/README.md) | Before separating input and output SRAM | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `2*ARRAY_SIZE` |
| [28_split_sram](28_split_sram/README.md) | Separate input, output and kernel SRAM arrays | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `3*ARRAY_SIZE` |
| [29_before_memory_owners](29_before_memory_owners/README.md) | Before SRAM ownership and independent address widths | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `3*ARRAY_SIZE` |
| [30_memory_owners](30_memory_owners/README.md) | Feeder/accumulator own SRAM, independent address widths | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `3*ARRAY_SIZE` |
| [31_before_module_names](31_before_module_names/README.md) | Before module naming cleanup | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `3*ARRAY_SIZE` |
| [32_module_names](32_module_names/README.md) | conv_datapath and PE module names | Runtime, including `N` | Independent runtime `C,K <= ARRAY_SIZE` | `3*ARRAY_SIZE` |

Versions 1–9 use `N=1`; versions 10 onward support runtime batches. All versions use
independent padding/stride/dilation axes, full
`ACC_WIDTH` SRAM outputs, and stationary weights in a square PE array.
Versions 1–4 use unsigned arithmetic; versions 5 onward use signed two's-complement
operands, sign-extended input SRAM words, and signed reference calculations.
The runtime core accepts software-derived `P,Q`. Array size, word widths, and
memory capacities are fixed hardware parameters.

## Reconstruction provenance

Version 1 uses the retained full-precision RTL draft from before hardware tap
loading. It implements im2col addressing and SRAM accumulation on the
`cleaner_MMU_sram_per_row` array architecture. Its tensor testbench is adapted
from the later simple manual-tap test to keep the sane-input test flow.

Version 2 uses the retained final compile-time RTL and testbench drafts from
before the runtime conversion. It includes refinements made after the first
`conv_core`: independent logical input/output channels and SRAM layout reporting.

Version 3 captures the first runtime RTL and testbench milestone. It has no batch
sequencing. Runtime writeback is bounded to the configured output plane.

These are reconstructed runnable milestones, not byte-for-byte archives of
three past directory states. Recovered RTL is copied verbatim. Testbench and
fixture defaults are aligned to the same 4x4-array example in all three folders;
shared generator/golden-model and runner sources come from the current project.
Generated netlists, waveforms, simulator binaries, and physical-design outputs
are not part of these source snapshots.

`PROVENANCE.json` records the source locations and SHA-256 hashes of recovered
RTL. Source snapshots can be retained or committed independently of the original
working project.

## Running the examples

From each version directory:

```bash
python3 gen_matrices.py --seed 0
bash run_rtl.sh
bash run_tensor.sh
```

Versions 2 and 3 also provide `bash run_conv.sh`. Version 3 provides
`bash run_runtime.sh` for seven differently configured jobs on one core without
resets. The included example tensors give 64 output values. Tensor tests check
computed SRAM results; `sim/output_tensor.txt` is the Python golden reference.

## Ongoing checkpoints

Version 4 preserves the exact working sources and reference tensors immediately
before signed arithmetic. Version 5 preserves the validated signed implementation.
These checkpoints retain the user's current defaults rather than aligning them
to the example defaults of versions 1–3. Their `SNAPSHOT.json` files record source
hashes and validation details. The workspace root's `AGENTS.md` establishes the
checkpoint workflow for subsequent changes.

Keep existing checkpoint folders immutable. For each functional change, add a
numbered checkpoint before editing, then another after validation, and update
this overview and `PROVENANCE.json`. Simulator binaries, waveforms, caches, and
physical-design build outputs are regenerated rather than archived.

Version 6 captures the signed working project with the cycle-counting and
channel-based useful-PE measurements added after version 5. It preserves the
user-selected dimensions and includes source hashes in `SNAPSHOT.json`.


Version 7 preserves the working files before restarting from version 6. It
captures the superseded whole-kernel SRAM buffering implementation as a rollback
point.

Version 8 is based on version 6 and gives each PE two stationary weight
registers. The controller loads the next tap into the inactive registers while
the current tap computes, then switches registers after the current pass drains.
There is one clearing cycle between taps. Kernel SRAM remains one bank per
physical column. `bash run_double_buffer.sh` verifies register contents, loading
overlap, tap switching, signed results, and exact run-cycle counts.


Version 9 preserves the exact working source before separate-word image
interleaving. Version 10 captures runtime `N`: each tap streams images at each
spatial output position, using SRAM addresses `(h*W+w)*N+n` for inputs and
`N*H*W+(p*Q+q)*N+n` for outputs. The tensor files retain NCHW/KCRS/NKPQ order.
The twelve-job runtime and PE-buffer tests cover N=1,2,3,4, including an exact
SRAM-capacity batch. Earlier checkpoint folders remain unchanged.


Version 11 retains the five-testbench suite and its runners before consolidation.
Version 12 has one testbench, `sim/tb_conv_core.v`, and one runner, `run.sh`.
Generate tensors with `python3 gen_matrices.py --seed 0`, then run `bash run.sh`.
It preloads SRAM, runs the complete hardware-controlled convolution, prints
cycle and useful-PE metrics, checks outputs, and writes the output tensor and
all post-run SRAM contents. The previous tests remain available in version 11.


Version 13 preserves the generator and single-test runner before shared geometry
arguments. Version 14 adds geometry flags to `gen_matrices.py` and `run_case.py`,
which generates tensors and passes the same configuration to the testbench.
Run `python3 run_case.py --help` for the available arguments. Defaults, fixed
hardware parameters, RTL, testbench and tensor file layouts remain unchanged.


Version 15 preserves the shared-argument runner before the sweep script.
Version 16 adds `test_cases.py`, which repeatedly invokes `run_case.py` with
valid directed and seeded random configurations. It checks Python golden
outputs and cycle counts, retains each case's logs and artifacts, and writes
a pass/failure summary. The project still has one RTL testbench.


Version 17 preserves the packed internal PE interconnect. Version 18 represents
each activation, weight and partial-sum connection as an unpacked word-sized
net and registers each output column independently. Runtime geometry, memory
layout, external ports and cycle counts are preserved. Its full 114-case sweep
passed, checking 18117 outputs against the generated Python golden tensors.


Version 20 includes useful/total PE counts and channel utilization in the Python
sweep terminal output and per-case `summary.json` results. All 14 directed cases
passed, including the 100 percent channel occupancy case.


Version 22 separates the systolic array, activation feeding, output accumulation,
kernel storage and weight loading into modules. All 114 sweep cases passed with
identical final output tensors and SRAM contents to the pre-refactor implementation.
External ports, memory capacities, layout, and cycle counts are preserved.


Version 24 places row skew in the activation feeders, writeback counters in the
output accumulators, and tap/run sequencing in a separate convolution controller.
The full 114-case sweep checks the old and new cores side by side, matching
control and column outputs cycle by cycle and all SRAM contents at completion.


Version 26 places batch decoding and the full interleaved input SRAM address
in im2col_addr_gen. The MMU retains stream-position sequencing and prefetch timing.
All 114 side-by-side cases match control and column outputs cycle by cycle,
and every SRAM word at completion.


Version 28 uses separate operand-width input and accumulator-width output SRAM
arrays. Both start at zero and retain the configured address depth. Each active
input array holds N*H*W words and each active output array holds N*P*Q words.
The 116-case sweep verifies golden outputs, unchanged cycle counts and input
preservation; compatible cases also match the shared-SRAM baseline cycle by cycle.


Version 30 gives the activation feeders ownership of input SRAM and the output
accumulators ownership of output SRAM. The channel wrapper is removed; physical
indices use ROW_INDEX/COL_INDEX, and the generic memory module is sram. Independent
input/output address widths retain their original defaults. All 116 baseline
cases match cycle by cycle and in every SRAM word; two unequal-depth cases
also pass golden-output, input-preservation and cycle checks.


Version 32 renames MMU to conv_datapath and MAC to PE throughout active
sources, documentation and synthesis configuration. All 116 convolution cases
retain identical output tensors, SRAM reports and cycle counts.

## Tiled DMA / SKY130 update

- 33_before_tiled_dma: exact active source before this batch.
- 34_tiled_dma_sky130: validated retained sums, readback, DMA and comparison sources.

## 2026-10-15: pre-tiling restoration

- `35_before_pretiling_restore` preserves the replaced tiled source.
- `36_restored_pretiling` restores `33_before_tiled_dma` exactly; 24/24 core cases passed.

## Validation corrections — 2026-10-15

[37_before_validation_fixes](37_before_validation_fixes/README.md) preserves the
exact pre-audit-fix source and reference tensors.
[38_validation_fixes](38_validation_fixes/README.md) rejects invalid/unknown tensor
data and results, fails report opens and stalled jobs, propagates Python self-test
failures, corrects the kernel-fit test, and aligns saved fixtures to defaults.
RTL modules remain byte-identical to checkpoint 36. Source hashes, actual partial
sweep scope and targeted validation are recorded in the snapshot manifests.

## Hardware-owned CF tiling — 2026-10-15

[39_before_hardware_tiling](39_before_hardware_tiling/README.md) preserves the
validated pre-tiling source and default tensors from checkpoint 38.
[40_hardware_tiling](40_hardware_tiling/README.md) adds conv_accelerator with
hardware row/channel/tap scheduling, serialized SRAM-like transfers, retained
sums and synchronous output readback. Backing memory exists only inside the
system testbench. Before/after source hashes, origin and actual validation are
recorded in the snapshots. Old tiled sources were not reused; no physical
implementation result is claimed for this new top.
