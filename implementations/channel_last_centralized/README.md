# Channel-last implicit im2col: centralized address generation

One vector generator explicitly shares batch/position decoding, window origin and spatial-tile dimensions across rows.

This is a self-contained sibling of the channel-first implementation. Read
[DECISIONS.md](DECISIONS.md) and workspace AGENTS.md (`../../AGENTS.md`, original workspace reference). Its immutable
source checkpoints are in [channel_last_im2col_centralized_versions](../../history/channel_last_centralized/README.md). The matched
FPGA comparison is in im2col_comparison (`../../comparisons/vivado/README.md`, original workspace reference).

## Hardware-controlled tiled layers

`conv_accelerator` captures a full-layer descriptor and word base addresses on
idle `start`. Hardware schedules image → output-channel block → output row →
output-column block → input-channel block → optional kernel tap. Each local job
has N=P=1. Full-layer C and K may exceed ARRAY_SIZE; local jobs still fit it.

Backing memory is an array only in `sim/tb_conv_accelerator.v`. RTL exposes one
enabled synchronous read and one edge write. Read data is consumed on the
following edge; transfers and compute are serialized. Memory words are
max(BIT_WIDTH, ACC_WIDTH) bits; low bits hold one operand or result. External
orders remain NCHW/KCRS/NKPQ. There is no AXI, variable latency, backpressure or
physical memory controller. `done` follows the last output store. Reset aborts
control and retains memories; an aborted layer is incomplete. Busy starts and
configuration changes are ignored. Invalid descriptors are not rejected by RTL.

With A=ARRAY_SIZE and per-bank depths Di/Dw/Do, the full-kernel planner uses:

```text
ei = dilation_i*(R-1)+1; ej = dilation_j*(S-1)+1; T = R*S
Tr = ceil(ei/R); Tc_min = ceil(ej/S)
Ct = min(A, floor(Dw/T), floor(floor(Di/(Tr*Tc_min))*A/T))
G = ceil(Ct*T/A)
Qt = min(Do, 1 + floor((S*floor(Di/(G*Tr))-ej)/stride_j))
```

If T>Dw or ceil(T/A)*Tr*Tc_min>Di, use one-tap jobs with local R=S=1,
Ct=min(A,Dw), Qt=min(Do,1+floor((Di-1)/stride_j)). This guarantees progress even
when one channel's kernel or minimum patch cannot fit. Tails shrink. The input
rectangle is clipped to real pixels; adjusted local padding leaves zero injection
inside the original address generator. Empty patches skip input DMA. Input DMA
places each sample in the residue-swizzled bank/address specified below using
**local** dimensions and coordinates, including unused spatial slots. No im2col
matrix is stored. The planner is conservative; it does not maximize reuse.

Output tiles remain local across every channel/tap contribution. The core
captures `cfg_continue_sum` at start: first contributions overwrite, later jobs
accumulate even on group zero. `output_read_enable/output_read_addr` provide
synchronous idle-only readback, one word per column, on `output_read_data`.
Read data must be sampled after its enabled edge; it is not cleared by reset.
Direct-core callers tie continue/read enables low. Existing bank arbitration,
two vector slots, real compute stalls and PE weight double buffering remain.

```sh
python3 run_case.py --tiled --N 2 --C 7 --K 6 --H 5 --W 6 --R 2 --S 3 \
  --pad_i 1 --pad_j 2 --stride_i 2 --dilation_i 2 --out-dir /tmp/cl_layer
python3 test_cases.py --tiled --cases 8 --seed 20261016 --out-dir /tmp/cl_sweep
```

The demonstration bench resets and starts one layer, models backing memory via
public ports, then checks/exports all final outputs against signed convolution.
The Python runner also checks its golden tensor. It reports actual layer clocks
and backing transfers. Without `--tiled`, the existing direct-core bench runs.
Use a temporary source copy for validation so fixtures and build products do
not alter the checked source. Preserve positive consistent geometry, sufficient
nonoverlapping backing regions, and representable CFG/MEM addresses and counts.
Source defaults remain A4/CFG32, 8-bit operands, 32-bit sums, and independent
8-bit local address widths. No synthesis or physical timing claim accompanies
this implementation. See checkpoint 08 and the hardware-tiling validation record.

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
hierarchy. The optional accelerator adds hardware scheduling and serialized transfers;
the direct core retains its preload interface and adds idle output readback.

## Hardware parameters and valid jobs

Source defaults: `ARRAY_SIZE=4`, `BIT_WIDTH=8`, `ACC_WIDTH=32`, `CFG_WIDTH=32`,
and all three SRAM address widths 8. The supplied testbench uses a ten-by-ten
array and preserves the reference example `N=1,C=4,H=W=6,K=2,R=S=3`, no padding,
unit stride/dilation. New starts capture configuration; later external changes
do not change a job. A new job's first group replaces earlier output sums unless continuation is captured.

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

See [VALIDATION.md](VALIDATION.md) for evidence actually collected. Historical
FPGA measurements refer to the earlier core sources in their archives.

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

