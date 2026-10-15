# Use zero-delay synthesized-netlist activity on the unchanged routed core.
set root [file dirname [file normalize [info script]]]
set variant [lindex $argv 0]
set reports [file join $root reports core]
set build $root
open_checkpoint [file join $reports routed.dcp]
create_clock -name clk -period 200.000 [get_ports clk]
foreach name {power.rpt saif_annotation.rpt} {
    set previous [file join $reports $name]
    set preserved [file join $reports [file rootname $name]_rtl[file extension $name]]
    if {[file exists $previous] && ![file exists $preserved]} {file copy $previous $preserved}
}
read_saif -strip_path tb_conv_core/GATE -out_file [file join $reports saif_annotation.rpt] [file join $build activity_netlist.saif]
set_operating_conditions -process typical -ambient_temp 25
report_power -file [file join $reports power.rpt]
write_checkpoint -force [file join $reports routed.dcp]
puts "NETLIST_POWER_SUCCESS: $variant"
exit 0
