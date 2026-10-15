`timescale 1ns/1ps
module addr_benchmark #(parameter ARRAY_SIZE=10, CFG_WIDTH=9, ADDR_WIDTH=8,
    BANK_WIDTH=(ARRAY_SIZE>1?$clog2(ARRAY_SIZE):1)) (
    input clk,
    input [CFG_WIDTH-1:0] N,C,H,W,R,S,Q,pad_i,pad_j,stride_i,stride_j,dilation_i,dilation_j,position,group_base,
    output reg [ARRAY_SIZE-1:0] valid,
    output reg [ARRAY_SIZE-1:0][BANK_WIDTH-1:0] bank,
    output reg [ARRAY_SIZE-1:0][ADDR_WIDTH-1:0] addr
);
  reg [CFG_WIDTH-1:0] q_N,q_C,q_H,q_W,q_R,q_S,q_Q,q_pad_i,q_pad_j,q_stride_i,q_stride_j,q_dilation_i,q_dilation_j,q_position,q_group_base;
  wire [ARRAY_SIZE-1:0] next_valid;
  wire [ARRAY_SIZE-1:0][BANK_WIDTH-1:0] next_bank;
  wire [ARRAY_SIZE-1:0][ADDR_WIDTH-1:0] next_addr;
  im2col_addr_gen #(.ARRAY_SIZE(ARRAY_SIZE),.CFG_WIDTH(CFG_WIDTH),.ADDR_WIDTH(ADDR_WIDTH)) u_agen (
    .N(q_N),.C(q_C),.H(q_H),.W(q_W),.R(q_R),.S(q_S),.Q(q_Q),.pad_i(q_pad_i),.pad_j(q_pad_j),.stride_i(q_stride_i),.stride_j(q_stride_j),.dilation_i(q_dilation_i),.dilation_j(q_dilation_j),.position(q_position),.group_base(q_group_base),.valid(next_valid),.bank(next_bank),.addr(next_addr));
  always @(posedge clk) begin
    q_N<=N; q_C<=C; q_H<=H; q_W<=W; q_R<=R; q_S<=S; q_Q<=Q; q_pad_i<=pad_i; q_pad_j<=pad_j; q_stride_i<=stride_i; q_stride_j<=stride_j; q_dilation_i<=dilation_i; q_dilation_j<=dilation_j; q_position<=position; q_group_base<=group_base; 
    valid<=next_valid; bank<=next_bank; addr<=next_addr;
  end
endmodule
