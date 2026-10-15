module store_fault; always @(negedge tb_conv_accelerator.clk) if(tb_conv_accelerator.mem_we) force tb_conv_accelerator.mem_wdata=0; else release tb_conv_accelerator.mem_wdata; endmodule
