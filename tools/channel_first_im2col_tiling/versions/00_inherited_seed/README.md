# Channel-first im2col interactive simulator

Open [dist/index.html](dist/index.html) directly in a browser. The self-contained
[offline HTML](dist/Channel-first%20im2col%20Simulator.htm) needs no server or dependencies.
The four editable source files live in `src/`; `dist/` embeds them into one HTML file.
To rebuild, inline style.css, engine.js and app.js at their references in src/index.html.

This AI-assisted website adapts the interaction pattern of the user-provided
Convolution Simulator, conceptualized by Adelson Chua. Its model is based on the
active `../../implementations/channel_first/rtl`, not the reference's
output-stationary engine. Original attribution and the course material in the
read-only seed are preserved.

## Behavior

- Square physical array, c mapped to rows and k mapped to columns.
- Signed 8-bit input/weights, signed 32-bit wraparound, cross-correlation.
- Independent padding, stride and dilation for each axis; NCHW/KCRS/NKPQ tensors.
- Input bank c, address (h*W+w)*N+n; output bank k, address (p*Q+q)*N+n.
- Kernel bank k, address (c*R+r)*S+s; two stationary weights per PE.
- Pre-edge updates, synchronous SRAM reads, row skew, registered column outputs,
  background next-tap weight loading, clear between taps and output accumulation.
- Current hardware defaults A=4, input/output/kernel address width 8. The
  supplied-testbench preset selects A=10 and its dimensions, completing at 343 clocks.
- Configurable compiled-build array/address parameters do not imply RTL runtime ports.
- A preloaded single job is modeled. Reset rewinds this browser job; it is not an
  RTL reset-abort simulation. The SRAM panel represents hierarchical bench inspection.
- Capacity checks enforce the three independent per-bank limits and C,K <= A.
  Teaching controls additionally cap dimensions at 32, A at 10, address widths at
  12, total elapsed clocks at 30,000 and each editable tensor at 16,384 elements.

## Stacked tensor and operand visualization

Inputs are grouped by image, with one overlapping 2D plane per input channel.
Filters likewise group their C kernel planes. This follows the supplied DigiAI
slides; channel colors identify planes, darker source-colored cells mark every input location used by
the current tap pass, teal identifies the actual row-skewed input at the last
edge, and dashed amber outlines mark the kernel tap being loaded. Tap indices
are zero-based. At a tap switch the masks follow the new pass and stale previous
pass input markers are removed. Padding contributes a labeled zero without
highlighting an unrelated image cell.

Select a channel to bring it forward, or use Spread channels to expose every
plane. The PDF example preset matches its 4x4 images, 2x2 kernels and stride 2.

Step or Play animates actual activation values moving right between PEs and
kernel values shifting downward into the selected weight buffer. Weight labels
track retained forwarding-register identities across taps, including transient
old-tap values during a new load. Stationary compute weights remain visible in
the PE registers. Animate flow and reduced-motion preferences disable motion;
seeking/back show committed values without replaying misleading movement.

Targeted Edge checks passed all four PDF tap masks, per-channel kernel marks,
front/spread controls, row-skewed input locations, moving operand direction and
payload/coordinate identity, padding zeros, batch interleaving, tap boundaries,
seek/back, motion settings, reduced motion and 390px mobile layout. The existing
browser interaction checks also passed all five original presets and controls.
The arithmetic engine SHA-256 is unchanged, so its accepted validation below is
reused; no RTL or arithmetic sweep was rerun. Website checkpoints are
02_before_tensor_visualization and 03_stacked_tensors_and_motion.

## Upcoming operand queues

The left edge of each row previews its next four input samples, with the next
sample nearest the array on the right. Each column has a vertical weight queue,
with the next weight at the bottom. The queue head is marked next. Labels show
input image/coordinates or weight source channel, signed values, remaining count,
and clocks until entry. Padding samples and inactive physical weight rows show
explicit dashed zeros. The +count indicator accounts for samples beyond the
four-value preview.

The preview looks ahead on a cloned model without changing the live run or
adding hardware FIFOs. It includes row skew, batch interleaving, synchronous
read delays, initial weight loading and background next-tap loading. A weight
queue shows one pending tap load at a time. Once the next tap is already loaded,
it shows its ready buffer rather than inventing more shifts. Empty pass queues,
final-tap no-refill and completed jobs are labeled. Animated values enter from
the queue ports; seek/back/reset rebuild the preview from the selected state.

Queue checks passed 579 states across six geometry/array configurations,
comparing 4,566 queued values and their future entry times against complete
recorded model traces. Checks also verified no mutation of the live model,
queue order and animated head handoff, seek/back/reset/completion, mobile width,
and default-array viewport fit. The existing stacked-tensor and motion browser
suite passed on the changed layout. The unchanged engine reuses its accepted
arithmetic/RTL evidence. Website checkpoints are 04_before_operand_queues and
05_operand_queues. No hardware source, capacity or default changed.

