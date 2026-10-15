# Hardware tiling — 2026-10-15

Implemented from current channel-first checkpoint 38; no old tiled source was
consulted or copied. `conv_accelerator` now owns full-layer scheduling and DMA
transfers. The backing memory is an array directly inside the system testbench,
not another RTL module.

## Implemented behavior

One layer start captures full geometry and tensor base addresses. Hardware loops
images, output-channel blocks, output rows, output-column blocks, input-channel
blocks and (when necessary) kernel taps. It loads clipped real input patches and
weights, launches the existing core, retains partial sums in output SRAM, then
reads final sums through an actual synchronous port and stores them to backing
memory. Padding zeros still come from the original address generator/feeder.
Entirely padded patches skip DMA input reads. If a full kernel or minimum dilated
footprint cannot fit, hardware uses single-tap jobs. Independent input/output/
kernel capacities and tail blocks are respected.

The DMA interface uses word addresses, one operand/result per word, enabled
one-cycle synchronous reads and edge writes. Data is consumed on the edge after
the read request. Transfers and compute are serialized. There is no AXI,
backpressure, burst protocol or physical external-memory controller. Valid,
consistent geometry, representable counts/addresses and nonoverlapping tensor
regions fitting backing memory are hardware preconditions. The bench rejects
invalid geometry and backing-memory overflow.

`conv_core` captures `cfg_continue_sum` and offers idle-only output reads sharing
the existing SRAM read port. PE/array arithmetic, controller, address generator,
feeder, weight loader, SRAM models, widths/defaults and original golden model
remain unchanged. Default tensors are preserved. A shared strict tensor reader
was extracted byte-for-byte into `sim/tensor_reader.vh`. Existing runners select
core or system mode using `--tiled`; `run_case.py` compares actual exports with
Python golden output in both modes. The generator's arithmetic is unchanged.

## Validation

- **16/16 tiled configurations**, each run twice without reset: **32 complete
  layer runs**; 16,957 output words per combined set of first runs, 33,914 actual
  full-output checks across both runs. Every intermediate partial sum is also
  independently recomputed after each local job. See [summary](tiled_cases/summary.json)
  and [log](tiled_sweep.log).
- Coverage includes C/K beyond the array, wide rows beyond input/output SRAM,
  kernel-limited channel blocks, kernels larger than kernel SRAM, large dilation,
  all-padding regions, batches and tails. Six seeded random geometries augment
  the directed cases. Configurations, seeds, tensors and logs are retained.
- **4/4 core regressions**, 440 outputs, with unchanged exact core cycle counts.
  See [summary](core_cases/summary.json).
- **Three parameter configurations**, each twice: A3 with input/output/kernel
  address widths 9/7/6 (separate output/kernel limits), and A1 with channel/output
  blocks. These check 2,996 output words per combined first run. See
  [summary](parameter_checks/summary.json).
- **Reset recovery:** abort during core RUN, then complete two 288-word layers.
  Busy-time configuration/base-address changes and busy starts are ignored.
  See [log](reset_case.log).
- **Negative store control:** deliberate corruption only of final DMA store
  data was rejected with exit 1; intermediate computations still passed. See
  [log](negative_store/run.log). Passing simulations never force DUT results or
  write local SRAM hierarchically.

The clocked backing model assigns read data nonblockingly at the request edge;
local writes consume it at the following edge. The bench checks that each local
preload follows a real read and consumes its value. It also checks bounds,
uninitialized reads, exactly-once output writes, completed reductions before
stores, input/kernel preservation, reset request suppression, done pulse width,
and matching started/completed core jobs. Layer timing is measured from actual
clock edges and checked against observed activity:

```
layer cycles = 1 + 2*output_tiles + 3*core_jobs + core_busy_cycles
                 + 2*(backing_reads + backing_writes)
```

The default A4 layer takes 1,721 cycles. The existing A10 core-only example still
takes 343 cycles; these scopes/array sizes differ and are not a speed comparison.
No synthesis, setup/hold analysis, area, power or Fmax result is claimed.

## Reproduce

With Python/Bash/Icarus available, from the implementation directory:

```sh
python3 test_cases.py --tiled --cases 6 --seed 20261024 --out-dir /tmp/cf_tiled_cases
python3 test_cases.py --cases 0 --limit 4 --seed 20261024 --out-dir /tmp/cf_core_cases
python3 run_case.py --tiled --reset-test --N 2 --C 7 --K 6 --H 5 --W 6 \
  --R 2 --S 3 --pad_i 1 --pad_j 2 --stride_i 2 --dilation_i 2 --out-dir /tmp/cf_reset
```

Validation used the existing `/tmp/im2col-tools/bin` launchers. Parameter builds
select `tb_conv_accelerator` with `-I sim`, overriding array/address widths as
recorded beside each configuration. During staged validation the optional reset
test and reset-request assertion were added; core/accelerator RTL remained
identical across all runs. A reporting-only label was then corrected: internal
cursors wrap at completion, so the SRAM dump now labels actual bank/address
values without presenting wrapped cursors as the last tile's global coordinates.
The parameter checks use the corrected label.

Checkpoints **39_before_hardware_tiling / 40_hardware_tiling** preserve source,
tensors, hashes, origin and actual validation. [Diff](CHANGES.diff) and
[validation record](VALIDATION.json) were staged before application. The
centralized/per-row implementations are untouched. Physical memory control,
transfer/compute overlap and improved halo/kernel reuse remain future work.
