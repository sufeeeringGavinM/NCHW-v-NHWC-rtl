# Desktop-style windows — 2026-10-15

Validated in staging before applying files:

- Actual independent x/y dragging, with unchanged panel DOM order.
- Overlap/layer focus via window selection and window-bar buttons.
- All eight resize handles: n, s, e, w, ne, nw, se, sw.
- Minimize to window bar; maximize and restore previous geometry; double-click.
- Saved geometry reload; keyboard movement and Alt+arrow resizing; Escape cancel.
- Reset restores positions/sizes/visibility; invalid or blocked storage fallback.
- Mobile default stacked view and optional desktop mode without page overflow.
- Simulation state preserved during window operations; completed outputs match.
- Animation overlay alignment and numeric payloads survive resizing/maximizing/
  restoring the systolic-array window.
- Existing tensor/motion suite passed in stacked view.
- Desktop and mobile screenshots inspected.

Engine SHA-256 remains deece502b317db4ea0e22ce8f0e359d677af5daf2db71d50d626a543a1e3dfda.
Accepted arithmetic/RTL evidence reused. No RTL/functional sweep/synthesis or
physical flow rerun. Prior sortable-panel checks remain in website checkpoint 08;
active panel-layout.cjs now checks desktop-window behavior.
