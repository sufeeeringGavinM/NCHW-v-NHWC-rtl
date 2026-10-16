# Channel-first im2col tiling simulator

Open [dist/index.html](dist/index.html) or the standalone
[offline HTML](dist/Channel-first%20im2col%20Tiling.htm) directly in a browser.
This is a separate, local derivative of
[the pre-tiling simulator](../channel_first_im2col_simulator/README.md).
It has no hosting identity and does not modify that simulator or hardware.

Two tabs share one simulation, clock, configuration and tensor editor:

- **Tiling schedule** shows the full-layer loop, serialized input/kernel DMA,
  abstract convolution jobs, output readback/stores, and final backing memory.
  Its **Current tile selection** view uses the same stacked channel planes as
  the convolution tab: grey cells show the selected full-input rectangle and
  kernel channel/filter block. One-tap fallback greys only its global kernel tap.
  Previous/Next block moves the selection through the hardware job order;
  Bring a channel forward and Spread channels reveal overlapping planes.
  Click a job number to replay to its prepared patch. A page lists 20 jobs.
  Select an image/channel/filter to inspect the full input and output planes.
- **Current tile convolution** retains the original movable/resizable panels,
  stacked tensors, PE operand animations, four-value previews, both weight
  registers, lowered/physical input views, kernel banks and local output SRAM.
  It inspects the resident job; before PREPARE, the previous job can still be
  resident. Hover/focus links show local coordinates and the actual global
  source of the stored word, including retained data during subsequent DMA.

Step, play, back, reset, next state, next tap and seek operate on the shared
layer clock. Next state follows the accelerator and core FSMs; Next tap advances
to another local tap or job. Reset replays a fresh browser layer. It is not an
RTL reset-abort operation. Finish layer includes final DMA stores. Run JSON
contains full NCHW/KCRS inputs, NKPQ outputs, transfer counts and the selected job.
Configuration and tensor editing always describe the full layer.

## Hardware mapping

The source of truth is [the active CF implementation](../../implementations/channel_first/README.md),
`rtl/conv_accelerator.v` and its instantiated core, at hardware checkpoint 40, unchanged through the current checkpoint 44.
The exact checkpoint-42 verification sources/tensors used for validation are in
`reference/`; hashes and validation provenance are in [provenance.json](provenance.json).
The hardware performs scheduling; the browser's precomputed job list is a
visual timeline of that hardware FSM, not a software scheduler supplied to RTL.

Loop order is image → output-channel block → output row → output-column block
→ input-channel block → optional kernel tap. Each local job has N=P=1.
With independent per-bank capacities Di, Do and Dw:

```text
ei = dilation_i*(R-1)+1; ej = dilation_j*(S-1)+1
full-kernel Ct = min(A, floor(Dw/(R*S)))
full-kernel Qt = min(Do, 1 + floor((floor(Di/ei)-ej)/stride_j))
```

If R*S>Dw or ei*ej>Di, one-tap jobs use local R=S=1,
Ct=min(A,Dw) and Qt=min(Do,1+floor((Di-1)/stride_j)). Tail blocks shrink.
Real input rectangles are clipped; adjusted local padding still causes the
original address generator/feeder to inject zeros. Empty patches skip input
DMA. Output SRAM retains sums across channel/tap contributions; only the first
contribution initializes them. Subsequent jobs capture `cfg_continue_sum=1`.
PE weight double buffering remains inside full-kernel jobs.

Backing memory uses NCHW/KCRS/NKPQ word addresses, one element per word.
The teaching input base is zero, with 64-word gaps before kernels and outputs.
Reads issue on one edge and are consumed on the next local-write edge.
Synchronous idle-only output readback precedes each backing-memory store.
There is no transfer/compute overlap, AXI, burst, backpressure or physical
external-memory controller. Sums never spill to backing memory mid-reduction.
Local layouts are unchanged: input bank c at h*W+w, kernel bank k at
(c*R+r)*S+s, output bank k at q because local N=P=1.

Signed 8-bit operands and signed 32-bit wraparound are preserved. Build defaults
remain A4 and three independent 8-bit address widths (256 words per bank).
The default *tiling demonstration preset* intentionally selects A3 and smaller
SRAMs to expose channel/width tails. Full-layer C and K may exceed A.
Teaching controls retain dimensions ≤32, A≤10, address widths 1–12 and a
30,000-clock limit, with ≤16,384 elements for each tensor, including output.
The A10 example now executes the accelerator's row tiles; its old 343-clock
core-only latency is not the layer latency.

Local memory displays show actual resident words within the current job's
logical footprint; unknown words use — and untouched words can retain prior
jobs' contents. Physical rows/columns and memory capacities do not resize with
a tail block. Virtual lowering and operand previews do not allocate SRAM or
hardware FIFOs. Full-layer outputs appear only on final backing-memory writes.

## Validation

See [validation/REPORT.md](validation/REPORT.md) for actual checks and limits.
Run `node validation/check.cjs`, `node validation/trace.cjs` and
`node validation/browser.cjs`. The browser runner uses installed Edge and this
workstation's bundled Playwright path; adjust its require path elsewhere.
The two model runners use Node built-ins only. Retained RTL fixtures and traces
make these checks independent of a fresh RTL build.

There is no claim of equivalence for every internal signal, reset-abort or
consecutive full-layer memory lifecycle. No synthesis, physical timing, area,
power or frequency result is inferred from browser or RTL simulation.

## Source and immutable snapshots

`src/engine.js` retains the original core, with two necessary additions:
internal clipped/empty local configurations and captured sum continuation.
`src/tiling.js` owns the outer scheduler and transfers. `src/tiling-ui.js` owns
the shared tab presentation; inherited `app.js` and `style.css` retain the
existing detailed views and window interactions.

To rebuild standalone output, inline style.css at its link in src/index.html,
and inline engine.js, tiling.js, tiling-ui.js and app.js in that order at their
script references. Write the result to both dist HTML files.

`versions/00_inherited_seed` preserves the parent source, standalone output,
provenance, checks, tensors and exact active hardware reference used as seed.
`versions/01_validated_tiling` preserves the first validated derivative.
`02_before_tensor_tile_selection` and `03_tensor_tile_selection` preserve the
before/after full-tensor tile-selection presentation. Engine and scheduler
source hashes remain unchanged; accepted arithmetic/RTL evidence is reused.
Each has an immutable SHA-256 manifest. Their numbering is independent of the
parent simulator's 00–20 snapshots and the hardware's independently numbered checkpoints.
Parent provenance is historical evidence for the core baseline, not a claim
that its pre-tiling source hashes describe today's accelerator.

## Credits

AI-assisted derivative of the channel-first im2col interactive simulator.
The original interaction pattern was inspired by the user-provided
“Convolution Simulator”, conceptualized by Adelson Chua. Original credits,
course material, AI disclosures and the course golden model are preserved in
the inherited seed and hardware reference. See reference/README.md for hardware
credits and reference/conv_golden.py for the course material and attribution.
