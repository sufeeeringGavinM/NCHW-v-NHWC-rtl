# Current status — 2026-10-15

Canonical workspace: **C:\Users\RageAgainstW10\eda\designs\196**.
Reuse this context; read reports/history only for a relevant question.

- CF now has hardware-owned row/channel/tap tiling and serialized DMA in
  conv_accelerator, checkpoint 40_hardware_tiling (before: 39, seed: 38).
  Backing memory is only an array in tb_conv_accelerator, with one-cycle enabled
  reads and edge writes. No AXI or physical external-memory controller.
- CF conv_core retains direct local jobs, adds captured sum continuation and
  synchronous idle-only output readback. Larger layers are handled by hardware;
  local SRAM capacities and source precision/defaults remain unchanged.
- Centralized/per-row implementations remain at their restored pre-tiling cores
  from 03_before_tiled_dma, with no new scheduler or DMA changes.
- Existing signed arithmetic, PE weight double buffering, batch/geometry support,
  and channel-last bank arbitration/buffering/stalls remain. Source defaults are
  A4/CFG32; matched core comparisons use A10/CFG9, 8-bit operands/32-bit sums.
- Rollback checkpoints: CF35_before_pretiling_restore / 36_restored_pretiling;
  both CL05_before_pretiling_restore / 06_restored_pretiling. Prior archives are
  unchanged; full replaced folders are also preserved in im2col_restore_backups.
- Fresh restoration checks use the existing directed + 8 random-case core sweeps,
  checking golden outputs, cycle equations and SRAM/conflict accounting. Exact
  seed/source hashes and actual summaries are retained in the new checkpoints.
- [Vivado core report](im2col_comparison/comparison/REPORT.md) is the historical
  pre-tiling FPGA comparison. Its measurement wrappers expose output memories.
- [SKY130 tiled report](im2col_sky130_comparison/REPORT.md) and later CVC SDF tests
  describe archived tiled hardware, not the restored active cores. Their physical
  violations and estimate limitations remain; no timing closure/Fmax is claimed.
- No synthesis/physical flow rerun or background continuation is pending. Copies
  under C:\Users\RageAgainstW10\196 remain separate exports. Raw evidence stays
  on G:. Do not resume the stopped migration or silently restore tiled helpers.

- CF validation fixes: strict known tensor data/shape/count checks, fatal unknown
  results/file-open failures, watchdog, Python test exit status and kernel-fit
  test correction. Second RTL review and edge checks found no new RTL defect.
  [Validation record](channel_first_validation_fixes_20261015/REPORT.md) records
  completed checks and the sweep stopped at the user's request. This validation batch preceded hardware tiling.

- [CF hardware-tiling record](channel_first_tiling_20261015/REPORT.md): 16 tiled
  cases run twice, four core regressions, independent-depth/A1 checks and reset
  recovery passed. No physical timing closure claimed; no background run pending.
