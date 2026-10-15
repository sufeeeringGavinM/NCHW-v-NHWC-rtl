# Channel-first implicit-im2col convolution implementation

This project implements signed convolution (cross-correlation) using a square
systolic array. A shared im2col address generator reads input samples for each
kernel tap without storing an expanded im2col matrix. `conv_core` runs the `conv_datapath`
for each tap and accumulates results in SRAM. Each PE
has two stationary weight registers: one supplies the current tap while the
other receives the next tap from the kernel SRAM.


## Hardware-controlled tiled layers

`conv_accelerator` wraps `conv_core` with a hardware tile scheduler and a
serialized transfer engine (a simple DMA engine). Supply the full layer geometry,
`P,Q`, and `cfg_input_base/cfg_kernel_base/cfg_output_base`, then pulse `start`
while idle. Hardware performs every tile load, compute job, partial-sum
continuation and final store. `done` follows the final output-memory write.
The layer configuration and base addresses are captured at accepted start;
changes and further starts while busy are ignored. Reset aborts the layer and
clears control, retaining all memories. Outputs of an aborted layer are incomplete.

The memory itself is **only an array inside `sim/tb_conv_accelerator.v`**. There
is no off-chip-memory RTL module. Its interface is one enabled synchronous
read (`mem_re`, `mem_raddr`, `mem_rdata`) and one edge write (`mem_we`,
`mem_waddr`, `mem_wdata`). A read issued at an edge supplies data after that edge;
the transfer engine consumes it on the following edge. Writes commit at the edge
with `mem_we=1`. There is no backpressure or variable memory latency. Transfers
and compute do not overlap. This is a functional memory contract, without a
physical memory controller, AXI, bursts or a byte-addressed DMA protocol.

Addresses count **words**, one tensor element per word. Memory data width is
`max(BIT_WIDTH,ACC_WIDTH)` (32 by default); inputs and weights use its low
`BIT_WIDTH` bits, and outputs its low `ACC_WIDTH` bits. Full tensors retain
NCHW/KCRS/NKPQ order. Local input/kernel/output SRAM layouts remain those in the
storage table below. Array size, local capacities and precision defaults are
unchanged. Memory addresses default to 32 bits in hardware; the system bench uses
16 bits and 65,536 words, with gaps between tensors to catch address mistakes.

The loop order is image, output-channel block, output row, output-column block,
input-channel block, and (when required) kernel tap. Each job has local `N=P=1`.
For the normal full-kernel mode, with `Di/Do/Dw` the per-bank input/output/kernel
depths:

```text
ei = dilation_i*(R-1)+1; ej = dilation_j*(S-1)+1
Ct = min(ARRAY_SIZE, floor(Dw/(R*S)))
Qt_limit = min(Do, 1 + floor((floor(Di/ei)-ej)/stride_j))
Kt = min(ARRAY_SIZE, remaining output channels)
Qt = min(Qt_limit, remaining output columns)
```

The requested input patch has height `ei`, width `(Qt-1)*stride_j+ej`, and origin
`(p0*stride_i-pad_i, q0*stride_j-pad_j)`. Hardware clips it to the actual image,
loads real pixels only, and supplies the clipped dimensions and adjusted local
padding to the unchanged im2col address generator. That generator and feeder
still inject padding zeros. An entirely padded patch has a zero local height
or width, so the generator marks every input invalid and DMA skips input reads.
This empty internal tile is intentional; full-layer input dimensions are positive.

If `R*S>Dw` or `ei*ej>Di`, hardware uses one-tap jobs, with local `R=S=1`,
`Ct=min(ARRAY_SIZE,Dw)` and `Qt_limit=min(Do,1+floor((Di-1)/stride_j))`.
The patch origin includes that tap's dilation offset; width becomes
`(Qt-1)*stride_j+1`. It iterates all original taps and channel blocks. This
fallback allows even one channel's full kernel or minimum full-kernel footprint
to exceed local SRAM capacity. It preserves implicit address generation rather
than storing an expanded im2col matrix.

The output tile stays in output SRAM until every contribution is complete.
The first job initializes sums; later jobs capture `cfg_continue_sum=1` and
accumulate even on their first tap. PE weight double buffering still operates
inside full-kernel jobs. Final sums are read through the core's synchronous
idle-only output port, then written to backing memory. There is no off-chip
partial-sum traffic.

The hardware expects positive, consistent full-layer geometry and dimensions,
counts and addresses representable by `CFG_WIDTH/MEM_ADDR_WIDTH`; tensor regions
must fit backing storage and not overlap. It does not reject invalid commands.
The testbench validates its configured layer and memory capacity. This first
scheduler favors simple ownership over reuse: halos and kernels are reloaded
for output tiles; batch size within a tile is one, and tile height is one.

```sh
python3 run_case.py --tiled --N 2 --C 7 --K 6 --H 5 --W 6 --R 2 --S 3 \
  --pad_i 1 --pad_j 2 --stride_i 2 --dilation_i 2 --out-dir /tmp/cf_tiled
python3 test_cases.py --tiled --cases 6 --seed 20261024 --out-dir /tmp/cf_tiled_cases
python3 run_case.py --tiled --reset-test --out-dir /tmp/cf_tiled_reset
```

