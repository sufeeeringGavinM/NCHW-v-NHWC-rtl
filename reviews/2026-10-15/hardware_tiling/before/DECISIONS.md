# Architectural decisions

This log records the choices behind `channel_first_im2col_implementation` so a new agent can
understand the design without replaying its conversation history. It was
assembled on 2026-10-14 from the user's instructions, the active sources and
the development archive. That is the documentation date, not the date of every
original decision. Older milestones were reconstructed; later checkpoints
preserve exact source states. Their provenance records explain the distinction.

Read [README.md](README.md) for the current implementation and
[workspace AGENTS.md](../AGENTS.md) for the work/approval rules. Source files
establish implemented behavior. The reasons below explain intent; they do not
authorize implementing deferred features.

Entries marked **Accepted and implemented** describe the active design.
Entries under deferred work describe discussions or needs that remain open.
When a choice changes, record its replacement and mark the previous choice
superseded rather than silently deleting its rationale.

## D01 — Keep the design simple and give state a clear owner

**Accepted and implemented.** The user's guiding preference is “Simplicity is
God.” Modules should correspond to a responsibility that can be explained and
reviewed, rather than creating hierarchy for its own sake.

`conv_core` captures configuration and wires the components. `conv_controller`
owns tap sequencing, pass timing and active-buffer selection. `weight_loader`
owns kernel read/shift timing. `conv_datapath` owns stream position and wiring;
feeders and accumulators own their local timing and storage. The former channel
wrapper was removed when it no longer owned useful behavior.

Consequences: changes should go to the module that owns the affected state.
Do not move tap scheduling into the address generator, duplicate batch decoding
in the datapath, or add a pass-through memory wrapper without a specific need.
Checkpoints 22, 24 and 30 record the structural milestones.

## D02 — Use the class's dimension conventions everywhere

**Accepted and implemented.** Logical input shape is `(N,C,H,W)`, kernel shape
is `(K,C,R,S)`, and output shape is `(N,K,P,Q)`. Coordinates are their lowercase
counterparts. Geometry uses separate height/width axes:
`pad_i/pad_j`, `stride_i/stride_j`, and `dilation_i/dilation_j`.

Padding is symmetric per axis; dilation changes tap spacing. The operation is
cross-correlation without reversing the kernel, bias or post-processing.
These conventions align the RTL address equations with the course golden model.
Do not reintroduce ambiguous size names or a single scalar stride/padding value.
The first three reconstructed milestones already contain these conventions.

## D03 — Specify logical shape separately from physical storage

**Accepted and implemented.** Tensor text files retain NCHW/KCRS/NKPQ order.
SRAM is distributed across channels: the input array is selected by `c`, and
the kernel/output array by `k`. Within-array input/output addresses interleave
images. Shapes alone therefore do not describe storage order.

Use the README's explicit offset/address table when discussing layout.
Previous conversational NCHW/NHWC labels are insufficient as specifications.
“Channel-first implicit im2col” describes the referenced algorithm/data mapping;
it does not replace the actual storage equations. There is no materialized
im2col matrix in SRAM.

The distinction matters for preload/export code and future host/DMA transfers:
a tensor file cannot simply be copied word-for-word into one hardware memory.
Checkpoint 10 records image interleaving; checkpoint 28 records separate input
and output address spaces.

## D04 — Let hardware perform complete convolution jobs

**Accepted and implemented.** The testbench preloads complete input and kernel
tensors, supplies configuration and pulses `start`. Hardware loads each tap,
streams all output positions and accumulates results until `done`.

The original manual-tap testbench was useful while building the address
generator and accumulation. It is not the current top-level execution model.
The first reconstructed milestone retains testbench-driven taps; milestone 2
adds hardware-controlled loading through `conv_core`.

The distinction to preserve is external tensor preload versus internal PE
weight loading. The testbench still does the former; `weight_loader` does the
latter. A future host or DMA may replace the preload driver without taking over
the current tap sequence.

## D05 — Make geometry runtime configuration, capacities hardware parameters

