# Channel-last im2col tiling simulator

Open [dist/index.html](dist/index.html) or the [standalone offline copy](dist/Channel-last%20im2col%20Tiling.htm)
directly in a browser. No server or network is required.

This local derivative follows the channel-first tiling simulator's two-tab
layout, controls, tensor planes, array inspection and memory views. It models
the channel-last hardware in `implementations/channel_last_centralized`, at
checkpoint 08. Both channel-last variants have the same behavior; their address
generation hierarchy differs. The exact hardware sources/tensors used for
validation are retained in `reference/`.

- **Tiling schedule:** hardware job order, full input/kernel/output channel
  planes, selected patches, channel fronts/spread, resident partial sums,
  serialized input/kernel/output DMA, full backing memory and final output check.
- **Current tile convolution:** CRS reduction rows, PE activation/partial-sum
  pipeline and both weight registers, lowered virtual input or physical swizzled
  banks, kernel/output SRAM, bank arbitration and two vector slots. The array
  holds during actual memory waits; weight prefetch proceeds independently.

Step/play/back/reset/seek, Next state, Next stage, Next group and Finish layer
share one layer clock. Job buttons seek to the prepared patch. Local group
buttons seek within the resident job. Tensor editors/paste use full-layer
NCHW/KCRS order; run JSON exports full inputs, outputs and transfer counts.
Floating detail panels can be dragged, resized and double-clicked to maximize;
Reset windows restores their positions. Minimal text reduces inherited labels.

Local input placement uses the same residue-swizzled mapping as RTL:

```text
slot = c*R*S + (h%R)*S + w%S
bank = slot%A
addr = ((floor(slot/A)*ceil(H/R)*ceil(W/S)
         + floor(h/R)*ceil(W/S) + floor(w/S))*N+n)
```

The hardware scheduler's bank-capacity bound selects channel/column tiles.
Oversized kernels or minimum footprints use one-tap fallback. Each job has
N=P=1; input rectangles are clipped and adjusted local padding supplies zeros.
No expanded im2col matrix is stored. The first contribution initializes sums;
subsequent groups/jobs accumulate with signed 32-bit wraparound. Only final
output tiles are stored to backing memory.

External tensor file order remains NCHW/KCRS/NKPQ. Browser teaching bases are
input=0, then 64-word gaps; RTL bases are configurable and its bench uses 8-word
gaps. Both count words, one element per word, with one-cycle enabled reads and
edge writes. There is no AXI, variable latency, transfer overlap or physical
memory controller. Synchronous idle output readback precedes each final store.

Source hardware defaults remain A4/CFG32 and three independent 8-bit address
widths. The default browser preset uses A3/smaller memories to expose tails.
Teaching controls allow dimensions up to 32, A up to 10, address widths 1–12,
16,384 elements per tensor and 30,000 layer clocks. Large plane displays show
at most 256 cells; physical bank/kernel tables show at most 64 words. These
are display limits; the arithmetic/export retains all elements. Overlapped
stacks show the selected front and up to four rear channels; Spread channels
shows every channel. Unknown or retained SRAM contents remain visible during DMA.

## Validation and source history

See [validation/REPORT.md](validation/REPORT.md). Run `node validation/check.cjs`,
`node validation/trace.cjs`, and `node validation/browser.cjs`. The model checks
use Node built-ins. Browser checks use this workstation's bundled Playwright
and installed Edge; adjust the require path elsewhere.

`src/engine.js` models CRS-group control, bank arbitration/return/consumption,
array advances, row skew, PE weights and output accumulation on rising edges.
`src/tiling.js` models the hardware scheduler and serialized transfers.
`src/app.js` renders/controls the shared state. To rebuild, inline style.css into
src/index.html's link, then inline engine.js, tiling.js and app.js in script
order; write the result to both dist files.

`versions/00_inherited_seed` preserves the exact parent source/output from
`tools/channel_first_im2col_tiling`, tip 05_output_and_stage_views.
`versions/01_validated_tiling` preserves this first CL derivative, including its
hardware reference, tensors, validation and hashes. Numbering is independent of
both the parent visualizer and RTL histories. Do not overwrite snapshots.

This is a one-layer functional teaching model. Reset replays the browser layer;
it does not model RTL reset-abort or consecutive descriptor lifecycles. Trace
checks cover the listed observations, not every internal signal. No synthesis,
physical timing closure, area, power or frequency claim is made.

## Credits

AI-assisted derivative of the channel-first im2col tiling simulator. The original
interaction pattern was inspired by “Convolution Simulator”, conceptualized by
Adelson Chua. Parent attribution is retained in the inherited seed; hardware
credits, AI disclosures and original course golden model are preserved in
reference/README.md and reference/conv_golden.py.