The system test initializes only backing input/kernel tensors; hardware owns
all tile scheduling and transfers. It checks every intermediate partial sum,
full outputs, input/kernel preservation, no duplicate or out-of-range transfers,
and layer cycle accounting. It runs each layer twice without reset, perturbs
configuration and issues an ignored busy start. `--reset-test` first aborts an
initial layer during computation. `run_case.py` also compares exported values
with the Python golden tensor. `test_cases.py --tiled` independently checks tile
and job counts; its metrics are layer cycles including transfers, rather than
core-only cycles or the old channel-occupancy metric.

The core-only interface, storage and timing follow below. `run_case.py` without
`--tiled` keeps the existing direct-preload core test.

## Reading this project

The active project directory is `channel_first_im2col_implementation`.
This README describes the active implementation. Read [DECISIONS.md](DECISIONS.md)
for the rationale behind architectural choices and [workspace AGENTS.md](../AGENTS.md)
for the approval, checkpoint, and validation workflow. The
[version archive](../im2col_versions/README.md) records earlier implementations;
it is not the specification for the current RTL.

Start with the module hierarchy and job sequence when tracing a run. Use the
layout table when translating a tensor coordinate to a memory location. The
source files remain the authority if a documented detail becomes stale.

- [Hardware-controlled tiled layers](#hardware-controlled-tiled-layers)
- [Operation and geometry](#operation-and-geometry)
- [Runtime configuration](#runtime-configuration)
- [Tensor-file and SRAM storage layouts](#tensor-file-and-sram-storage-layouts)
- [Modules and ownership](#modules)
- [Address generation and array operation](#address-generation-and-array-operation)
- [Memory layout and precision](#memory-layout-and-precision)
- [Core interface](#core-interface)
- [Job sequence and timing](#running-the-core)
- [Simulation and metrics](#fixtures-and-simulation)
- [Limitations and next work](#limitations-and-next-work)

## Operation and geometry

The implemented operation is dense 2-D cross-correlation, conventionally called
convolution in CNNs. Kernels are not reversed. There is no bias or post-processing.
For each logical output:

```text
Y[n,k,p,q] = sum over c,r,s of X[n,c,h,w] * Wgt[k,c,r,s]
h = p*stride_i + r*dilation_i - pad_i
w = q*stride_j + s*dilation_j - pad_j
```

Terms whose input coordinates are outside the image contribute zero. The PE
array sums channels for one `(r,s)` tap at a time; output SRAM accumulates those
results across `R*S` taps. This is implicit im2col: addresses select the samples
on demand, without constructing an expanded matrix in memory.

## Logical tensor shapes

These shapes describe convolution dimensions and coordinates independently of
how values are stored in tensor files or SRAM.

| Tensor | Logical shape | Coordinates |
|---|---|---|
| Input | `(N,C,H,W)` | `(n,c,h,w)` |
| Kernel | `(K,C,R,S)` | `(k,c,r,s)` |
| Output | `(N,K,P,Q)` | `(n,k,p,q)` |

The core processes `N` images per start, all using the same kernel. Images
are interleaved within each tap. Logical channel counts satisfy
`1 <= C,K <= ARRAY_SIZE`; `N` is positive and limited by SRAM capacity.

## Runtime configuration

| Setting | Interface |
|---|---|
| Runtime dimensions | `cfg_N`, `cfg_C`, `cfg_K`, `cfg_H`, `cfg_W`, `cfg_R`, `cfg_S`, `cfg_P`, `cfg_Q` |
| Runtime padding | `cfg_pad_i`, `cfg_pad_j` |
| Runtime stride | `cfg_stride_i`, `cfg_stride_j` |
| Runtime dilation | `cfg_dilation_i`, `cfg_dilation_j` |
| Fixed hardware parameters | `ARRAY_SIZE`, `BIT_WIDTH`, `ACC_WIDTH`, `INPUT_ADDR_WIDTH`, `OUTPUT_ADDR_WIDTH`, `KERNEL_ADDR_WIDTH`, `CFG_WIDTH` |

Configuration ports are unsigned `CFG_WIDTH`-bit values, defaulting to 32 bits.
The core captures all configuration into registers on the rising edge that
accepts `start` while idle. Changing the ports during a run does not affect
that run. They are direct RTL ports; the design has no register-bus interface.

`i` is the height axis; `j` is the width axis. Padding is symmetric within each
axis. Software supplies `P,Q` consistent with the geometry:

```text
extent_i = dilation_i*(R-1) + 1
extent_j = dilation_j*(S-1) + 1
P = floor((H + 2*pad_i - extent_i) / stride_i) + 1
Q = floor((W + 2*pad_j - extent_j) / stride_j) + 1
```

Dimensions, stride, and dilation are positive; padding is nonnegative. The
dilated kernel fits within the padded input. Configuration and tensor contents
must fit the fixed memory capacities. Kernel coordinates use `CFG_WIDTH` bits.
The RTL assumes these conditions rather
than rejecting malformed jobs. Intermediate counts and addresses must also fit
their RTL widths; a physically valid convolution formula does not guarantee that
an arbitrarily large configuration is representable.

## Hardware and example defaults

These are the defaults in the checked source, not restrictions on every build.
Preserve user edits to them when making unrelated changes.

| Parameter | `conv_core` RTL default | Supplied testbench |
|---|---|---|
| `ARRAY_SIZE` | 4 | 10 |
| `BIT_WIDTH` | 8 | 8 |
| `ACC_WIDTH` | 32 | 32 |
| `INPUT_ADDR_WIDTH` | 8 | 8 |
| `OUTPUT_ADDR_WIDTH` | 8 | 8 |
| `KERNEL_ADDR_WIDTH` | 8 | 8 |
| `CFG_WIDTH` | 32 | Core default of 32 |

The generator and testbench example is `N=1, C=4, H=W=6, K=2, R=S=3`,
zero padding, unit stride, and unit dilation. It produces `P=Q=4`, or 32
output values. The ten-by-ten simulation array is selected by the testbench;
`C=4` does not set the physical array size.

Tensor dimensions and geometry are runtime ports. Array shape, data widths,
SRAM depths, and counter/configuration widths are hardware parameters selected
when compiling/elaborating a build. Python fixture precision is fixed separately
in `gen_matrices.py`; changing a hardware width requires coordinating it with
the generator and testbench. Geometry CLI flags do not change those widths.

## Tensor-file and SRAM storage layouts

| Tensor | Tensor-file order | SRAM array | Within-array order | SRAM address |
|---|---|---|---|---|
| Input | NCHW | Input array `c` | HWN | `(h*W+w)*N+n` |
| Kernel | KCRS | Kernel array `k` | CRS | `(c*R+r)*S+s` |
| Output | NKPQ | Output array `k` | PQN | `(p*Q+q)*N+n` |

The corresponding tensor-file offsets are:

```text
input_offset  = ((n*C+c)*H+h)*W+w
kernel_offset = ((k*C+c)*R+r)*S+s
output_offset = ((n*K+k)*P+p)*Q+q
```

In each storage order, the rightmost coordinate varies fastest. Tensor files
contain hexadecimal values in the logical dimension order. The testbench
rearranges inputs into the per-channel SRAM layout and exports outputs in
NKPQ order.
Kernel-file values map to kernel array `k`, with `(c,r,s)` varying within
that array.

Within each input or output SRAM array, images are interleaved with `n`
varying fastest.
For `N=2`, input SRAM array `c` starts with logical `(n,c,h,w)` coordinates
`(0,c,0,0)`, `(1,c,0,0)`, `(0,c,0,1)`, `(1,c,0,1)`, and so on.
Inputs and outputs occupy separate SRAM arrays, each starting at address zero.
Outputs use the same image-minor ordering. Each SRAM word contains one value.

The physical storage has fixed array counts and depths. The logical tensor
shapes are runtime values; they determine which SRAM arrays and addresses
are used. Logical NCHW shapes and image-interleaved SRAM ordering are different
concepts; the storage table, rather than a single NCHW/NHWC label, specifies the
hardware layout.

## Modules

| Module | Responsibility |
|---|---|
| [im2col_addr_gen](rtl/im2col_addr_gen.v) | Batch/spatial coordinate decoding, input SRAM address, and padding validity. |
| [PE](rtl/PE.v) | Registered signed multiply-accumulate with two stationary weight registers. |
| [conv_datapath](rtl/conv_datapath.v) | Shared address generation, stream position, and wiring SRAM arrays to the PE array. |
| [activation_feeder](rtl/activation_feeder.v) | Owns one input SRAM, preload writes, row skew, and activation delivery. |
| [output_accumulator](rtl/output_accumulator.v) | Owns one output SRAM, writeback timing, and accumulation across taps. |
| [systolic_array](rtl/systolic_array.v) | PE grid, weight forwarding, and registered column outputs. |
| [kernel_bank](rtl/kernel_bank.v) | One output channel’s kernel SRAM and synchronous read interface. |
| [weight_loader](rtl/weight_loader.v) | Kernel read addresses and initial/background weight shifting. |
| [sram](rtl/sram.v) | Parameterized SRAM model with one write port and one synchronous read port. |
| [conv_core](rtl/conv_core.v) | Runtime configuration, sum continuation and idle output readback. |
| [conv_accelerator](rtl/conv_accelerator.v) | Full-layer tile scheduling and serialized backing-memory transfers. |
| [conv_controller](rtl/conv_controller.v) | Tap sequencing, pass timing, start/busy/done, and active weight-buffer selection. |

The hardware hierarchy is:

```text
conv_core                       Configuration capture and module wiring
├── conv_controller             Tap sequencing and run control
├── weight_loader               Initial and background weight loading
├── kernel_bank × ARRAY_SIZE    Kernel storage
└── conv_datapath               Address generation and stream position
    ├── im2col_addr_gen
    ├── activation_feeder × ARRAY_SIZE
    │   └── sram                 Input storage, BIT_WIDTH bits
    ├── output_accumulator × ARRAY_SIZE
    │   └── sram                 Output/partial sums, ACC_WIDTH bits
    └── systolic_array
        └── PE × ARRAY_SIZE²
```

Each activation feeder owns one input SRAM and accepts external preload writes.
Each output accumulator owns one output SRAM and handles read-modify-write
accumulation. The `conv_datapath` connects feeders by input row `c` and
accumulators by
output column `k` in separate loops. `ROW_INDEX` determines a feeder's physical
skew delay; `COL_INDEX` determines an accumulator's physical writeback delay.
Runtime `C` and `K` enable input rows and output columns independently.
The weight loader owns the descending row counter and prefetch/shift phases.
The convolution controller owns tap coordinates, run timing, and active
weight-buffer selection. Each activation feeder adds one stage to the shared
row-skew chain (row zero has no delay), then aligns validity with its SRAM read.
Each output accumulator owns its writeback counter and output pointer.

The control path is `conv_controller -> weight_loader / conv_datapath`; the data
path is `input SRAM -> activation_feeder -> systolic_array -> output_accumulator
-> output SRAM`. Kernel data follows `kernel_bank -> weight_loader -> top PE row
-> lower PE rows`. The controller selects the tap and buffer, while the loader
produces the individual memory requests and shift pulses. The modules advance
on the same clock; there is no ready/valid backpressure between these stages.

### State owned by each module

| Owner | Persistent state during a job |
|---|---|
| [conv_core](rtl/conv_core.v) | Captured dimensions and geometry |
| [conv_controller](rtl/conv_controller.v) | FSM state, current tap `(r,s)`, run counter, active weight-buffer bit, `done` pulse |
| [weight_loader](rtl/weight_loader.v) | Descending load-row counter and PREFETCH/SHIFT_WEIGHTS/WEIGHTS_READY phase |
| [conv_datapath](rtl/conv_datapath.v) | Stream-position counter |
| [activation_feeder](rtl/activation_feeder.v) | Input SRAM, row-skew stage where needed, delayed padding validity |
| [PE](rtl/PE.v) | Two weights, forwarded activation/weight, and registered partial sum |
| [systolic_array](rtl/systolic_array.v) | Registered result from each bottom-row PE |
| [output_accumulator](rtl/output_accumulator.v) | Output SRAM, writeback counter and write pointer |
| [kernel_bank](rtl/kernel_bank.v) | Kernel SRAM and registered read data |

Splitting the modules does not add independent job scheduling. `conv_controller`
sets the global pass duration; feeder and writeback counters implement the
fixed-latency stream within that duration.

## Address generation and array operation

### Activation addresses

For tap `(r,s)`, the stream visits all images at each output spatial position.
The `conv_datapath` advances the stream-position counter and presents the next position
one cycle ahead of activation feeding for the synchronous SRAM read.
`im2col_addr_gen` decodes that position and computes the complete input address:

```text
n = position % N
pix = position / N
p = pix / Q
q = pix % Q
h = p*stride_i + r*dilation_i - pad_i
w = q*stride_j + s*dilation_j - pad_j
sram_addr = (h*W+w)*N+n
```

`n` varies fastest within each spatial output position. The address selects a
word within the SRAM array for input channel `c`; the channel index selects
the array, not part of the address. `valid` is true when `0 <= h < H` and
`0 <= w < W`. For padding positions, the generator returns address zero and
the activation feeder supplies zero. The caller bounds `position < N*P*Q`,
`r < R`, and `s < S`; the generator checks input bounds. Runtime division and
remainder by `N` and `Q` are part of the combinational address path.

### Kernel addresses and weight loading

`weight_loader` generates the shared kernel SRAM read address:

```text
kernel_raddr = (c_read*R + kernel_r)*S + kernel_s
```

Every `kernel_bank` instance receives the same address. Instance `k` supplies
weight `(k,c_read,kernel_r,kernel_s)` from its independent SRAM array; `k` is
selected by the instance, not encoded in the address. Initial loading uses the
current tap `(r,s)`. Background loading during RUN uses `(next_r,next_s)` and
writes the inactive PE weight registers while the current tap computes.

Weights enter the top PE row and shift downward. The loader supplies channel
coordinates in descending physical-row order, from `ARRAY_SIZE-1` to zero,
so each weight reaches its corresponding row. Kernel reads are synchronous:
one PRIME or PREFETCH cycle fetches the first row before shifting begins.
During each shift, `c_load` identifies the row being loaded, while the SRAM
read requests the following row:

```text
c_read = (load_weights && c_load != 0) ? c_load-1 : c_load
```

The returned data is available for the next clock's weight shift. Reads for
`c_read >= C` or kernel instances `k >= K` return zero. The loader performs
`ARRAY_SIZE` shifts even when fewer input channels are active. There is no
background preload after the final tap.

### Array operation and writeback

PE row `c` consumes input channel `c`; PE column `k` produces output channel
`k`. Activations move right and partial sums move down. The `conv_datapath`
prefetches for the one-cycle SRAM read latency. Activation feeders form a shared
chain that delays the feed bundle by `c` cycles for row `c`. The bottom physical
row supplies registered column results. Rows `c >= C` receive zero activations and weights; columns
`k >= K` receive zero weights and have writeback disabled. The physical array
is `ARRAY_SIZE` by `ARRAY_SIZE`. Internal activation, weight, and partial-sum
connections are unpacked arrays of separate word-sized PE nets. Each column
has a registered output from the bottom physical row.

A direct `conv_datapath` caller keeps its configuration, `(r,s)`, and `accumulate` stable
throughout a pass, loads weights across all physical rows in descending row
order, and runs the pass for `N*P*Q+2*ARRAY_SIZE` cycles. The first tap overwrites
outputs; later taps use `accumulate=1`. Writeback writes exactly `N*P*Q` words
per active column. Feed enables stop after the configured output positions,
while the physical pipeline drains. The caller controls pass duration and
asserts `clear_pass` between passes to clear counters and partial sums.
`load_weights` shifts weights into the register selected by `weight_write_buffer`;
`weight_read_buffer` selects the register used for multiplication. Loading and
computation are independent. Each PE computes `acc_out = acc_in + data_in *
active_weight` at a clock edge while forwarding its activation to the right.
The incoming sum comes from the row above, or zero for the first row. The PE's
sum register is a pipeline stage; accumulation across different taps happens
in output SRAM. A manual caller can hold both buffer selectors at zero and assert
`clear_pass` during loading. `conv_core` handles these steps internally.

### Output read-modify-write timing

For output column `k`, `output_accumulator` uses
`WB_START_CYCLE = k + ARRAY_SIZE + 1`. With its counter reset between taps,
writeback is enabled for `N*P*Q` consecutive counter values starting there.
The pointer starts at zero and advances only on a write. The column delay
accounts for activation travel to column `k`; the common delay accounts for
channel reduction through all physical rows and the registered column output.

With `cfg_continue_sum=0`, the first tap writes the column result. On later taps it is
`old_out + result_in`. The read address anticipates the pointer for the next
cycle so the synchronous read supplies the old sum when that word is written.
With `cfg_continue_sum=1`, the first tap also uses `old_out + result_in`.
Every logical address is written once per tap. The controller drains the
current pass before changing `(r,s)` or the active weight register.

## Memory layout and precision

There are `ARRAY_SIZE` input SRAM arrays, `ARRAY_SIZE` output SRAM arrays,
and `ARRAY_SIZE` kernel SRAM arrays: `3*ARRAY_SIZE` modeled memories in total.
Runtime `C,K` select active channels; they do not change the physical array count.
Each PE also has two `BIT_WIDTH` stationary weight registers, totaling
`2*ARRAY_SIZE*ARRAY_SIZE` weight words, separate from kernel SRAM and the
registered weight-forwarding chain. Memories are RTL arrays without instantiated
physical SRAM macros. These are independent per-channel arrays, not a single
internally multi-banked SRAM macro. `kernel_bank` is a module name for one such
kernel array. Each input/output SRAM has one write port and one
synchronous read port.

| Memory | Word width | Depth per array | Required words per active array |
|---|---|---|---|
| Input SRAM | `BIT_WIDTH` | `2**INPUT_ADDR_WIDTH` | `N*H*W` |
| Output/partial-sum SRAM | `ACC_WIDTH` | `2**OUTPUT_ADDR_WIDTH` | `N*P*Q` |
| Kernel SRAM | `BIT_WIDTH` | `2**KERNEL_ADDR_WIDTH` | `C*R*S` |

Inputs and outputs each start at address zero in their own memories.
`INPUT_ADDR_WIDTH` and `OUTPUT_ADDR_WIDTH` set their depths independently; both
default to 8 bits (256 words per array). Each owner passes its address width to
the generic `sram` module. Addresses and tensor-file orders are listed in
[Tensor-file and SRAM storage layouts](#tensor-file-and-sram-storage-layouts).
Every job uses the kernels preloaded for its configured shape. For a valid job:

```text
1 <= C <= ARRAY_SIZE
1 <= K <= ARRAY_SIZE
N*H*W <= 2**INPUT_ADDR_WIDTH
N*P*Q <= 2**OUTPUT_ADDR_WIDTH
C*R*S <= 2**KERNEL_ADDR_WIDTH
```

All three capacities apply separately, per active array. Exact capacity is
allowed. Address casts do not provide bounds checking: exceeding capacity can
wrap/truncate addresses. The Python sweep filters its cases to fit the memories;
the standalone generator does not read the hardware's capacity parameters.

SRAM is not cleared by reset or by a job. Only preloaded words and active output
words are overwritten. Unused addresses may contain unknown values in a fresh
simulation, or old values after earlier writes. A value in an unused region is
not itself an error; unused words must not be treated as tensor data. The `sram`
model returns the old memory word on a simultaneous read and write to the same
address. Kernel read data holds its previous value when reads are disabled;
an enabled read for an inactive channel returns zero.

Activations and weights are signed `BIT_WIDTH` values. Input SRAM stores the
operand-width bits directly. Products, partial sums, output writes, and
cross-tap accumulation use `ACC_WIDTH` bits and wrap at that width.
Use `ACC_WIDTH >= BIT_WIDTH`. The output SRAM read port prefetches the previous
output value one cycle ahead of read-modify-write accumulation across taps.

## Core interface

All ports are synchronous to `clk`; `nrst` is an active-low **synchronous** reset.
The table describes the top-level `conv_core`, rather than its lower-level
single-tap datapath.

| Port group | Contract |
|---|---|
| `start` | Accepted on a rising edge with `nrst=1` and `busy=0`; pulse for one job |
| `busy` | High while the controller is outside IDLE |
| `done` | One-cycle pulse when the final tap completes |
| `cfg_*` | Stable at accepted start; captured for the whole job; `P,Q` supplied by software |
| `sram_we_ext[c]`, `sram_waddr_ext[c]`, `sram_wdata_ext[c]` | Per-row input preload writes; `INPUT_ADDR_WIDTH` address, `BIT_WIDTH` word |
| `kernel_we_ext[k]`, `kernel_waddr_ext[k]`, `kernel_wdata_ext[k]` | Per-column kernel preload writes; `KERNEL_ADDR_WIDTH` address, `BIT_WIDTH` word |
| `cfg_continue_sum` | Captured with start; 0 initializes first-tap outputs, 1 continues resident sums |
| `output_read_enable`, `output_read_addr` | While idle, request one common output address across banks |
| `output_read_data[k]` | Stored bank word after the request rising edge; shares the accumulation read port |
| `acc_col_out[k]` | `ACC_WIDTH` live pipeline result; not an indexed final-output read port |

Each preload lane has its own enable, address, and data; multiple arrays may be
written on one edge. Core-level writes are enabled only with `nrst && !busy`.
The core has no host command decoder or configuration register bus. The
accelerator above owns backing-memory transfers. Direct core callers tie
`cfg_continue_sum=0` for independent jobs and disable output reads during compute;
core output-read requests while busy are ignored.
The raw configuration and preload signals are currently driven by the testbench.

## Running the core

1. Assert `nrst=0` across a rising clock edge, then release reset.
2. While `busy=0`, preload inputs using `sram_we_ext`, `sram_waddr_ext`,
   and `sram_wdata_ext`.
3. Preload kernels using `kernel_we_ext`, `kernel_waddr_ext`, and
   `kernel_wdata_ext`.
4. Drive all `cfg_*` ports, including the derived `P,Q`, and pulse `start`
   for one clock cycle.
5. Wait for the one-cycle `done` pulse. Final values are in output SRAM;
   the testbench exports them through hierarchical memory views.

External buses have `ARRAY_SIZE` lanes. Input writes use the first `C` lanes;
kernel writes and logical outputs use the first `K` lanes. External write
lanes are usable while idle before the configuration is captured.

The controller has these states:

| State | Action | Next state |
|---|---|---|
| IDLE | Accept start, set `(r,s)=(0,0)`, choose weight buffer zero | PRIME on start |
| PRIME | Synchronously fetch the first physical load row | LOAD_WEIGHTS |
| LOAD_WEIGHTS | Shift the first tap through all physical rows | RUN when the loader reaches row zero |
| RUN | Stream positions, reduce channels, write/accumulate outputs; prepare next-tap weights in parallel | SWITCH_TAP if another tap remains, otherwise IDLE with `done` |
| SWITCH_TAP | One cleared cycle after the tap/buffer change; reset stream and writeback state and prefetch position zero | RUN |

`clear_pass` is asserted outside RUN and during reset. It clears stream and
partial-sum pipeline state, not SRAM contents or loaded weights. The loader's
weight shifts remain possible while the sum pipeline is cleared. At the end of
a nonfinal RUN, the controller advances the tap, toggles the active buffer, and
restarts the loader for preparing the following tap. It relies on the fixed
pass length to finish background loading before that switch; there is no
additional next-buffer-ready stall.

The controller visits `s` within `r`. Before the first tap, one PRIME cycle
fetches a synchronous kernel read, then `ARRAY_SIZE` cycles shift its weights
in descending row order into PE buffer zero. Each tap runs for
`N*P*Q+2*ARRAY_SIZE` cycles. During RUN, one read-prefetch cycle followed by
`ARRAY_SIZE` weight shifts fills the inactive PE registers with the next tap,
while activations and partial sums continue advancing with the active weights.
The remaining RUN cycles drain the current tap's physical pipeline.

After a tap finishes, the controller selects the prepared weight buffer and
spends one SWITCH_TAP cycle clearing the pipeline and prefetching the new tap's
first activation. The final tap has no next-tap preload or switch cycle.
With `T=R*S`, completion occurs this many edges after the accepted start edge:

```text
cycles = 1 + ARRAY_SIZE + T*(N*P*Q + 2*ARRAY_SIZE) + (T-1)
```

For the supplied ten-by-ten example (`N=1`, `T=9`, `P*Q=16`), this is 343 cycles.
At completion, the physical array drain has ended, all logical outputs are
committed, `busy` drops, and `done` pulses.

Starts and external input/kernel writes are ignored while busy. Holding
`start` high launches another run when idle. Synchronous active-low reset
aborts a run and clears control state while retaining memory contents. Each
run overwrites outputs on its first tap unless `cfg_continue_sum=1`. Jobs can use different configurations
without a reset or a new hardware build. `acc_col_out` exposes live pipeline
results; final results reside in output SRAM. The core testbench observes SRAM
through hierarchy; the accelerator transfers results through the output-read ports.

The testbench creates memory views through these instance paths (`b` is a
physical row/column index):

```text
input:  UUT.u_datapath.g_input[b].u_feeder.u_sram.mem[address]
output: UUT.u_datapath.g_output[b].u_accumulator.u_sram.mem[address]
kernel: UUT.g_kernel[b].u_bank.mem[address]
```

Those paths are simulation access to implementation details, not external RTL
ports. Structural refactors that change them must update the testbench views.

## Fixtures and simulation

The project has a core bench, `sim/tb_conv_core.v`, and a layer bench,
`sim/tb_conv_accelerator.v`, selected by `run.sh --tiled`. They share
`sim/tensor_reader.vh` for fixture validation.
The Python runner supplies the same `N,C,H,W,K,R,S`, padding, stride, and
dilation arguments to the generator and testbench. Precision remains fixed in
`gen_matrices.py` and the testbench. The fixture scripts need Python 3; simulation
needs Bash, `iverilog`, and `vvp`. The `.v` sources use SystemVerilog constructs,
so `run.sh` compiles with `-g2012`; `-Wall` enables compiler warnings. Set physical `ARRAY_SIZE` independently,
with `ARRAY_SIZE >= max(C,K)`. The test rejects invalid geometry, capacity
overflow, missing/short/extra tensor data, malformed or unknown hex words, and
shape headers that disagree with the configuration. Input files use whitespace-
separated hex words and `//` comments, as emitted by the generator.

```bash
python3 run_case.py --seed 0 --out-dir /tmp/im2col_example
```

`run_case.py` generates tensors, then runs the simulation. It shares its argument
names and defaults with `gen_matrices.py`; every geometry value is passed to
both programs. For example:

```bash
python3 run_case.py --N 2 --C 2 --H 5 --W 6 --K 3 --R 2 --S 3 \
  --pad_i 1 --pad_j 2 --stride_i 2 --stride_j 1 --dilation_i 2 --dilation_j 1
```

Both Python scripts accept `--N`, `--C`, `--H`, `--W`, `--K`, `--R`, `--S`,
`--pad_i`, `--pad_j`, `--stride_i`, `--stride_j`, `--dilation_i`, `--dilation_j`,
`--seed`, and `--out-dir`. Their defaults are declared at the top of
`gen_matrices.py`. The runner puts tensors, simulated outputs, and the SRAM
report in `--out-dir` (default `sim`). Use `--wave-file path` for a waveform.
Run either script with `--help` to list arguments.

The default `--out-dir sim` overwrites the active fixture/report files. Select a
separate directory for experiments and review work. `run.sh` always writes its
compiled binary to `sim/tb_conv_core.vvp` and recompiles on every invocation;
use a temporary copy of the project when active files must stay untouched.

The generator can also be used independently:

```bash
python3 gen_matrices.py --N 2 --seed 0
bash run.sh +N=2
```

The generator uses `conv_golden.py` and writes `sim/input_tensor.txt`,
`sim/kernel_tensor.txt`, and the Python reference `sim/output_tensor.txt`.
Files use NCHW/KCRS/NKPQ order and two's-complement hexadecimal values.

The testbench reads the input and kernel files, preloads interleaved input words
and kernel SRAM, drives configuration, and pulses `start`. The core controls
weight loading, tap sequencing, double buffering, and accumulation until `done`.
The testbench checks every output against its own signed convolution reference
and checks that used input words were preserved. It does not load the Python
output file as its reference. The sweep additionally compares the exported
output tensor against `output_tensor.txt`, so both reference paths are checked.
Unknown expected or actual outputs and failed report/output file opens are fatal.
A cycle watchdog terminates a job that does not complete within its fixed-latency
bound. Python golden self-test failures also return a nonzero process exit status.
The saved fixtures match the generator/testbench defaults with seed 0.
`conv_golden.py` uses Python integer sums; `gen_matrices.py` masks results to
`ACC_WIDTH` before writing the reference hexadecimal words. Without saturation,
reordering additions across channel reduction and tap accumulation preserves
the same final result modulo `2**ACC_WIDTH`.

| Source | Role |
|---|---|
| [conv_golden.py](conv_golden.py) | Course loop-nest reference, including dilation and its own Python tests |
| [gen_matrices.py](gen_matrices.py) | Shared geometry arguments, seeded signed fixtures, hardware-width reference export |
| [run_case.py](run_case.py) | Pass the same geometry to generation and testbench, then run both |
| [run.sh](run.sh) | Compile the selected core/layer bench and `rtl/*.v`, then execute `vvp` |
| [sim/tb_conv_accelerator.v](sim/tb_conv_accelerator.v) | Hardware-tiled layer test and backing-memory model |
| [sim/tensor_reader.vh](sim/tensor_reader.vh) | Shared strict tensor-file reader for the two test levels |
| [sim/tb_conv_core.v](sim/tb_conv_core.v) | Preload, start, wait, report metrics, check/export output and SRAM contents |
| [test_cases.py](test_cases.py) | Directed/random configurations, per-case timeout, golden/cycle checks and JSON summary |

The testbench does not manually shift individual taps into the PEs. It preloads
the complete input and kernel tensors; hardware performs every tap after start.

| Result | Destination |
|---|---|
| Start-to-done clock cycles | Terminal; excludes reset and external preloading |
| Useful PE count and percentage | Terminal; `C*K` out of `ARRAY_SIZE*ARRAY_SIZE` |
| Output tensor in NKPQ order | `sim/output_tensor_core.txt` |
| Every address in input, output, and kernel SRAM arrays | `sim/sram_layout.txt` |
| Output comparison result | Terminal |

The SRAM report includes hexadecimal values, signed decimal values, tensor
coordinates, unused locations, and inactive arrays. Uninitialized words appear
as `x`. It shows the actual SRAM contents after completion.

Shapes and geometry can be overridden with `+N=`, `+C=`, `+K=`, `+H=`, `+W=`,
`+R=`, `+S=`, `+pad_i=`, `+pad_j=`, `+stride_i=`, `+stride_j=`,
`+dilation_i=`, and `+dilation_j=`. The testbench computes `P,Q` automatically.
Its defaults are declared at the top of the testbench. For example, with
matching tensor files:

```bash
bash run.sh +N=2
```

File paths can be overridden with `+INPUT_FILE=path`, `+KERNEL_FILE=path`,
`+OUTPUT_FILE=path`, and `+SRAM_LAYOUT_FILE=path`. A waveform is generated when
`+WAVE_FILE=path` is supplied. To reuse a compiled simulation, pass these same
arguments to `vvp sim/tb_conv_core.vvp`.

## Case sweep

`test_cases.py` runs directed boundary cases and 100 seeded random configurations
through `run_case.py`. It reads the physical array size and SRAM capacities from
the testbench and generates configurations that fit. Cases cover batches, unequal
channel counts, padding, stride, dilation, rectangular kernels, and memory limits.

```bash
python3 test_cases.py
python3 test_cases.py --cases 500 --seed 42
python3 test_cases.py --cases 0 --limit 4
```

Each case compares the simulated tensor to the generated Python golden tensor,
checks its length and cycle count, and requires an SRAM report. Results go to
`sim/case_sweep`: each case retains configuration, tensors, SRAM contents and
`run.log`. `summary.json` lists failures and checked outputs. The script continues
after failures and exits unsuccessfully if any case fails. A case times out after
120 seconds; override with `--timeout`. Use `--out-dir` to select a results folder
or `--random-only` to skip directed cases. Cases run sequentially; each invokes
the existing compilation and simulation runner.

The sweep prints each case's channel utilization from the testbench and saves
it in `summary.json` alongside cycle counts and useful/total PE counts. This is
`100*C*K/ARRAY_SIZE**2`, the fraction of PEs assigned useful channels. It
measures channel occupancy, not activity over time; loading, pipeline fill/drain,
and padded input positions do not reduce this percentage.

## Validation evidence

The recorded functional baseline is checkpoint 32: 116 directed/random cases
passed, checking 24,547 outputs, exact cycle counts and input preservation.
Output tensors and SRAM reports matched the prior implementation. Checkpoint 30
also records unequal input/output depths of 512/128 and 128/512 words. These
are recorded results, not a claim that a new regression was run for this README.
See the archive's `SNAPSHOT.json` records for validation performed at each change.

For a new functional change, validate the affected behavior using the existing
runner and sweep. Match precision, memory capacity and runtime geometry when
comparing results. A timeout means the process exceeded the runner's limit;
inspect the log to distinguish simulator/build cost from a numerical failure.

## Synthesis configuration

`librelane/config.json` currently targets **`conv_datapath`**, with a configured
clock period of 20 ns. Its source list includes the PE array, address generator,
feeders, accumulators and their SRAM models. It excludes the top-level controller,
configuration capture, weight loader and kernel SRAM. This is a datapath-only
configuration; its results would not measure the complete accelerator.
`librelane/runner.sh` copies the latest run's matching netlist and SDF artifacts.

The SRAMs are behavioral memories, not instantiated Sky130 SRAM macros. The
mapped storage implementation depends on the synthesis flow. RTL simulation
and a configured clock period do not establish physical frequency, area, or
power. No complete-core physical result is asserted here.

## Limitations and next work

`conv_core` still requires each local job to fit its array and SRAM. The
`conv_accelerator` scheduler handles larger full layers through the row/channel/
tap tiling above. It currently has a fixed-latency word interface and serialized
transfers; its backing memory is a testbench model. Hardware address arithmetic
includes division and multiplication and has not been optimized or physically
validated. Idle rows and columns still participate in the physical pipeline.

Physical external-memory control, AXI/bursts/backpressure, transfer/compute
overlap, improved data reuse, host register buses, layer chaining, bias,
requantization, activation and pooling remain future work. No area, power,
setup/hold closure or achievable frequency is claimed for the accelerator.

## Credits

https://github.com/kaggar11/systolic_4x4arr 
    
- Code was initially based on this. It's pretty much a Ship of Theseus thing now at this point since the only recognizable parts are the PE and the PE array buses but still worth acknowledging.

"Characterizing and Demystifying the Implicit Convolution Algorithm on Commercial Matrix-Multiplication Accelerators" by
Zhou et al.
- https://doi.org/10.48550/arXiv.2110.03901 
- Channel-first implicit im2col algorithm and TPU architecture taken from here.

# Note on AI-use

Codex and GPT-6.1 Sol was used to assist in the creation of this project.
