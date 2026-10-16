#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
top=tb_conv_core
if [[ "${1-}" == --tiled ]]; then
    top=tb_conv_accelerator
    shift
fi
iverilog -g2012 -Wall -I sim -s "$top" -o "sim/$top.vvp" "sim/$top.v" rtl/*.v
vvp "sim/$top.vvp" "$@"