## Page-wide floating windows and pinned controls

Floating mode uses a compact header and roughly 8px page spacing. The default
non-floating view restores 32px workspace margins (12px on narrow screens), a
width limit, and 24px between full-width panels. The simulation rail remains fixed at the left while the
page scrolls, including Play/Step/Back/Reset, state/tap stepping, speed, clock,
seek and the window restore buttons. Short viewports use a compact control grid.
Layer & tensors opens the existing configuration editor above floating content.

Floating windows are positioned against the document body, not inside a framed
or clipped desktop box. They can overlap the configuration area and travel down
the page; dragging near viewport edges scrolls the document. Selecting a window
from the pinned rail brings it into view. Maximize fills the visible viewport
beside the rail and below the header. Existing minimize/restore, all eight
resize grips, keyboard movement/resize, Escape and saved geometry remain.
Non-floating view is the default at every screen width. Each panel has up/down
buttons and title-bar Arrow Up/Down keys for reordering, saved in this browser.
Floating mode remains opt-in and retains its window controls and saved geometry.
The layout preference uses a new storage version so older floating defaults do
not override the new default; subsequent choices persist.

Contents adapt to window size: controls and module tabs wrap, tensor planes scale
within their cards, output maps fit their channel width, and the systolic grid
keeps exactly A rows and A columns. The upcoming queue preview retains up to four values in smaller windows and
Minimal text, with true remaining counts and next-value order. Compact numeric
chips and tighter PE cells reduce wasted space; secondary annotations collapse first.
The array diagram also fits available height down to 60% scale; very small
windows or large tensors can still scroll to preserve access to every value.
Animation coordinates account for the fit scale, so tokens land on the same
physical PEs after resizing. No arithmetic, capacity, precision or tensor changes.

Minimal text hides explanations, legends and secondary annotations. It retains
numeric tensors, PE sums, queue values, essential channel/control labels, output
status and configuration errors. Show text restores the annotations. This is a
presentation preference saved separately in browser local storage. Attribution,
AI disclosure and course-source material remain intact and available.

Staged checks passed pinned controls during page scrolling; body-wide drag and
drag-scroll; responsive content/queue fitting; preserved A-by-A grid and exact
animation target alignment; minimal-text state/numeric/error preservation and
reload persistence; viewport maximize; wide/mobile layouts; and completed output.
Existing desktop-window and tensor/motion browser suites also passed. The
arithmetic engine is byte-identical, so its accepted evidence below is reused.
This UI batch retains the existing pre-tiling core model; later hardware tiling
features are outside this presentation update. Website checkpoints are
10_before_page_wide_layout and 11_page_wide_layout_and_minimal_text.

## Validation — 15 October 2026

The final JS engine passed 96 valid pseudorandom cases (seed 196), checking
outputs against an independently looped convolution, one write/address/tap, and
start-to-done cycle equations. Four of the 100 candidate geometries were invalid
and skipped.

All current RTL files were verified byte-identical to the source used for the
accepted restoration tests. The JS model also matched those 24 previously
recorded RTL runs: 4,555 output words and every recorded cycle count. Copied
fixtures and cycle counts are retained in validation/rtl-fixtures.json. No RTL
flow was rerun. `provenance.json` records exact active source SHA-256 values.

Installed Edge / Playwright checks passed all five presets, the 343-clock example,
invalid geometry, tensor editing/resizing, reference display, image selection,
PE inspection, module tabs, tap seeking, back/reset, playback, invalid tensor
paste, run JSON download, and mobile page width. No page JavaScript errors.

The model has not been proven equivalent on every internal signal or clock,
and does not establish synthesis or timing closure. No RTL, generator, bench,
precision, default, fixture or existing hardware checkpoint was changed.

Run the retained model checks with `node validation/check.cjs`. The retained
browser checks use this workstation's bundled Playwright and installed Edge;
adjust the require path for another machine.

## Provenance and snapshots

`versions/00_reference_seed` preserves read-only reference RTL, tensors,
documentation/runners/configs and the original attached HTML, with hashes.
`versions/01_validated_simulator` preserves the first validated website source,
standalone output, and checks. These are website snapshots, separate from the
unchanged hardware archives in ../../history/channel_first. Do not overwrite them.

The .openai/hosting.json identity belongs only to this website. Hosting is private.

## Compact queues and weight-loading repair

The diagram caps PE column widths at 96px and uses compact operand chips while
retaining up to four queued inputs/weights in every text/window mode. Hover
chips for full source coordinates and entry timing. Queue heads remain nearest
the array. Compact B0/B1 indicators stay visible in Minimal text; amber outlines
identify the buffer shifted on the last edge. The PE registers checkbox can
still hide them. Weight animations target visible registers (or the PE center
when details are disabled), following the same lane down from the top queue.
This repairs animations that previously targeted hidden register elements after
shrinking or hiding text. Initial and background loads use the same rendering.