**Accepted and implemented.** `N,C,H,W,K,R,S,P,Q`, padding, stride and dilation
are runtime values captured at accepted start. Physical array size, precision,
SRAM depths and configuration widths are fixed hardware parameters.

Software computes `P,Q`; the core accepts sane, internally consistent geometry.
Changing input ports after start does not alter the captured job. Multiple
jobs can reuse a build, memory and control interface without resetting between
jobs; used output addresses are overwritten on the first tap of each job.

This separates layer geometry from resource sizing. It does not supply a host
register bus or imply that arbitrary sizes fit. Runtime geometry appears in
milestone 3; runtime batches were added later in checkpoint 10.

## D06 — Allow independent logical channels inside a square array

**Accepted and implemented.** `C` and `K` need not be equal. A square
`ARRAY_SIZE × ARRAY_SIZE` physical array can use only its first `C` rows and
first `K` columns. Both counts must fit the hardware size.

Input storage follows rows; kernel/output storage follows columns. A case with
`K>C` is valid as long as both fit. Inactive input rows inject zero contributions;
inactive output columns have SRAM writeback disabled. The physical bottom row
still supplies results, and the full physical pipeline still drains.

The chosen implementation avoids a separate rectangular-array change while
supporting unequal channel counts. Idle PEs are not dynamically removed or
clock-gated. Rectangular arrays and using spare rows for concurrent filter taps
remain separate possible extensions, not implemented features.

## D07 — Use signed operands and retain full accumulator-width outputs

**Accepted and implemented.** Activations and weights are signed two's-complement
`BIT_WIDTH` values. PE sums and output SRAM use `ACC_WIDTH`, with wraparound,
not saturation. Input SRAM now stores operand-width words directly.

The tensor generator calls the course's `conv_golden.conv2d`, including dilation,
then masks the final Python integer result to hardware width for hexadecimal
export. Channel and tap reduction can be regrouped because modular addition
and multiplication give the same final wrapped value. Python widths, RTL
parameters and testbench widths must remain coordinated.

Early output truncation was a correctness problem, not a reason to accept
operand-width final sums. Signed arithmetic is recorded in checkpoint 5;
separate operand/accumulator-width memories are recorded in checkpoint 28.
Bias, requantization, saturation and activation require additional decisions.

## D08 — Double-buffer weights inside each PE

**Accepted and implemented.** Double buffering means **two stationary weight
registers per PE**. One supplies computation for the current tap while the other
receives the next tap's weights. Kernel SRAM remains a single independent array
per physical output column.

A whole-kernel SRAM ping-pong interpretation was superseded after the user
clarified the requirement. Do not duplicate kernel SRAM when asked to maintain
or explain the present double buffering. Checkpoint 8 records the accepted
per-PE design; archived superseded sources are not the current specification.

Next-tap loading is synchronous-read prefetch followed by descending physical-row
shifts during RUN. The controller toggles the active buffer only after the
current output pass has drained and committed. There is one clearing cycle
between taps; the last tap does not preload another tap. Loading and arithmetic
must remain independent inside the PE.

## D09 — Interleave images as separate words and decode them in the address generator

**Accepted and implemented.** For each output position `(p,q)`, stream all `N`
images before moving to the next position. All images in the job share kernels.
The stream position is `(p*Q+q)*N+n`, and an input address is `(h*W+w)*N+n`.

This reuses stationary tap weights across images without an outer loop that
restarts the entire convolution for each image. The initial batch discussion
deferred sequencing; later explicit approval added separate-word interleaving.
There is no packed/subword image format.

`im2col_addr_gen` owns decoding `n,p,q` and forming the complete input address,
including stride, padding and dilation. `conv_datapath` owns position advancement
and the next-position prefetch needed for synchronous SRAM. Checkpoints 10
and 26 record these two steps. Divider/remainder logic is still present.

## D10 — Separate input, output and kernel memories

