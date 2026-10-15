# Implementation and comparison reference

Load only the sections needed for the current change. These rules cover all current and future im2col
implementations. Each lives in a self-contained sibling folder with a README,
DECISIONS.md and independent immutable archive:

| Implementation | Archive |
|---|---|
| channel_first_im2col_implementation | im2col_versions |
| channel_last_im2col_centralized_implementation | channel_last_im2col_centralized_versions |
| channel_last_im2col_per_row_implementation | channel_last_im2col_per_row_versions |

## Context and scope

- Consult only for implementation changes or comparison work, not every turn.
  Read relevant implementation README/DECISIONS sections and affected source.
  Inspect archive manifests only when history matters. Active source establishes
  behavior; reports and old notes may describe earlier versions.
- Announce intended edits. Stage the diff and appropriate validation outside
  active sources before applying. Obtain approval unless the user has already
  authorized that batch; do not ask again for the same work. Advice alone does
  not authorize implementation. Documentation-only edits need no functional checkpoint.
- Preserve user-selected dimensions, precision, depths and defaults unless the
  request changes them. Leave unrelated designs and old checkpoints untouched.
  Preserve attribution, AI disclosures and course material in conv_golden.py.
- Keep code/comments about current behavior, rationale in DECISIONS.md and
  history in archives. Avoid unnecessary wrappers, scripts and defensive tests.

## Design contracts

- Use tensor shapes (N,C,H,W), (K,C,R,S), (N,K,P,Q); i/j mean height/width.
  Use pad_i/j, stride_i/j, dilation_i/j, conv_datapath, PE, ROW_INDEX/COL_INDEX.
  Distinguish tensor-file order, bank selection and within-bank addressing;
  do not impose channel-first mapping assumptions on other architectures.
- Verify mapping and timing in each implementation's source. Preserve signed
  operands, ACC_WIDTH wraparound, independent input/kernel/output capacities,
  PE-local weight double buffering and commit-before-buffer-switch ordering.
  Reset does not clear SRAM. Live acc_col_out is not stored-output readback.
- CF provides conv_accelerator for hardware row/channel/tap tiling and
  serialized backing-memory transfers. Its SRAM-like memory model is inside
  tb_conv_accelerator only. conv_core adds explicit sum continuation and idle
  synchronous output readback; direct jobs still fit local capacities.
  CL implementations remain restored pre-tiling cores with testbench preloads.
  Source defaults remain A=4/CFG=32; historical matched core builds used A=10/CFG=9.
  The new CF interface has no AXI, backpressure or physical memory controller.
  Historical tiled/DMA reports still describe their archived sources, not this
  new implementation. See the CF README and checkpoint 40 for its actual scope.

## Checkpoints: every implementation, including future ones

- Before behavioral RTL, generator/testbench, synthesis-wrapper, arithmetic,
  mapping/arbitration/stall, or activity-generation changes, archive exact current
  sources and reference tensors. After validation, archive the resulting state.
  Stage checkpoint contents with the diff; apply before/edit/after in that order.
- Inspect archive tips; allocate the next independent number. Never overwrite
  milestones. Record hashes, origin, reason and validation actually performed;
  update archive README/provenance. Label reconstructed history explicitly.
- New derivatives first checkpoint inherited source/tensors as a seed with
  origin/hashes; new projects record their initial state. Then archive the first
  validated implementation. Do not alter the parent's history.
- Include documentation, configs, runners, constraints and activity sources;
  exclude binaries, caches, sweeps, waveforms and physical build outputs.

## Validation and reporting

- Use existing run_case.py / sim/tb_conv_core.v and test_cases.py.
  Validate in staging: runners regenerate fixtures and simulator binaries.
  For refactors compare outputs and cycles; check affected memory/protocol
  behavior and real conflict/stall/retry accounting. Keep widths consistent
  across RTL, testbench and Python. Documentation edits need factual/link checks.
- Match technology/part, array, widths, capacities/ports/latencies, tools,
  optimization, constraints, workloads and activity conditions across comparisons.
  Allow the same normal optimization; report the actual synthesized top/scope.
- Distinguish compute/job/whole-layer cycles, physical timing and power estimates.
  State activity coverage and limitations; simulation is not timing closure.
  Final-netlist bank-counter zeros are unavailable placeholders, not measurements.
  Inspect failures before diagnosing; timeouts alone do not prove wrong RTL.
- Reuse accepted evidence while its inputs still match. Inspect owned workers
  before launches; avoid duplicate/heavy concurrent jobs. Do not rerun completed
  flows for a status check. Report changes, checks, limits and checkpoint numbers.
