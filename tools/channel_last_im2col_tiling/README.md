# Channel-last im2col tiling simulator

Open [dist/index.html](dist/index.html) or the self-contained
[offline HTML](dist/Channel-last%20im2col%20Tiling.htm) directly in a browser.
No server or network is needed.

This is one shared visualization for the active channel-last implementations.
It uses [centralized CL checkpoint 08](../../implementations/channel_last_centralized/README.md)
as the source of truth. All other active RTL files are byte-identical in the
per-row variant; both address generators implement the same coordinate and bank
mapping. Only address-generation distribution differs. The source reference,
course golden model, tensors and attribution remain in `reference/`.

The presentation follows the working channel-first simulator: the same SVG
channel stacks, grey selection masks, numeric operand motion, compact memory
banks, source links, shared-clock tabs, pinned controls and movable/resizable
windows. The arithmetic and scheduler engines from the initial CL attempt are
unchanged; their accepted RTL evidence is retained. Independent before/after
snapshots preserve the attempted and repaired presentations.

## Tiling schedule

Full input images, kernel filters and output images are shown as overlapping
channel planes. All channels and tensor cells are retained; Spread channels
exposes the complete planes. Grey input cells are the clipped real-pixel DMA
rectangle in the selected input channels. Grey kernel cells select the channel/
filter block, or a single global tap during fallback. Grey output cells mark the
region receiving the current job's contribution. Values show actual resident
partial sums or final stores; a new tile never presents old SRAM as a valid sum.

Previous/Next block, job buttons, seek/back/reset and Next stage operate on one
layer clock. Front-plane preferences belong to individual images/filters;
unrelated tensors do not follow the selected block. Next stage follows actual
Plan → Input DMA → Kernel DMA → Convolve tile → Output DMA → Advance transitions,
skipping stages the hardware skips. Further reduction jobs return to Plan
before final output stores. Each local job has **N=P=1**; full-layer images are
processed sequentially. The local output selector labels its global image index.

## Current tile convolution

Rows are physical reduction lanes, not fixed input channels:

```text
t = group_base + row
c = floor(t/(R*S)); r = floor(t/S)%R; s = t%S
G = ceil(C*R*S/A)
```

A group can cross an input-channel boundary. Its input mask is the union of
real source coordinates used by all active CRS rows across the output stream;
its kernel mask is exactly those CRS terms. Teal marks inputs currently held
in the leftmost PEs, including during a stall. Padding contributes an explicit
zero without highlighting a different image cell. Group buttons replay to RUN
entry; Next group stops at a group/job transition.

Actual signed values move right between PEs and down into stationary weight
registers. Activation motion occurs only on array-advance edges. Independent
weight shifts continue during memory stalls. Both stationary buffers, retained
forwarding values, registered column outputs and stored SRAM sums remain
visible. Animate flow and reduced-motion preferences control presentation.
Seeking/back show committed state without replaying a misleading movement.

Four-value stream previews are generated on a cloned model, including bank
conflicts, synchronous return latency, row skew, padding and weight prefetch.
They add no hardware FIFOs. The separate bank diagram shows the **two actual
vector slots**, their ready/filling/free state, producer/consumer roles, row
requests, granted reads, conflicting words that retry, and previous read returns.
Ready and consume are distinguished at the clock edge.

Input/skew/PE/column/writeback state advances together. A held array produces
no activation motion or SRAM write; next-group weight loading remains independent.
Memory wait clocks and conflict retry rounds are separate measured model counts.
The core latency includes actual waits, not an assumed fixed conflict penalty.

## SRAM and source inspection

Channel-last input placement is the RTL's residue-swizzled mapping:

```text
slot = c*R*S + (h%R)*S + w%S
bank = slot%A
addr = ((floor(slot/A)*ceil(H/R)*ceil(W/S)
         + floor(h/R)*ceil(W/S) + floor(w/S))*N+n)
```

