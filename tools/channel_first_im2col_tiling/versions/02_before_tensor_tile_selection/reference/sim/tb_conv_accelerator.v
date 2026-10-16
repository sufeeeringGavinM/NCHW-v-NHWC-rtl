// System test: only the hardware chooses tiles and moves data to/from local SRAM.
`timescale 1ns/1ps
module tb_conv_accelerator;
  // Configuration, tensor geometry and external-memory interface.
  parameter ARRAY_SIZE = 4;
  parameter BIT_WIDTH = 8;
  parameter ACC_WIDTH = 32;
  parameter INPUT_ADDR_WIDTH = 8;
  parameter OUTPUT_ADDR_WIDTH = 8;
  parameter KERNEL_ADDR_WIDTH = 8;
  parameter MEM_ADDR_WIDTH = 16;
  localparam MEM_DEPTH = 1 << MEM_ADDR_WIDTH;
  localparam MEM_DATA_WIDTH = ACC_WIDTH > BIT_WIDTH ? ACC_WIDTH : BIT_WIDTH;
  integer N = 1, C = 4, H = 6, W = 6, K = 2, R = 3, S = 3, P, Q;
  integer pad_i = 0, pad_j = 0, stride_i = 1, stride_j = 1, dilation_i = 1, dilation_j = 1;
  integer input_base, kernel_base, output_base, input_words, kernel_words, output_words;
  reg clk = 0, nrst = 0, start = 0, perturb = 0;
  always #5 clk = ~clk;
  wire busy, done, mem_re, mem_we;
  wire [MEM_ADDR_WIDTH - 1:0] mem_raddr, mem_waddr;
  wire [MEM_DATA_WIDTH - 1:0] mem_wdata;
  reg [MEM_DATA_WIDTH - 1:0] mem_rdata;

  // The backing memory model is deliberately in the testbench, not RTL.
  // One enabled synchronous read and one edge-triggered write, like local SRAM.
  reg [MEM_DATA_WIDTH - 1:0] memory[0:MEM_DEPTH - 1];
  reg signed [BIT_WIDTH - 1:0] input_tensor[0:MEM_DEPTH - 1];
  reg signed [BIT_WIDTH - 1:0] kernel_tensor[0:MEM_DEPTH - 1];
  reg signed [ACC_WIDTH - 1:0] expected[0:MEM_DEPTH - 1];
  integer written[0:MEM_DEPTH - 1];
  string input_file, kernel_file, output_file, layout_file, wave_file;
  integer a, n, c, k, p, q, r, s, h, w, fd, run, runs = 2, reset_test = 0;
  reg signed [ACC_WIDTH - 1:0] total;
  reg [63:0] clock_cycles = 0, start_cycle = 0;
  integer reads = 0, writes = 0, jobs = 0, completed_jobs = 0, tiles = 0, core_cycles = 0;
  reg pending_read = 0;
  reg [MEM_ADDR_WIDTH - 1:0] pending_addr;

  // DUT wiring. Invalid values selected by perturb test configuration capture;
  // the reference geometry above stays unchanged throughout the run.
  conv_accelerator #(
    .ARRAY_SIZE(ARRAY_SIZE),
    .BIT_WIDTH(BIT_WIDTH),
    .ACC_WIDTH(ACC_WIDTH),
    .INPUT_ADDR_WIDTH(INPUT_ADDR_WIDTH),
    .OUTPUT_ADDR_WIDTH(OUTPUT_ADDR_WIDTH),
    .KERNEL_ADDR_WIDTH(KERNEL_ADDR_WIDTH),
    .MEM_ADDR_WIDTH(MEM_ADDR_WIDTH)
  ) DUT (
    .clk(clk),
    .nrst(nrst),
    .start(start),
    .busy(busy),
    .done(done),
    .cfg_N(perturb ? 32'd123 : N),
    .cfg_C(perturb ? 32'd123 : C),
    .cfg_H(perturb ? 32'd123 : H),
    .cfg_W(perturb ? 32'd123 : W),
    .cfg_K(perturb ? 32'd123 : K),
    .cfg_R(perturb ? 32'd123 : R),
    .cfg_S(perturb ? 32'd123 : S),
    .cfg_P(perturb ? 32'd123 : P),
    .cfg_Q(perturb ? 32'd123 : Q),
    .cfg_pad_i(perturb ? 32'd123 : pad_i),
    .cfg_pad_j(perturb ? 32'd123 : pad_j),
    .cfg_stride_i(perturb ? 32'd123 : stride_i),
    .cfg_stride_j(perturb ? 32'd123 : stride_j),
    .cfg_dilation_i(perturb ? 32'd123 : dilation_i),
    .cfg_dilation_j(perturb ? 32'd123 : dilation_j),
    .cfg_input_base(perturb ? {MEM_ADDR_WIDTH{1'b1}} : MEM_ADDR_WIDTH'(input_base)),
    .cfg_kernel_base(perturb ? {MEM_ADDR_WIDTH{1'b1}} : MEM_ADDR_WIDTH'(kernel_base)),
    .cfg_output_base(perturb ? {MEM_ADDR_WIDTH{1'b1}} : MEM_ADDR_WIDTH'(output_base)),
    .mem_re(mem_re),
    .mem_we(mem_we),
    .mem_raddr(mem_raddr),
    .mem_rdata(mem_rdata),
    .mem_waddr(mem_waddr),
    .mem_wdata(mem_wdata)
  );
  // Observation only: hardware output transfer uses the actual readback ports.
  wire [ACC_WIDTH - 1:0] output_dump[0:ARRAY_SIZE - 1][0:(1 << OUTPUT_ADDR_WIDTH) - 1];
  genvar bank, address;
  generate
    for (bank = 0; bank < ARRAY_SIZE; bank = bank + 1) begin : g_dump
      for (address = 0; address < (1 << OUTPUT_ADDR_WIDTH); address = address + 1) begin : g_word
        assign output_dump[bank][address] = DUT.u_core.u_datapath.g_output[bank].u_accumulator.u_sram.mem[address];
      end
    end
  endgenerate
  `include "tensor_reader.vh"

  // Clocked memory model and protocol checks. Keep read data nonblocking:
  // a request at this edge can be consumed by the DUT only at the next edge.
  always @(posedge clk) begin
    clock_cycles <= clock_cycles + 1;
    if (!nrst && (mem_re || mem_we)) $fatal(1, "Backing memory request during reset");
    if (!nrst) pending_read <= 0;
    else begin
      if (start && !busy) begin
        start_cycle <= clock_cycles + 1;
        reads = 0;
        writes = 0;
        jobs = 0;
        completed_jobs = 0;
        tiles = 0;
        core_cycles = 0;
      end
      pending_read <= mem_re;

      // Read input/kernel words from backing memory.
      if (mem_re) begin
        if ($isunknown(mem_raddr) || mem_raddr >= MEM_DEPTH ||
            !((mem_raddr >= input_base && mem_raddr < input_base + input_words) ||
              (mem_raddr >= kernel_base && mem_raddr < kernel_base + kernel_words)))
          $fatal(1, "DMA read outside input/kernel tensors: %0d", mem_raddr);
        if ($isunknown(memory[mem_raddr])) $fatal(1, "DMA read uninitialized backing word");
        mem_rdata <= memory[mem_raddr];
        pending_addr <= mem_raddr;
        reads = reads + 1;
      end

      // Commit real DUT output stores and check exactly-once coverage.
      if (mem_we) begin
        if ($isunknown(mem_waddr) || $isunknown(mem_wdata) || mem_waddr < output_base || mem_waddr >= output_base + output_words)
          $fatal(1, "Invalid DMA output write");
        if (written[mem_waddr - output_base] != 0) $fatal(1, "Duplicate output write");
        if (DUT.c0 + DUT.tile_c != C || (DUT.tap_mode && (DUT.tap_r != R - 1 || DUT.tap_s != S - 1)))
          $fatal(1, "Output stored before reduction completed");
        memory[mem_waddr] <= mem_wdata;
        written[mem_waddr - output_base] = written[mem_waddr - output_base] + 1;
        writes = writes + 1;
      end

      // Check transfer alignment and local-job capacity before counting jobs.
      if (mem_re && mem_we) $fatal(1, "Serialized DMA overlapped a read and write");
      if (|DUT.input_we || |DUT.kernel_we)
        if (!pending_read || mem_rdata !== memory[pending_addr])
          $fatal(1, "DMA consumed a read on the wrong edge");
      if (DUT.state == DUT.START_CORE) begin
        if (DUT.core_busy || DUT.tile_c < 1 || DUT.tile_c > ARRAY_SIZE || DUT.tile_k < 1 || DUT.tile_k > ARRAY_SIZE ||
            DUT.patch_h * DUT.patch_w > (1 << INPUT_ADDR_WIDTH) || DUT.tile_q > (1 << OUTPUT_ADDR_WIDTH) ||
            DUT.tile_c * DUT.local_R * DUT.local_S > (1 << KERNEL_ADDR_WIDTH))
          $fatal(1, "Invalid local compute tile");
        jobs = jobs + 1;
      end
      if (DUT.core_busy) core_cycles = core_cycles + 1;
      if (DUT.core_done) completed_jobs = completed_jobs + 1;
      if (DUT.state == DUT.NEXT_TILE) tiles = tiles + 1;
    end
  end

  // Independently recompute the full reduction completed so far, after every
  // local job. This checks retained partial sums before they reach backing RAM.
  task check_partial;
    integer lk, lq, ch, rr, ss, hh, ww;
    reg signed [ACC_WIDTH - 1:0] want;
    begin
      for (lk = 0; lk < DUT.tile_k; lk = lk + 1)
        for (lq = 0; lq < DUT.tile_q; lq = lq + 1) begin
          want = 0;
          for (ch = 0; ch < DUT.c0 + DUT.tile_c; ch = ch + 1)
            for (rr = 0; rr < R; rr = rr + 1)
              for (ss = 0; ss < S; ss = ss + 1)
                if (ch < DUT.c0 || !DUT.tap_mode || rr * S + ss <= DUT.tap_r * S + DUT.tap_s) begin
                  hh = DUT.p0 * stride_i + rr * dilation_i - pad_i;
                  ww = (DUT.q0 + lq) * stride_j + ss * dilation_j - pad_j;
                  if (hh >= 0 && hh < H && ww >= 0 && ww < W)
                    want = want + input_tensor[((DUT.n0 * C + ch) * H + hh) * W + ww] *
                      kernel_tensor[(((DUT.k0 + lk) * C + ch) * R + rr) * S + ss];
                end
          if ($isunknown(want) || output_dump[lk][lq] !== want)
            $fatal(1, "Partial sum mismatch n=%0d k=%0d p=%0d q=%0d c0=%0d tap=(%0d,%0d) want=%h got=%h",
              DUT.n0, DUT.k0 + lk, DUT.p0, DUT.q0 + lq, DUT.c0, DUT.tap_r, DUT.tap_s, want, output_dump[lk][lq]);
        end
    end
  endtask

  // Check after the core's rising-edge writebacks have committed.
  always @(negedge clk)
    if (nrst && DUT.core_done) check_partial;


  // Full-layer reference: tensor coordinates and signed arithmetic, independent
  // of the hardware tile schedule.
  task build_reference;
    begin
      for (n = 0; n < N; n = n + 1)
        for (k = 0; k < K; k = k + 1)
          for (p = 0; p < P; p = p + 1)
            for (q = 0; q < Q; q = q + 1) begin
              total = 0;
              for (c = 0; c < C; c = c + 1)
                for (r = 0; r < R; r = r + 1)
                  for (s = 0; s < S; s = s + 1) begin
                    h = p * stride_i + r * dilation_i - pad_i;
                    w = q * stride_j + s * dilation_j - pad_j;
                    if (h >= 0 && h < H && w >= 0 && w < W)
                      total = total + input_tensor[((n * C + c) * H + h) * W + w] * kernel_tensor[((k * C + c) * R + r) * S + s];
                  end
              expected[((n * K + k) * P + p) * Q + q] = total;
            end
    end
  endtask

  // Verify backing outputs and preserved operands, then export actual results.
  task check_outputs;
    begin
      fd = $fopen(output_file, "w");
      if (!fd) $fatal(1, "Cannot open output tensor");
      $fdisplay(fd, "// shape=(%0d,%0d,%0d,%0d), last coordinate varies fastest, hex", N, K, P, Q);
      for (a = 0; a < output_words; a = a + 1) begin
        if (written[a] != 1 || $isunknown(expected[a]) || memory[output_base + a] !== MEM_DATA_WIDTH'($unsigned(expected[a])))
          $fatal(1, "Full-layer output %0d mismatch: want=%h got=%h writes=%0d", a, expected[a], memory[output_base + a], written[a]);
        $fdisplay(fd, "%h", memory[output_base + a][ACC_WIDTH - 1:0]);
      end
      $fclose(fd);
      for (a = 0; a < input_words; a = a + 1)
        if (memory[input_base + a] !== MEM_DATA_WIDTH'($unsigned(input_tensor[a]))) $fatal(1, "Input backing tensor changed");
      for (a = 0; a < kernel_words; a = a + 1)
        if (memory[kernel_base + a] !== MEM_DATA_WIDTH'($unsigned(kernel_tensor[a]))) $fatal(1, "Kernel backing tensor changed");

      // Account for real job/transfer activity, then report actual SRAM words.
      if (jobs != completed_jobs || writes != output_words || jobs < 1) $fatal(1, "Job/transfer accounting mismatch");
      if (clock_cycles - start_cycle != 1 + 2 * tiles + 3 * jobs + core_cycles + 2 * (reads + writes))
        $fatal(1, "Layer cycle accounting mismatch: measured=%0d accounted=%0d", clock_cycles - start_cycle, 1 + 2 * tiles + 3 * jobs + core_cycles + 2 * (reads + writes));
      fd = $fopen(layout_file, "w");
      if (!fd) $fatal(1, "Cannot open SRAM report");
      $fdisplay(fd, "Full layer in testbench backing memory: input_base=%0d kernel_base=%0d output_base=%0d", input_base, kernel_base, output_base);
      $fdisplay(fd, "Actual final local output SRAM: active banks=%0d width=%0d", DUT.tile_k, DUT.tile_q);
      for (k = 0; k < DUT.tile_k; k = k + 1)
        for (a = 0; a < DUT.tile_q; a = a + 1)
          $fdisplay(fd, "bank=%0d addr=%0d value=%h", k, a, output_dump[k][a]);
      $fclose(fd);
      $display("[METRIC] Layer cycles (start accepted to final store done): %0d", clock_cycles - start_cycle);
      $display("[METRIC] Tile jobs: %0d; output tiles: %0d; backing reads: %0d; writes: %0d; core busy cycles: %0d", jobs, tiles, reads, writes, core_cycles);
      $display("PASS: %0d full-layer outputs matched, including every intermediate partial sum; run %0d", output_words, run + 1);
    end
  endtask


  // Stimulus sequence: parse files -> build reference -> initialise backing
  // memory -> reset -> optional abort -> repeated full-layer runs.
  initial begin
    input_file = "sim/input_tensor.txt";
    kernel_file = "sim/kernel_tensor.txt";
    output_file = "sim/output_tensor_accelerator.txt";
    layout_file = "sim/sram_layout.txt";
    wave_file = "";
    if ($value$plusargs("INPUT_FILE=%s", input_file)) begin end
    if ($value$plusargs("KERNEL_FILE=%s", kernel_file)) begin end
    if ($value$plusargs("OUTPUT_FILE=%s", output_file)) begin end
    if ($value$plusargs("SRAM_LAYOUT_FILE=%s", layout_file)) begin end
    if ($value$plusargs("WAVE_FILE=%s", wave_file)) begin end
    if ($value$plusargs("N=%d", N)) begin end
    if ($value$plusargs("C=%d", C)) begin end
    if ($value$plusargs("H=%d", H)) begin end
    if ($value$plusargs("W=%d", W)) begin end
    if ($value$plusargs("K=%d", K)) begin end
    if ($value$plusargs("R=%d", R)) begin end
    if ($value$plusargs("S=%d", S)) begin end
    if ($value$plusargs("pad_i=%d", pad_i)) begin end
    if ($value$plusargs("pad_j=%d", pad_j)) begin end
    if ($value$plusargs("stride_i=%d", stride_i)) begin end
    if ($value$plusargs("stride_j=%d", stride_j)) begin end
    if ($value$plusargs("dilation_i=%d", dilation_i)) begin end
    if ($value$plusargs("dilation_j=%d", dilation_j)) begin end
    if ($value$plusargs("RUNS=%d", runs)) begin end
    if ($value$plusargs("RESET_TEST=%d", reset_test)) begin end
    if (N < 1 || C < 1 || K < 1 || H < 1 || W < 1 || R < 1 || S < 1 ||
        stride_i < 1 || stride_j < 1 || dilation_i < 1 || dilation_j < 1 ||
        pad_i < 0 || pad_j < 0 || runs < 1)
      $fatal(1, "Invalid layer configuration");
    if (longint'(dilation_i) * (R - 1) + 1 > longint'(H) + 2 * pad_i ||
        longint'(dilation_j) * (S - 1) + 1 > longint'(W) + 2 * pad_j)
      $fatal(1, "Kernel does not fit padded input");
    P = (longint'(H) + 2 * pad_i - longint'(dilation_i) * (R - 1) - 1) / stride_i + 1;
    Q = (longint'(W) + 2 * pad_j - longint'(dilation_j) * (S - 1) - 1) / stride_j + 1;
    if (P < 1 || Q < 1 || longint'(N) * C * H * W + longint'(K) * C * R * S + longint'(N) * K * P * Q + 32 > MEM_DEPTH)
      $fatal(1, "Layer exceeds testbench backing memory");

    // Eight-word gaps keep bad tensor offsets from silently reaching neighbours.
    input_words = N * C * H * W;
    kernel_words = K * C * R * S;
    output_words = N * K * P * Q;
    input_base = 8;
    kernel_base = input_base + input_words + 8;
    output_base = kernel_base + kernel_words + 8;
    read_tensor(input_file, 0, N, C, H, W);
    read_tensor(kernel_file, 1, K, C, R, S);
    build_reference;
    for (a = 0; a < input_words; a = a + 1)
      memory[input_base + a] = MEM_DATA_WIDTH'($unsigned(input_tensor[a]));
    for (a = 0; a < kernel_words; a = a + 1)
      memory[kernel_base + a] = MEM_DATA_WIDTH'($unsigned(kernel_tensor[a]));
    if (wave_file != "") begin
      $dumpfile(wave_file);
      $dumpvars(0, tb_conv_accelerator);
    end
    repeat (2) @(negedge clk);
    nrst = 1;

    // Optional reset-recovery check: interrupt compute before the normal runs.
    if (reset_test) begin
      @(negedge clk);
      start = 1;
      @(negedge clk);
      start = 0;
      wait (DUT.u_core.running);
      repeat (2) @(negedge clk);
      nrst = 0;
      @(posedge clk);
      #1;
      if (busy || done) $fatal(1, "Reset did not abort the layer");
      @(negedge clk);
      nrst = 1;
    end

    // Run again without reset to expose stale sums or scheduler state.
    for (run = 0; run < runs; run = run + 1) begin
      for (a = 0; a < output_words; a = a + 1)
        written[a] = 0;
      @(negedge clk);
      start = 1;
      @(negedge clk);
      start = 0;
      perturb = 1;
      // A busy start must not replace the captured layer configuration.
      @(negedge clk);
      start = 1;
      @(negedge clk);
      start = 0;

      // Inspect after the rising edge has committed nonblocking memory writes.
      wait (done);
      #1;
      if (busy) $fatal(1, "busy remained asserted with done");
      check_outputs;
      perturb = 0;
      repeat (3) begin
        @(posedge clk);
        #1;
        if (done || busy) $fatal(1, "Unexpected done width or extra accepted start");
      end
    end
    $finish;
  end

  // Independent watchdog: a stalled DUT must fail instead of waiting forever.
  initial begin
    // A finite bound independent of the DUT state machine; scale conservatively
    // by the untiled multiply count plus backing tensor size and output traffic.
    wait (nrst);
    repeat (longint'(runs) * (1000 + 100 * longint'(N) * K * P * Q * C * R * S + 20 * longint'(N) * C * H * W)) @(posedge clk);
    $fatal(1, "Accelerator watchdog: layer did not finish");
  end
endmodule
