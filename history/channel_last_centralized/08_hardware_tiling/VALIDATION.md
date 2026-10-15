# Hardware tiling — 2026-10-16

The current hardware scheduler is checkpoint 08_hardware_tiling (before: 07).
See [the validation record](../../reviews/2026-10-16/channel_last_tiling/REPORT.md)
for fresh full-layer, direct-core and independent-depth checks. These are
functional simulation results, not timing closure. Earlier evidence below is
historical and applies to its archived core sources.

# Validation — 2026-10-14

Validation applies to the current channel-last centralized sources. The inherited
`01_channel_first_seed` checkpoint records parent sources before edits; it is
not a working milestone of the channel-last algorithm.

## Numerical and cycle checks

- Matched 10x10, CFG_WIDTH=32 directed/random sweep: 83 cases against the
  channel-first baseline and the other channel-last organization; **14,596
  output values per variant** checked against the original Python golden model.
- Repeated all 83 cases at CFG_WIDTH=9, the physical comparison width. Every
  output, completion cycle, stall count, retry count and bank-read count matched
  the 32-bit build. Centralized and per-row metrics matched in every case.
- Matched 9x9, CFG_WIDTH=9 sweep: 23 cases, all three cores passed.
- Cases exercise batching, C/K differences, partial reduction groups, varying
  kernel sizes, asymmetric geometry, padding, stride, dilation, signed operands
  and bounded SRAM usage. The independent access model checks actual physical
  read counts and conflict retry rounds, separately from pipeline stall counts.
- Default project `run_case.py` flow passed all 32 outputs, input preservation
  and elapsed-cycle checks, with freshly generated own reference tensors.
- Each new project's existing `test_cases.py` CLI passed two directed cases
  (176 outputs). Occupancy reports describe mapping across reduction groups,
  not simultaneous PE activity or power.

Default geometry is `N=1,C=4,H=W=6,K=2,R=S=3`, unit stride/dilation, no padding.
Channel-first takes 343 cycles; this core takes **202**, including 44 memory
wait clocks, 36 conflict retry rounds, 144 array advance steps and 576 bank reads.
Measured waits satisfy the completion equation in README. No estimated penalty
is added to the hardware controller's cycle count.

## Protocol and job controls

The supplemental bank protocol test passed exact edge counts: conflict-free
synchronous fetch completes in two edges; four distinct addresses in one bank
complete in five edges with three retries; four requests for the same word
broadcast a single read and complete in two edges; all-padding completes in
one edge with zero bank reads.

Three jobs ran without reset in each new core while external configuration
ports changed to 42 during busy. Attempted input/kernel writes during busy
were rejected. All three output tensors, preserved input SRAM and 202-cycle
job counts passed. This verifies configuration capture and first-group output
replacement across consecutive jobs.

## Physical comparison and source integrity

See [synthesis/README.md](synthesis/README.md) and the matched
[comparison report](../../comparisons/vivado/comparison/REPORT.md) for Vivado resource,
routed timing and power evidence. Full-core measurement copies expose existing
output SRAM read data without adding memory ports; numerical/default cycle
checks passed for all three copies before physical implementation. Each
synthesized core also passed a focused default-job comparison of busy/done,
known live accumulation bits and output SRAM observation bits against RTL
on every job cycle. Zero-delay netlist SAIF supplies the final power estimates;
this is not formal equivalence or a physical glitch simulation.

All product RTL files are byte-identical between the two channel-last projects
except `rtl/im2col_addr_gen.v`. The parent channel-first sources and reference
tensors remain unchanged. `02_validated_channel_last` records this working
implementation, its reference tensors and synthesis method after validation.
Large generated reports, physical checkpoints, simulator binaries and waves
are kept outside the numbered source snapshot.

Commands and logs reside in `im2col_comparison`: `compare_sim.py`,
`check_job_control.py`, `verify_measurement_copies.py`, `sim/tb_banked_input.v`,
and the corresponding `comparison/` evidence directories. These checks validate
the simulated RTL and measured FPGA build; they do not establish ASIC SRAM
macro timing, DRAM bandwidth, board power or unconstrained host interfaces.
