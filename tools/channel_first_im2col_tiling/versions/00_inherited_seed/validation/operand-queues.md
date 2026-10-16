# Upcoming operand queues — 2026-10-15

Staged queue/browser checks passed before applying files:

- Six geometry/array configurations, including A=1,2,3,4,10, batches, padding,
  stride/dilation and the original testbench dimensions.
- 579 states and 4,566 queued values compared against complete future model
  traces: numerical value, lane order and exact entry edge.
- Look-ahead leaves the live model unchanged. One weight tap load is previewed
  at a time, including physical-row masked zeros and preload/ready/final states.
- Closest-to-array head equals the input/weight passed to the next animation.
- Seek/back/reset/completion and mobile layout checks passed.
- The default array and its queues fit the expanded array viewport.
- The existing tensor/motion browser regression suite passed the changed layout.

Engine is byte-identical to its previously validated version:
SHA-256 deece502b317db4ea0e22ce8f0e359d677af5daf2db71d50d626a543a1e3dfda.
Accepted arithmetic/RTL evidence reused. No RTL, arithmetic sweep or synthesis
rerun; no physical timing claims. These queues are visual stream previews,
not new hardware FIFOs.
