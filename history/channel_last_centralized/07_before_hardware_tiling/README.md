# Channel-last implicit im2col: centralized address generation

One vector generator explicitly shares batch/position decoding, window origin and spatial-tile dimensions across rows.

This is a self-contained sibling of the channel-first implementation. Read
[DECISIONS.md](DECISIONS.md) and [workspace AGENTS.md](../../AGENTS.md). Its immutable
source checkpoints are in [channel_last_im2col_centralized_versions](../../history/channel_last_centralized/README.md). The matched
FPGA comparison is in [im2col_comparison](../../comparisons/vivado/README.md).

## Operation and row mapping

Logical input/kernel/output shapes and tensor-file orders remain `(N,C,H,W)`,
`(K,C,R,S)`, `(N,K,P,Q)` (NCHW/KCRS/NKPQ). Signed operands are `BIT_WIDTH` bits,
and all channel/group accumulation wraps at `ACC_WIDTH`. Kernels perform CNN
cross-correlation without reversal, bias or post-processing.

The reduction index is `t=(c*R+r)*S+s`, with `s` varying fastest. A pass maps
`t=group_base+ROW_INDEX` to each physical row, with inactive tail rows zeroed:

```text
c = t // (R*S)
r = (t // S) % R
s = t % S
n = position % N
p = (position // N) // Q
q = (position // N) % Q
h = p*stride_i + r*dilation_i - pad_i
w = q*stride_j + s*dilation_j - pad_j
```

Each column remains output channel `k`. There are `ceil(C*R*S/ARRAY_SIZE)`
passes. The first overwrites output SRAM; subsequent passes accumulate into it.
No expanded im2col matrix is stored. Each pass streams all `N*P*Q` output
positions, with `n` varying fastest, then drains the physical pipeline.

## Input bank layout

The preload bus lane selects a physical **bank**, not an input channel. Each
bank stores each assigned input sample once using this invertible layout:

```text
tile_rows = ceil(H/R)
tile_cols = ceil(W/S)
slot = c*R*S + (h % R)*S + (w % S)
bank = slot % ARRAY_SIZE
address = ((slot // ARRAY_SIZE)*tile_rows*tile_cols
           + (h // R)*tile_cols + w // S)*N+n
```

Distinct `(n,c,h,w)` coordinates never alias. Partial spatial tiles leave
unused locations; these are not replicated samples. This offline placement
spreads a unit-stride kernel window across distinct banks when a full `R*S`
group occupies `R*S` banks. With ten banks and a nine-tap kernel, groups
crossing channel boundaries can conflict. Dilation can also produce collisions.
The placement is an explicit implementation choice, not a claim of the paper's
exact bank-address circuit.

Output SRAM still selects array `k`, address `(p*Q+q)*N+n`. Kernel SRAM still
selects array `k`, address `(c*R+r)*S+s`.

## Bank timing and stalls

Each input bank has one enabled synchronous read port and one preload write
port. Writes are accepted only while the core is idle. Lowest physical row
wins a conflict. Requests for the same bank word broadcast one read to all
requesting rows; different addresses in that bank are retried on later clocks.
Different banks service reads concurrently. Each accepted read returns after
one synchronous SRAM latency.

Two vector slots overlap arbitration, SRAM return and consumption. A complete
vector must be ready before the array advances. One `advance` enables the
activation skew registers, PE activation/partial-sum pipeline, column output
registers and output writeback counters together. When stalled, they hold their
state and SRAM output writes are disabled. Weight prefetch/shift proceeds
independently into the inactive per-PE stationary weight registers.

The loader performs one PRIME cycle and `ARRAY_SIZE` initial weight shifts.
Next-group weights load during the current pass. The controller switches groups
and weight buffers only after the pass's final drain step. Each pass contains
`N*P*Q+2*ARRAY_SIZE` array-advance steps and its actual memory-wait clocks.

With `G=ceil(C*R*S/ARRAY_SIZE)`:

```text
start_to_done_cycles = 1 + ARRAY_SIZE
                     + G*(N*P*Q + 2*ARRAY_SIZE) + (G-1)
                     + measured_memory_stall_cycles
```

`conflict_retry_cycles` counts bank arbitration rounds with unserved distinct
addresses. It is separate from `memory_stall_cycles`: SRAM return latency,
buffer occupancy and overlap affect whether a retry stalls computation. No
analytic penalty is added to the controller's completion time.

