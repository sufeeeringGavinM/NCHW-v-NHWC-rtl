# Full-tensor tile selection — finalized 16 October 2026

The schedule tab now reuses the convolution view's stacked 2D channel-plane
visual method for **full input and kernel tensors**. Grey cells identify the
current job's clipped input rectangle on its N/C planes, and its K/C kernel
block. Full-kernel jobs select all taps in that block; fallback jobs select only
the global (r,s) tap. Entirely padded patches select zero input cells. Nonselected
images, channels, filters and taps retain their source colours and values.

Previous/Next block replays to each prepared job. Front-channel controls and
Spread channels expose overlapping planes without advancing the clock. The
selected image/filter and foreground plane scroll into view within their own
containers. Mask rendering is cached while the same job remains selected.
The detailed convolution tab and its original source highlighting are unchanged.

`node validation/tile-selection.cjs` passed **217 states / 23,390 displayed
cells**, including **78 empty-patch states**. It compares every rendered value
and mask with the full global tensor coordinates for every job in the tiled,
fallback, empty-padding and padding/dilation presets. Coverage includes batch,
channel/filter tails, width/row transitions, fallback tap changes, grey fills,
front-plane and spread controls, Previous/Next block, shared-clock tabs,
reset/replay, Minimal text, and a 390px viewport without page overflow. No page
JavaScript errors. Desktop and mobile screenshots were visually inspected.

The existing `node validation/browser.cjs` suite also passed all nine presets
on the staged update, covering completed references, detailed PE motion,
lowered/physical SRAM views, source links, full-layer editing/export, shared
controls, floating/maximized windows and mobile layout.

`src/engine.js`, `src/tiling.js` and `src/app.js` are byte-identical to checkpoint
01. Accepted arithmetic, cycle and RTL-trace results in REPORT.md are reused;
no arithmetic sweep, RTL simulation, synthesis or physical flow was rerun.
Only schedule presentation, offline HTML and its docs/provenance change.

Checkpoints: 02_before_tensor_tile_selection → 03_tensor_tile_selection.
