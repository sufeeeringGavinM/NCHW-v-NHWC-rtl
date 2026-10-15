# Architectural decisions: per_row

All entries below were accepted for the implementation/comparison requested on
2026-10-14. Source establishes behavior; README describes the current contract.

1. Preserve the parent's geometry conventions, logical tensor files, signed
   arithmetic, SRAM capacities, square array and two stationary weights per PE.
2. Flatten the reduction in CRS order; map consecutive terms to physical rows
   and accumulate contiguous reduction groups in output SRAM.
3. Use residue-swizzled input placement instead of simple linear modulo banking,
   so the paper's complete unit-stride window example can be conflict-free.
   Partial spatial tiles can waste storage slots; the fit predicate accounts for it.
4. Model one synchronous read per input bank per clock. Serialize distinct
   addresses, broadcast identical addresses and mask padding before arbitration.
5. Keep two vector slots. Freeze every compute/skew/writeback stage together
   while waiting; continue independent weight loading. Do not invent fixed
   conflict penalties or reuse the channel-first fixed physical pass duration.
6. Each row instantiates a complete row_addr_gen including batch/position decoding, window origin and bank mapping. Normal synthesis is free to merge identical logic across rows.
7. Match bank placement, arbitration, FIFO depth and all compute/control sources
   between centralized and per-row variants. Do not add KEEP/DONT_TOUCH or
   hierarchy barriers to force an artificial difference.
8. Compare physical builds with ARRAY_SIZE=10, CFG_WIDTH=9, signed 8-bit operands,
   32-bit accumulators and eight-bit SRAM addresses. Keep source defaults at
   CFG_WIDTH=32 and validate both build widths.
9. Retain independent pre-change seed and validated post-change checkpoints in
   `history/channel_last_per_row`. Apply the same lifecycle to future implementations.
10. Treat Vivado LUT/FF/DSP/BRAM counts as FPGA resources, not ASIC square microns.
    Label power activity/coverage and estimates. Report actual routed timing
    and do not assume a requested frequency is achievable.

Deferred: transfer/compute overlap, packed images,
divide-free or pipelined address arithmetic, actual SRAM macro implementation,
post-processing and register-bus configuration interfaces.

11. 2026-10-16: Add the CF-style hardware scheduler and serialized SRAM-like
    backing interface to both CL variants. Adapt capacity planning and input
    DMA to residue-swizzled storage; keep the CL core's CRS groups and stalls.
12. Keep resident output sums across local jobs via captured continuation and
    synchronous idle readback. Keep the backing array in the one-layer bench.
    Full-kernel jobs retain weight prefetch; single-tap fallback bounds oversized
    kernels/footprints. No transfer overlap or off-chip partial sums.
13. Keep synthesis/ sources as the historical comparison measurement copy. They
    are not the new tiled accelerator; new physical measurements need a separately
    validated wrapper/build. Checkpoints 07/08 preserve before/after sources.
