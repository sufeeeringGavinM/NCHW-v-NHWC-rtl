# Stacked tensors and operand motion — 2026-10-15

Staged browser checks passed before applying source changes.

- All four PDF tap masks: the 4x4, 2x2-kernel, stride-2 example, both channels.
- Per-channel kernel tap highlights; front selection and spread view.
- Actual row-skew input locations; padding zero has no image-cell highlight.
- Activation movement to the right and weight shifting downward, with numeric
  values and coordinate identities checked against the model's committed state.
- Weight identities retain old forwarding-register origins between tap loads.
- Batch interleaving; tap boundary clears; back/seek; motion toggle; reduced motion.
- Desktop screenshot at 1440px and mobile screenshot at 390px inspected.
- Original browser interaction suite passed all five original presets and controls,
  including the default 343-clock example, editing, reference values and JSON export.

Engine SHA-256: deece502b317db4ea0e22ce8f0e359d677af5daf2db71d50d626a543a1e3dfda.
This is unchanged from the previously validated model. Reused its accepted 96
seeded JS cases and 24 recorded RTL cases (4,555 output values and cycles).
No RTL/functional/synthesis flows rerun. No new physical-timing claim.