**Accepted and implemented.** There are `ARRAY_SIZE` input SRAM arrays,
`ARRAY_SIZE` output/partial-sum SRAM arrays, and `ARRAY_SIZE` kernel SRAM arrays.
They are independent memories, totaling `3*ARRAY_SIZE` arrays. Input/output
addresses each start at zero; the old shared-SRAM output base is obsolete.

The split gives input words `BIT_WIDTH` storage and outputs `ACC_WIDTH` storage,
keeps inputs intact and allows independent input/output depths. Each activation
feeder owns its input SRAM; each output accumulator owns its output SRAM.
Checkpoints 28 and 30 record the split and ownership/depth refinements.

“Bank” in `kernel_bank` is a naming convention for one independent array,
not evidence of internal multi-banking. Memories remain behavioral RTL models,
not instantiated physical SRAM macros. Unused memory can retain old or unknown
words because reset and job start do not clear the arrays.

## D11 — Accumulate taps in output SRAM; defer accumulation across tiles

**Accepted and implemented for one job.** For each `(r,s)`, the systolic array
reduces channels. The first tap writes the result directly to output SRAM;
later taps add to the stored sum. The accumulator prefetches the previous
value to align the read-modify-write operation with the arriving result.

All logical output words for the current tap are written before changing the
tap or active weight buffer. Pipeline clear resets timing and sum registers,
not the saved output SRAM. A new job initializes its outputs through first-tap
writes rather than preserving a prior job's sums.

Explicit initialize/continue/finalize control across channel tiles is future
work. A tile scheduler must preserve and move partial sums as needed; the
current tap-derived `accumulate` signal does not provide that contract.

## D12 — Use one tensor-file testbench and shared software geometry

**Accepted and implemented.** `sim/tb_conv_core.v` is the one active testbench.
It loads generated inputs/kernels, preloads SRAM, runs the complete core,
prints metrics, checks results/input preservation and exports the output tensor
and actual post-run SRAM contents. Older MMU/manual-tap tests stay in archives.

`run_case.py` uses the same geometry argument definitions as `gen_matrices.py`
and passes them to the testbench as plusargs. This avoids mismatched generator
and simulation shapes. `test_cases.py` drives directed/random configurations
through that same flow; it is not a second RTL testbench.

The testbench has a signed reference loop; the sweep also compares the exported
output to Python golden words. Tensor loading validates complete known hex data
and any generated shape header before computing a reference or preloading SRAM.
Unknown results and file-open errors are fatal; a cycle watchdog bounds a stuck
job. The golden-model command propagates self-test failure to its exit status.
Saved fixtures match the default geometry with seed 0. Checkpoints 12, 14 and 16
record test consolidation, shared arguments and the sweep; checkpoint 38 records
the validation fixes following the 2026-10-15 correctness audit.

## D13 — Measure channel occupancy and start-to-done cycles explicitly

**Accepted and implemented.** Useful PEs are those assigned to the `C*K` active
channel pairs. Utilization is `100*C*K/ARRAY_SIZE**2`. It answers the user's
question about PEs useful for producing output channels.

It is not time-averaged utilization: preload, pipeline fill/drain, padding and
idle cycles do not reduce this percentage. It does not measure switching
activity or power. Start-to-done cycles include initial internal weight loading
and compute/drain, while excluding external tensor preload and reset.

Report these metrics together, with their definitions. The metrics baseline is
checkpoint 6; Python sweep reporting is recorded in checkpoint 20. Do not
reintroduce a comparison such as “cycles saved versus checkpoint 06” into
ordinary run output.

## D14 — Keep per-PE connections as separate word-sized nets

**Accepted and implemented.** Internal activation, weight and partial-sum links
are unpacked arrays of word-sized nets, with separately registered column outputs.
This retains the hardware connections while avoiding excessive simulator work
on large packed interconnect expressions.

Simulation runtime is not hardware execution time: compilation, memory views,
report writing and runner overhead also matter. `run.sh` recompiles on every
invocation. A timed-out sweep case requires log inspection before concluding
that convolution arithmetic failed. Checkpoint 18 records the interconnect
change and its regression results.

