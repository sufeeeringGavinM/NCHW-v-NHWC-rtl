> Historical measurement sources: this folder retains the pre-tiling core
> comparison. Active tiled RTL is in ../rtl; old physical results do not measure it.

# Respective FPGA synthesis: centralized

This directory contains the exact matched measurement sources used for the
2026-10-14 comparison, registered generator benchmark, activity converter,
constraints, Vivado runners and this implementation's own raw reports.
Read the matched report (`../../../comparisons/vivado/comparison/REPORT.md`, original workspace reference).

`rtl/` is a measurement copy of the product's RTL: existing output SRAM read
data is exposed through `observed_words` so synthesis retains output storage.
It adds no memory ports. `addr_benchmark.v` registers generator inputs/outputs.
These copies passed the default numerical and cycle checks; product interfaces
and product RTL remain in the parent `rtl/` directory.

Matched parameters: ARRAY_SIZE=10, CFG_WIDTH=9, BIT_WIDTH=8, ACC_WIDTH=32, all
SRAM address widths=8. Part xc7a200tfbg484-2, Vivado2026.1, rebuilt hierarchy,
normal optimization. Source configuration fields still default to32 bits.

`run_synthesis.cmd` rebuilds isolated address and full-core designs from these
measurement sources using installed Windows Vivado. `synth_compare.tcl` uses
50MHz implementation constraints, then evaluates the unchanged route at5MHz.
`target_50mhz.xdc` records those initial constraints; generated report constraints
and both timing reports record their respective evaluation conditions.

`activity.saif` contains this core's seeded default-job RTL activity, scaled
to5MHz. It is generated with `vcd_to_saif.py`; full reproduction and refreshing
measurement copies after product changes use `../../../comparisons/vivado` scripts.
Do not silently reuse these frozen copies/activity for changed product RTL.
Generator power is vectorless; final full-core power uses
`activity_netlist.saif`, a zero-delay synthesized-netlist trace whose known
live ports/control matched the RTL cycle by cycle. `activity.saif` preserves
the original RTL activity, and reports ending `_rtl` retain the preliminary
RTL-only estimate. `evaluate_netlist_power.tcl` performs the final power pass
on the unchanged routed checkpoint. Regenerate netlist activity after source
or synthesis changes; see the matched comparison README. Power
coverage/confidence and internal timing scope are in the matched report.

`reports/address/` and `reports/core/` contain utilization, timing, route-status,
power, logs and physical checkpoints. Reports, SAIF and physical checkpoints
are excluded from numbered source archives; measurement RTL, wrapper, runners,
constraints, conversion source and `method_sources/` generators remain in the
source checkpoint. The method source copies record the matched comparison
workflow; execute them from the sibling `im2col_comparison` layout described
in its README.
