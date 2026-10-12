# Phase 1 — GP-5 controller MVP

**Status**: ✅ Implemented (pending validation with the hardware)

## Goal

Control the GP-5 from the UI: presets, effect modules, tuner and volume, all over USB with CCs.

## What was done

### New files
```
src/gp5/
├── gp5-mapping.ts       # GP-5 CC table (source: voes.be) + value constants
├── gp5-controller.ts    # GP5Controller: sends CCs, keeps local state, emits changes
└── gp5-ui.ts            # GP5UI: 10×10 grid, chain of 10 modules, tuner, volume
src/storage/
└── persistence.ts       # loadGP5State / saveGP5State in localStorage
```

### Implemented features
- **Preset grid 00–99** (CC#0, value 0–99). Active preset highlighted.
- **Chain of 10 modules** (NR, PRE, DST, N→S, AMP, CAB, EQ, MOD, DLY, RVB) with on/off toggle (CC#48–57).
- **Navigation** patch± / bank± (CC#22–25).
- **Tuner** (CC#58) and **patch volume** (CC#7, 0–100).
- **Persistence** of preset, modules and tuner in `localStorage`, restored at start without re-sending CCs.
- Controls are disabled when the GP-5 is not detected (reactive to `statechange`).

### On/off semantics
- `0 = off`, `127 = on` for modules and tuner (`MODULE_OFF_VALUE` / `MODULE_ON_VALUE`). The manual
  (p. 40) defines 0–63 = off and 64–127 = on, so these values are valid. Still to verify on hardware.
- "Trigger" controls (patch±/bank±/ctl) send `127` (`TRIGGER_VALUE`).

## How to validate with the hardware (pending)

1. Open **http://localhost:5173/** in Chrome/Edge and connect the GP-5 via USB.
2. Click a preset in the grid → the GP-5 must change patch.
3. Click a module (e.g. AMP) → it must turn the effect on/off. **Confirm that `127` = on and `0` = off** (or whether it toggles with any value).
4. Tuner → must enter/leave tuner mode.
5. Volume (CC#7) → must change the patch volume.

## Notes and risks

- The GP-5 CCs are **one-way**: the app's local state is an assumption, not a read from the device. If the GP-5 changes state by other means, the UI can get out of sync.
- **Patch±** navigation does not update the active preset in the grid (we do not know the result). Only the grid keeps the highlighted preset reliably.
- If the on/off semantics are not `0/127`, adjust them in `gp5-mapping.ts` (single constants).

## Next step

**Phase 2 — MIDI router**: Chocolate Plus → GP-5 with **MIDI Learn**, configurable mapping and scenes.