## D15 — Use names that describe the current computation

**Accepted and implemented.** The single-tap compute path is `conv_datapath`,
and each processing element is `PE`. Those names replace `MMU` and `MAC` in
active RTL filenames, modules, instances, documentation and synthesis paths.
Checkpoint 32 retained the then-current project directory name. D17 records
the subsequent project directory rename.

Checkpoint 32 records the rename, including testbench hierarchy and metric
parser references. Do not rename arithmetic concepts merely because a historical
module was called MAC, or change older checkpoints to match today's names.

## D16 — Store durable context in files and retain immutable checkpoints

**Accepted workflow.** The README explains what the current project is;
this log explains why; workspace `AGENTS.md` sets agent procedures. A future
conversation reads those files and verifies its understanding against RTL.
Conversation memory alone is insufficient to establish current architecture.

The user requires notice before edits and approval of a concrete, validated
batch before application. Functional RTL/generation/testbench changes receive
new before/after checkpoints with hashes and provenance. Existing checkpoints
remain unchanged. Documentation-only maintenance needs approval but does not
require new functional milestones.

Keep defaults and user attribution intact unless the requested task changes
them. The accepted readability goal is straightforward, human-readable names,
comments and ownership, not cosmetic churn or unnecessarily defensive tests.

## D17 — Name the project for its channel-first im2col implementation

**Accepted and implemented (2026-10-14).** The user explicitly requested the
project directory name `channel_first_im2col_implementation`, replacing
`im2col_add_gen_MMU`. Active documentation and workspace guidance use the new
location; module names remain `conv_core`, `conv_datapath`, and `PE`.

The directory name describes the implementation; it does not change tensor-file
order, SRAM layout, addressing, or arithmetic. Scripts resolve the project from
their own location and need no hardcoded path changes. Prior numbered checkpoints
retain their original names, captured sources and historical provenance paths.
`im2col_versions` remains the development archive. This is a location/documentation
change, not a new functional RTL milestone.

## Deferred work and open choices

These items were discussed or identified as requirements. They are not current
features and are not standing approval to implement them.

| Item | Need or open choice |
|---|---|
| Channel tiling | Support `C` beyond physical rows; preserve sums across contributions |
| Output-channel tiling | Support `K` beyond physical columns; select/store each output tile |
| Spatial/storage tiling | Fit each channel's input/output data within its SRAM, including required input halos |
| Kernel tiling | Fit kernel data within each kernel array and coordinate loading with execution |
| Partial-sum preservation | Define initialization, continuation and finalization plus storage/transfer behavior across tiles |
| Host configuration/commands | Replace direct testbench-driven config ports with a defined host protocol |
| Off-chip memory and DMA | Transfer tensors, kernels, sums and completed outputs; define layout conversion |
| External output readback | Replace hierarchical SRAM inspection with an actual hardware interface |
| Layer chaining | Decide how outputs become the next layer's inputs and how layouts/precision change |
| Bias/requantization/activation/pooling | Decide what belongs in the core versus the host and specify arithmetic |
| Rectangular array | Decide row/column counts separately if a demonstrated benefit justifies it |
| Concurrent filter taps | Use spare rows for more taps; requires a new mapping and storage/reduction plan |
| Packed images | Separate from current word interleaving; requires precision/packing decisions |
| Address arithmetic optimization | Replace divides/remainders/multiplies with counters/increments if warranted |
| Physical implementation | Select technology/target, SRAM implementation and constraints; measure actual area/timing/power |
| Actual CNN workloads | Select layers and tiling rules before claiming full-network support |

Output readback need not be a standalone CPU-readable SRAM port if a chosen
DMA path can deliver completed outputs to the host. The required behavior is
an implemented way to transfer final outputs; the interface remains undecided.

The present LibreLane configuration synthesizes `conv_datapath` only. A full
accelerator estimate needs an explicitly chosen scope including control,
kernel storage and any host/memory interfaces. Tool capability discussions and
RTL simulations are not physical area or power results.
