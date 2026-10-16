# Im2col cycle plots

Open `index.html` offline. Twelve sweep selectors compare CF and CL total cycles,
core cycles, memory waits, DMA, control, job counts and tile sizes. A second
chart maps the winner across array side and channel count. The `plots/` folder
contains PNG and PDF exports, including all sweeps, cost breakdown and SRAM
transitions. Raw results are in `cycles.csv` and `cycles.json`.

Baseline: A4, N1 C4 K2 H6 W6 R3 S3; input/output/kernel each 256 words per bank;
stride 1, dilation 1, padding 0. A sweep changes only its stated parameter(s).
Kernel height/width change together; their output dimensions consequently change.
The batch sweep uses sequential images, matching both current tiled accelerators.
Every memory has A banks. Capacity is words per bank, not bytes or total storage.
Increasing A changes compute resources and total SRAM; this is not an area match.

CF core timing is a formula. CL's existing model simulates arbitration, synchronous
returns and two vector slots to obtain actual waits. The collector loads both
accepted simulator sources without editing them and memoizes identical CL jobs.
For a local job:

    G_CF = R*S
    G_CL = ceil(C*R*S/A)
    ideal_core = 1 + A + G*(Q + 2*A) + G - 1
    actual_core = ideal_core + measured_memory_waits

Whole layer:

    sum(actual_core) + 2*(backing_reads + stores)
      + 1 + 2*output_tiles + 3*local_jobs

Each design uses its own hardware planner. Retry rounds are not separately added
because buffering can hide retries. SRAM thresholds can switch full-kernel versus
single-tap fallback, making cycles nonmonotonic. Qt is planner capacity; actual jobs
clip it to remaining output width. Matched widths are 8-bit input/weights and
32-bit accumulators. No frequency, synthesis or area inference is made.

Reproduce from this workspace with Node and Python (matplotlib, numpy, plotly):

    node tools/im2col_cycle_plots/collect.cjs
    python tools/im2col_cycle_plots/plot.py

`collect.cjs [workspace-root]` optionally selects the workspace. Python renders
already collected data. No server or network is used by the final dashboard.
The optional plotting-library path in plot.py is this workstation's task bundle;
normal Python packages work on other machines. browser-check.cjs uses this
workstation's installed Edge/Playwright paths.

Validation: 236 matched configurations, 12 retained RTL fixture cycle checks,
six full scheduler replays checking totals and outputs, and interactive desktop/
mobile browser checks. Accepted hardware/model evidence is reused; no new RTL
sweep or hardware changes. Existing simulator teaching limits are preserved;
rejected points would be explicit gaps. This dataset has no rejected points.
Source hashes and generation evidence are in provenance.json. AI-assisted scripts.
