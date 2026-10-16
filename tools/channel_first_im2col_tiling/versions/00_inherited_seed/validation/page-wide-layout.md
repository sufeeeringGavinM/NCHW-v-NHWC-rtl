# Page-wide layout and minimal text — 2026-10-15

Staged checks passed before applying the source:

- Pinned side controls remain at the same viewport coordinates while scrolling;
  Step remains operable and advances exactly one clock edge.
- Floating windows use BODY as positioning ancestor, can move above the former
  workspace origin, and drag-scroll further down the page.
- Array resize preserves model state and A rows/columns, fits available width,
  reduces queue preview length, and keeps animated tokens centered on target PEs
  while the diagram is scaled.
- Minimal text preserves exact PE sums and clock state, hides explanations,
  leaves configuration errors visible, and restores its preference on reload.
- Maximize stays pinned beside the rail during scrolling. Reset restores usable
  default widths after resize/reload/maximize interactions.
- Wide (1900px) and mobile (390px) layouts checked; no mobile page overflow.
- Completed model output matches its reference.
- Existing desktop-window suite passed all 8 resize grips, free movement,
  layering, minimize/restore, maximize/double-click, geometry persistence,
  keyboard/Escape/reset, invalid/blocked storage and mobile modes.
- Existing tensor/motion suite passed in stacked view.
- Desktop, minimal-text and mobile screenshots inspected.

Engine SHA-256 unchanged:
deece502b317db4ea0e22ce8f0e359d677af5daf2db71d50d626a543a1e3dfda.
Accepted model/RTL-baseline evidence reused. No RTL or numerical sweep or physical
flow rerun. Existing pre-tiling numerical model is retained; this is a UI update.