Physical banks show actual words and source provenance, including retained or
unknown addresses during DMA. Paging reaches every address, with 12 displayed
per bank at a time. Lowered view instead shows current-group row requests at
output positions, including generated zeros and their bank/address mapping.
This virtual matrix is never stored. Kernel banks expose every CRS address
through paging. Output banks display resident partial sums and group counts.

Hover/focus links use exact global tensor coordinates. They outline matching
local tensor cells and show a full source-plane locator; equal numeric values
do not imply equal sources. Current/next feed markers distinguish the held PE
inputs from future feeds. Source inspection during DMA follows actual resident
word provenance rather than assuming a new tile has already loaded.

External tensors remain NCHW/KCRS/NKPQ; local output bank k uses
`(p*Q+q)*N+n`, and kernel bank k uses `(c*R+r)*S+s`. The channel-last algorithm
name does not change tensor-file order. Full-layer tiling, conservative bank
capacity bounds, fallback and serialized word transfers follow the active RTL.
There is no AXI, backpressure, variable external latency or compute/DMA overlap.

## Controls, capacities and precision

Layer & tensors edits full tensors with their shapes; paste and JSON export
retain every element. Physical build defaults remain A4/CFG32, signed 8-bit
operands, signed 32-bit wrapping sums and independent 8-bit address widths.
The tiling demonstration uses A3 and smaller memories to expose boundaries.
Each address-bit field sets 2^bits words per physical bank. Changing it restarts
the simulated hardware build and recalculates its tiling.

Teaching bounds remain dimensions ≤32, A≤10, address widths 1–12, 16,384 elements
per tensor and 30,000 clocks. There is no additional five-channel/256-cell/64-word
truncation. Large tensor planes scroll; physical memory words are paged.

Floating windows are optional. They retain all eight resize grips, drag/scroll,
minimize/restore, maximize, taskbar, keyboard movement/reordering, Escape and
browser-local saved geometry. Stacked mode is the default. Minimal text hides
secondary explanations while preserving values, selectors, errors and attribution.

## Source, validation and history

- `engine.js`: retained CL core arithmetic, arbitration, slots and stalled cycles.
- `tiling.js`: retained CL hardware scheduler and serialized transfer model.
- `tiling-ui.js`: shared full-layer SVG selection and schedule presentation.
- `cl-detail.js`: CL group masks, bank/slot diagram, previews, operand motion,
  memory paging, source links and detail-module inspection.
- `app.js`: configuration, full tensor editing/export and inherited window controls.

To rebuild, inline style.css at its link in src/index.html. Inline engine.js,
tiling.js, tiling-ui.js, cl-detail.js and app.js in that order at their script
references. Write the result to both dist HTML files.

See [validation/visual-repair.md](validation/visual-repair.md) and
[validation/REPORT.md](validation/REPORT.md). New browser checks are
`node validation/visual-details.cjs`, `node validation/tile-selection.cjs`,
`node validation/output-and-stages.cjs`, `node validation/browser.cjs`, and the
focused `node validation/local-image.cjs`. They use this workstation's installed
Edge/bundled Playwright; adjust its require path elsewhere. Existing model/
RTL-trace checks remain `node validation/check.cjs` and `node validation/trace.cjs`.
Their accepted evidence is reused because the two model sources are byte-identical.

Snapshots 00/01 retain the initial derivative and its reference. Immutable
02_before_visual_repair / 03_repaired_visualization preserve this repair with
source/tensor manifests. Hardware and CF visualizer histories are untouched.

This is one functional browser layer. Replay/reset constructs fresh browser
memory; RTL reset-abort and consecutive descriptor lifecycles are not modeled.
Checks do not prove every internal signal equivalent. Simulation is not
synthesis, physical timing closure, area, power or frequency evidence.

## Credits

AI-assisted derivative of the channel-first im2col tiling simulator. The original
interaction pattern was inspired by “Convolution Simulator”, conceptualized by
Adelson Chua. Parent attribution remains in the inherited seed; hardware credits,
AI disclosures and the original course golden model are preserved in reference/.