Staged Edge checks verified 128 weight destinations/payloads across both text
modes and register-detail settings, downward motion, queue-head handoff,
four-value previews, compact bounds, small windows, mobile and completed output.
The existing page-wide and tensor/motion suites passed. Checkpoints 12/13 record
the before/after website state; engine bytes and accepted arithmetic/RTL evidence
are unchanged. No hardware flows were rerun.

## Input SRAM and virtual lowered-matrix view

The systolic panel places its centered array beside an Input SRAM view and
stacks the two on narrow windows. Lowered view separates input SRAM banks by c, showing tap rows (r,s) and columns
(n,p,q) inside each bank. Kernel values appear in a separate Kernel SRAM section
with one physical bank per output channel k and labeled input-channel blocks. Stored banks displays physical input
bank c and address (h*W+w)*N+n. Large matrices page through 12 rows/columns at
a time; padding zeros are distinct and have no source SRAM location. This does
not allocate any hardware storage or change the existing computation model.

Image/filter and channel colors match between matrix cells and tensor planes.
Hover or focus a numeric source to bring its channel forward, outline its tensor
cell, and show its coordinates and a source-plane locator. Clicking reveals the
tensor panel. Preview operands also support source links. Current-tap cells
retain their source colors with darker shading; current input feed/load marks
remain. A persistent note, including in Minimal text, explains that the lowered
matrix and stream previews are visual aids: no physical buffer stores lowered
elements. The array now says Stream preview rather than implying a stored queue.

Staged Edge checks passed 792 displayed lowered/physical values across six
presets; default non-floating margins, button/keyboard reorder and persistence;
image/channel/filter color/source linking; hover/focus and source locator;
centering and token alignment in both layouts; mobile width and finished output.
Existing compact-queue, tensor/motion, desktop-window and page-wide layout suites
passed. Website checkpoints 14/15 preserve before/after sources and seed tensors.
The engine remains byte-identical; accepted arithmetic/RTL evidence is reused.

## Feed highlights and separate SRAM banks

Teal marks the input currently held in PE [c,0]; dashed amber marks the first
upcoming input for that row, including row skew. Both the virtual lowered view
and physical input SRAM view use exact coordinates, never numeric-value matches.
Virtual marks identify (c,r,s,position); physical marks identify (c,n,h,w). A
physical cell can have both markers when the same stored value is reused.
Generated padding zeros are marked only in virtual lowering and the feed
summary, never as an unrelated physical SRAM address. A compact strip above all input banks keeps Now/Next values labeled by c;
hover exposes source coordinates and entry delay, including off-page operands. Highlights rebuild on step/play/seek/back/
reset, tap transitions and completion; summary values retain tensor hover links.

Input banks c and kernel banks k have separate framed cards. Each kernel bank
contains clearly labeled blocks for its input channels c and exposes stored
addresses (c*R+r)*S+s on hover; its tap paging is independent of input view paging. Output
SRAM also has framed cards labeled by output channel/bank k and selected image.
The persistent no-lowered-buffer explanation and source colors remain intact.

Staged Edge checks passed all feed markers and summaries in both input views
across 618 model states / six presets (184,866 displayed cell checks, including
83 marked padding zeros), 144 kernel values/addresses, bank separation, source
links, Minimal text, mobile and completed reference outputs. The updated lowered
view suite passed another 1,080 rendered values plus layout/source/animation
checks. Screenshot inspected. Website checkpoints 16/17 preserve before/after
source and reference tensors. Engine bytes and accepted arithmetic/RTL evidence
are unchanged; no hardware flows were rerun.

## Compact SRAM presentation

Both full and Minimal text use the same dense memory arrays. Shared explanations,
feed legend/summary, paging and source locator sit above the input banks. Bank
labels are c=… or k=…; repeated captions and coordinate paragraphs are removed.
Kernel input-channel blocks sit side by side; stored addresses remain in numeric
cell tooltips and accessible labels. Output status and legend sit above the
output arrays, with per-word address/tap details on hover. Reference values
still appear when enabled. Signed numeric precision is unchanged.

Staged Edge comparisons passed 16 combinations of four presets, two text modes
and two input views against the prior HTML. Displayed input/kernel values, feed
markers and PE sums match; combined input/kernel section height fell by more
than 25% in each checked combination. Header placement, source focus/locator,
mobile width and completed output passed. The existing lowered-view suite also
passed 1,080 rendered values and layout/source/animation checks. Screenshot
inspected. Website checkpoints 18/19 retain before/after sources and tensors.
Feed-coordinate functions and arithmetic engine are unchanged, so accepted
feed-trace and arithmetic/RTL evidence is reused; no hardware flow was rerun.
