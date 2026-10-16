# Channel-last tiling visualization validation — 2026-10-16

Source reference: exact active centralized CL checkpoint 08. The per-row variant
shares all RTL except address generation. Browser/model checks cover one layer
per run. Hardware evidence lives separately in reviews/2026-10-16/channel_last_tiling.

- Four directed model layers: A4 default, A3 channel/batch/width tails, A3
  one-tap fallback, A1 empty patches; final outputs, exact scheduler clock count
  and every intermediate output write match independent convolution references.
- 24 deterministic signed random layers (seed 196): 2,327 outputs and 131,058
  edges, including every intermediate output write, passed. Values span the
  complete signed 8-bit range; sums use signed 32-bit wrapping.
- Two fresh Icarus system traces: 8,900 edges, 2,260 backing transfers and 1,368
  local output writes. Scheduler states, core states/group/step/array advance
  during active compute, every backing read/write address, final store values,
  local output write column/address/value and final tensors match the JS model.
  Simultaneous-column writes are compared as a multiset because Verilog process
  print order is unspecified. No comparison of every PE/register bit is claimed.
- Default A4: 1,865 clocks, 576 reads, 32 stores. Fallback trace A3 with input/
  output/kernel address widths 2/2/2: 7,033 clocks, 1,592 reads, 60 stores.
- Installed Edge/Playwright: all nine presets complete with matching outputs
  and clock totals. Shared tabs, prepared-job selection, Next stage, CRS PE grid,
  physical banks, PE selection and four module views passed. Desktop 1440px and
  mobile 390px checks found no horizontal page overflow or page errors. Adjacent
  screenshots retain the final presentation. Back/reset/play, JSON export, signed tensor editing, invalid paste/recovery,
  floating-panel maximize/reset, channel fronts and spread also passed.

Commands: `node validation/check.cjs`, `node validation/trace.cjs`,
`node validation/browser.cjs`. `capture-rtl-trace.py` records the temporary
instrumented version of the existing one-layer bench; production benches are
unchanged. `rtl-fixtures.json` and rtl-0/1.log retain fresh evidence so ordinary
JS regression checks do not require an RTL rerun.

No reset-abort, consecutive-layer, variable-memory-latency or full all-signal
formal equivalence is claimed. No physical timing, synthesis or performance
frequency result follows from these functional checks.

## Repaired presentation — 16 October 2026

See [visual-repair.md](visual-repair.md) for the current UI checks: 134 detailed
states, 8,112 local tensor cells, 753 aligned moving operands, 95 future queue
entries, 285 full-layer states / 57,256 source cells, 45 stage boundaries and
576 output cells. Nine original CL presets and the one-local-image selector
check also passed. Engine/scheduler hashes are unchanged; the original model/RTL
evidence above is reused. Full SVG planes, actual motion, source links, swizzled
SRAM paging and complete window controls replace the earlier simplified UI.
