# Validation — 15 October 2026

All work was staged outside the active simulator. Only the new
`tools/channel_first_im2col_tiling` folder is applied. Parent simulator sources are checked against their inherited hashes. Reference
files match checkpoint 42 exactly, and all reference RTL also matches active
checkpoint 44. Its later bench/runner simplification does not change RTL.

## Model and existing hardware evidence

`node validation/check.cjs` passed **86 valid cases**: 12 retained RTL fixtures
and 74 directed/generated cases from a seed-196 candidate set. Invalid geometry
and over-limit candidates are excluded. Checks cover **7,132 final outputs**,
**24,614 intermediate sums** and **298,913 modeled edges**, exact layer cycle
counts, job start offsets, transfer totals and next-edge DMA consumption.
A direct-core signed case also passes, and invalid configurations are rejected.
Coverage includes independent SRAM capacities, A1, C/K tails beyond A, batches,
width tiling, kernel-capacity channel limits, dilated input footprint fallback,
entirely padded patches and signed operand extremes.

The 12 hardware fixtures retain original signed inputs/weights, actual RTL
outputs, job/tile counts and layer cycles from
`reviews/2026-10-15/hardware_tiling/tiled_cases`. Cases 3/4 exceed the existing
32-dimension UI bound; cases 12/16 exceed the 30,000-clock bound, so those four
are not imported. Copied active RTL matches that hardware-tiling design; bench
checkpoint 42 only reformats checkpoint-40 behavior. Existing accepted hardware
results are reused for these fixtures; their RTL flows were not rerun.

## Fresh targeted RTL traces

The checkpoint-42 `run_case.py --tiled` verification runner was run against
the staged exact reference, with Icarus provided through `/tmp/im2col-tools/bin`. Each existing
bench invocation runs the same layer twice without resetting. Both runs passed
full outputs, independent intermediate sums and the bench's memory protocol checks:

| Case | Geometry/build | Layer cycles | Jobs | Reads | Stores |
|---|---|---:|---:|---:|---:|
| Full kernel | A4, N1 C4 K2 H6 W6 R3 S3, all depths 256, seed 196 | 1721 | 4 | 576 | 32 |
| One-tap fallback | A4, N1 C1 K1 H1 W1 R17 S17, pad 8/8, depths 256, seed 197 | 5498 | 289 | 290 | 1 |

`rtl-default.log` and `rtl-fallback.log` retain actual runner output. Only the
first layer of each waveform is imported: **7,221 rising edges**, including the
accepted start edges, and **899 backing-memory transfers**. The second RTL run
is bench evidence, not a modeled consecutive-layer comparison.

`node validation/trace.cjs` passed every scheduler/core FSM state and completion
edge, every backing read/write address (relative to the corresponding tensor
base), every output store value, local input/kernel write bank/address/value,
and local job descriptors during WAIT_CORE. The fallback trace includes empty
patches. Base offsets deliberately differ between browser teaching memory and
the bench; both retain the exact NCHW/KCRS/NKPQ word offsets.

Reproduce from a temporary hardware-reference copy with dependencies available:

```sh
python3 run_case.py --tiled --seed 196 --out-dir /tmp/cf_tiling_rtl_default --wave-file /tmp/cf_tiling_default.vcd
python3 run_case.py --tiled --N 1 --C 1 --K 1 --H 1 --W 1 --R 17 --S 17 --pad_i 8 --pad_j 8 --seed 197 --out-dir /tmp/cf_tiling_rtl_fallback --wave-file /tmp/cf_tiling_fallback.vcd
```

`capture-rtl-trace.py default|fallback VCD TENSOR_DIR OUTPUT_JSON` extracts the
first-layer checked signals. Retained trace JSON contains its exact input and
kernel tensors and RTL output. Raw waveforms and compiled binaries are excluded
from the derivative and checkpoints.

## Browser

`node validation/browser.cjs` passed in installed Edge through bundled Playwright:

- Nine presets complete and match references in the schedule tab; the detail
  tab retains exactly A×A PEs. Switching tabs preserves edge/job/state.
- Prepared-job and local-tap seeking; back/reset; shared playback; finish layer.
- Operand motion and stationary register displays; both input SRAM views;
  bank counts; tensor spreading; PE/module selection; global resident-source
  readouts and exact linked tensor highlights; resident reference values.
- Full-layer tensor edits/resizing/randomization, C>A acceptance, invalid paste
  and address-width errors, and full-layer JSON download with correct shapes.
- Floating maximize, tab switching above maximized windows, Minimal text,
  390px schedule/detail layouts without horizontal page overflow, no JS errors.

Desktop and mobile screenshots of both tabs were inspected and are retained.
The original layout, arithmetic presentation, motion paths, dense banks and
window interactions remain inherited; passing historical browser suites are
not relabeled as new exhaustive checks. The new suite exercises affected paths.

## Limits

This is a bounded browser teaching model. It does not prove equivalence of every
internal signal/register on every edge. It models one accepted full layer and
retains local SRAM between its jobs; replay/reset constructs fresh browser memory.
RTL reset-abort and consecutive full-layer memory lifecycles are not modeled.
No synthesis, physical timing closure, area, power or Fmax claim is made.

## Full-tensor tile selection — 16 October 2026

See [tile-selection.md](tile-selection.md): 217 rendered states / 23,390 cells
passed exact full-input/full-kernel selection/value checks, with 78 empty-patch
states. The existing nine-preset browser regression also passed. Unchanged
engine/scheduler/detail-view hashes reuse the arithmetic and RTL evidence above.

## Output tiles and schedule stages — 16 October 2026

See [output-and-stages.md](output-and-stages.md): 45 phase boundaries and
576 output-cell checks passed, including independent partial sums, final stores,
new-tile validity, per-tensor fronts and mobile/shared-clock controls. The
217-state source-mask suite and nine-preset browser regression also pass.
Unchanged engine/scheduler hashes reuse the accepted arithmetic/RTL evidence.
