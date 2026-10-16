# Output tiles, independent fronts and stage stepping — 16 October 2026

The schedule selection now includes full NKPQ output stacks alongside the input
and kernel stacks. Each image groups K output planes. Grey cells select the
current job's output image, filter block, output row and column block. Values
show actual resident partial sums for the active tile and final backing-memory
values after stores. A new tile does not display stale SRAM from an older tile;
its unwritten output positions show —. Hover distinguishes partial/final values.

Front-channel preferences are owned by each individual input image, kernel
filter and output image. Hardware-job changes bring channels forward only on
the selected tensors. Clicking a plane changes that tensor alone. The shared
source-channel buttons apply to the selected input image and kernel filters.
New configurations reset these presentation preferences; replay between jobs
preserves unrelated tensor fronts.

Next stage finishes the current high-level phase and stops at the first edge
of the next actual phase: Plan, Input DMA, Kernel DMA, Convolve tile, Output DMA,
Advance. It skips stages the hardware skips. Another reduction job returns to
Plan while keeping output sums resident; final output DMA follows completion of
all contributions. Next state retains its finer FSM stepping. Both tabs share
the same simulation clock and controls.

Validation performed in staging:

- `node validation/output-and-stages.cjs`: **45 stage boundaries** match the
  first future boundary found independently from raw scheduler states across
  full-kernel, empty-patch and fallback presets. **576 output cell checks**
  verify destination masks, independently recomputed first-channel-block sums,
  continuation values, final stores, blank new tiles and complete final outputs.
- Per-image/per-filter fronts are checked through channel blocks, output-channel
  blocks and batch changes, including manually chosen fronts in unrelated
  tensors. Tabs, spread controls, Minimal text, invalid/completed controls and
  a 390px viewport pass with no page errors. Desktop/mobile images were inspected.
- `node validation/tile-selection.cjs`: all **217 states / 23,390 source cells**
  and **78 empty-patch states** still pass. The source-only validator explicitly
  excludes the new output cells; the new suite checks outputs separately.
- `node validation/browser.cjs`: existing nine-preset interaction regression
  passes, including outputs, PE motion, SRAM/source links, edits/export, shared
  tabs/controls, floating windows and mobile layout.

Engine and scheduler (`engine.js`, `tiling.js`) hashes are unchanged. `app.js`
only resets per-tensor view preferences for a new configuration and enables/
disables the new UI control. Existing arithmetic and RTL evidence is reused;
no arithmetic sweep, RTL simulation, synthesis or physical flow was rerun.

Checkpoints: 04_before_output_and_stage_views → 05_output_and_stage_views.
