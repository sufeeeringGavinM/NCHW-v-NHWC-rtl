# Independent simulator snapshots

- 00_inherited_seed: inherited website, tensors, checks, provenance and exact hardware verification reference.
- 01_validated_tiling: first validated two-tab tiling simulator. See its validation/REPORT.md.

Each MANIFEST.json records immutable hashes/origin/validation. Do not overwrite either snapshot. Hardware and parent simulator histories are separate and untouched by this work.

- 02_before_tensor_tile_selection: exact before state and reference tensors.
- 03_tensor_tile_selection: validated full-input/full-kernel stacked tile masks.

- 04_before_output_and_stage_views: exact before source, tensors and validation.
- 05_output_and_stage_views: independent tensor fronts, output stacks/partial sums and Next stage.
