# CL visualization repair — 16 October 2026

The existing CL model has been retained. SHA-256 checks confirm engine.js and
tiling.js are byte-identical to the accepted checkpoint-01 sources, and every
reference RTL file matches active centralized checkpoint 08. Comparing the two
active CL RTL folders finds only im2col_addr_gen.v differs; its centralized and
per-row forms implement the same equations. One visualizer represents both.

The repair restores the working CF SVG stacks, four-value previews, moving
numeric operands, source-coordinate linking, dense memory views, and complete
window controls. CL details are adapted to CRS rows, residue-swizzled banks,
actual grants/retries, two vector slots and array-wide stalls. Full schedule
input/kernel/output masks, per-tensor fronts and Next stage controls are shared
with CF. All tensor cells/channels are represented; memory words are paged.

## New staged checks

- `visual-details.cjs`: **134 states**, **8,112 local tensor cell checks**,
  **106 advancing / 28 held clocks**, **7 retry rounds**, **124 padding operand
  observations**. Group/input masks, bank grants/retries and vector-slot values
  match the model. Current PE coordinate/value identities match its valid tokens.
- **753 moving operands** match actual PE activation/forwarding values and exact
  PE/register animation destinations. No activation tokens move on held clocks;
  **14 stalled clocks** still show actual independent weight shifts.
- **95 queued operands** and their exact future entry edges match complete model
  traces, including row skew, padding and background weights. Forecasting leaves
  the live model byte-for-byte unchanged.
- Additional checks retain all **14 input planes / 42 kernel planes** for a
  seven-channel/two-image/six-filter configuration, and **578 input cells** for
  a 17×17 two-channel tensor. There is no five-plane/256-cell clipping. Physical
  bank counts, global source links/locator, group RUN seeking and mobile pass.
- `tile-selection.cjs`: **285 states / 57,256 full source cells**, including
  **85 empty-patch states**, pass masks and values for every job of the tiled,
  fallback, empty-padding and padding/dilation presets. Front/spread, block
  navigation, shared tabs, replay, Minimal text and 390px layout pass.
- `output-and-stages.cjs`: **45 high-level phase boundaries / 576 output cells**
  pass, including independently recomputed first-block sums, continuation,
  final stores, blank new tiles, per-image/filter fronts and stage skipping.
- `browser.cjs`: all **nine original CL presets** complete with matching outputs
  and layer clocks. Shared tabs, stage/group/job seeking, back/reset/play,
  PE/module inspection, source links, both memory views, reference values,
  full-tensor editing/export/errors, floating maximize and Minimal text pass.
  Desktop 1440px and mobile 390px have no page errors or horizontal page overflow.
- `local-image.cjs`: the detail selector exposes exactly one local image and
  correctly labels global image 0 and 1 during sequential tiled execution.

Desktop/mobile screenshots, a selected tile panel, and a live bank-conflict
frame were inspected. The conflict frame shows the losing row requesting a
second address in an already-read bank, a ready consumer slot, and a different
filling producer slot. No vector is consumed on its just-returned ready edge.

## Accepted evidence reused

The existing 28 model-layer checks and 8,900 RTL trace edges / 2,260 backing
transfers / 1,368 local output writes remain applicable to the unchanged model.
See REPORT.md, original rtl-fixtures.json, check.cjs, trace.cjs and source hashes.
These dedicated arithmetic/RTL flows were not rerun for this presentation repair.
Normal browser completion also verifies its nine current teaching layers.

No hardware, fixture/generator/bench, capacity, signed precision, CF source or
physical build was changed. No full internal-signal equivalence, reset-abort,
consecutive-layer lifecycle or physical timing result is claimed.

Checkpoints: 02_before_visual_repair → 03_repaired_visualization. The old UI and
its earlier evidence remain immutable in 00/01/02.