## Modules and interfaces

| Module | Ownership |
|---|---|
| `conv_core` | Runtime configuration capture and top-level wiring |
| `conv_controller` | Reduction group sequencing and weight-buffer switching |
| `weight_loader` | Initial/background kernel reads and descending row shifts |
| `conv_datapath` | Array-advance steps, activation skew, output accumulation |
| `im2col_addr_gen` | Row request coordinates, bank IDs, addresses and padding validity |
| `banked_input` | Arbitration, return routing and two vector slots |
| `input_bank` | One physical input SRAM bank and synchronous read data |
| `kernel_bank` | One output channel's kernel SRAM |
| `PE`, `systolic_array` | Signed, double-buffered stationary-weight compute |
| `output_accumulator`, `sram` | Output SRAM read-modify-write across groups |

The top-level runtime/preload/control interface matches channel-first. The
input preload layout differs as specified above. `acc_col_out` remains a live
pipeline output; final tensor export probes output SRAM through testbench
hierarchy. There is no host bus, DMA, DRAM refill model or new host readback
interface.

## Hardware parameters and valid jobs

Source defaults: `ARRAY_SIZE=4`, `BIT_WIDTH=8`, `ACC_WIDTH=32`, `CFG_WIDTH=32`,
and all three SRAM address widths 8. The supplied testbench uses a ten-by-ten
array and preserves the reference example `N=1,C=4,H=W=6,K=2,R=S=3`, no padding,
unit stride/dilation. New starts capture configuration; later external changes
do not change a job. A new job's first group replaces earlier output sums.

Keep `1<=C,K<=ARRAY_SIZE`, positive dimensions/stride/dilation and sane geometry.
Output words per array must fit `2**OUTPUT_ADDR_WIDTH`; kernel words per array
must fit `2**KERNEL_ADDR_WIDTH`. Every computed input-bank address must fit
`2**INPUT_ADDR_WIDTH`. This safe sufficient bound includes unused spatial slots:

```text
ceil(C*R*S/ARRAY_SIZE)*ceil(H/R)*ceil(W/S)*N <= 2**INPUT_ADDR_WIDTH
```

All counts and geometry arithmetic must also fit the selected configuration
width. Increasing `CFG_WIDTH` does not increase memory capacity. The FPGA
comparison uses the same explicit nine-bit configuration build for all three
cores; it does not change these source defaults.

## Simulation

Use Python 3, Bash and Icarus Verilog with SystemVerilog enabled:

```bash
python3 run_case.py --out-dir /tmp/channel_last_example
python3 test_cases.py --cases 64 --out-dir /tmp/channel_last_sweep
```

`run_case.py` and `gen_matrices.py` share the original geometry CLI. The generator
retains the course's `conv_golden.py`; tensors remain bit-identical for matched
seeds and shapes. The testbench checks every output, input preservation and the
elapsed-cycle equation using observed stalls. It prints memory-stall, conflict
retry, array-advance and bank-read counts, and dumps actual memory contents.
`run.sh` recompiles by default. Run validation in a temporary source copy to
keep reference fixtures unchanged. The comparison runner compiles once per
variant and also checks read/retry counts against an independent access model.

See [VALIDATION.md](VALIDATION.md) for evidence actually collected.

## Attribution and limits

Zhou et al.'s Section II-C/Figure 3 describes the banked-memory/crossbar implicit
baseline; Section III-A/Figure 6 specifies its channel-last reduction ordering.
This project implements that architectural pattern on the existing stationary-
weight array. The bank placement, two-slot buffering and stall protocol are
explicit choices made here. It does not reproduce proprietary GPU/TPU internals
or the paper's DRAM-refill/stride measurements.

## Credits

https://github.com/kaggar11/systolic_4x4arr 
    
- Code was initially based on this. It's pretty much a Ship of Theseus thing now at this point since the only recognizable parts are the PE and the PE array buses but still worth acknowledging.

"Characterizing and Demystifying the Implicit Convolution Algorithm on Commercial Matrix-Multiplication Accelerators" by
Zhou et al.
- https://doi.org/10.48550/arXiv.2110.03901 
- Channel-first implicit im2col algorithm and TPU architecture taken from here.

# Note on AI-use

Codex and GPT-6.1 Sol was used to assist in the creation of this project.

