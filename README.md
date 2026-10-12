# buccles-gp-5

Web app to control a **Valeton GP-5** over USB and use the **Chocolate Plus (M-VAVE)** foot
controller as a MIDI controller for a built-in **looper** (Quantiloop/Korg style). The GP-5 is
also used as a USB audio interface, so the looper records the processed guitar signal.

Runs entirely in the browser with the Web MIDI API, the Web Audio API and Tone.js.

## Requirements

- **Chrome or Edge** on desktop. Safari and iOS do not support Web MIDI.
- The GP-5 and the Chocolate Plus connected over **USB**.
- Served over **HTTPS** or `localhost`, which the Web MIDI API requires.

## Setup

```bash
npm install
npm run dev      # dev server at http://localhost:5173/
npm run build    # type-check (tsc) and production build into dist/
```

## Features

- **GP-5 control**: 100-preset grid, 10 effect modules on/off, patch and bank navigation, tuner,
  patch volume. Settings persist in `localStorage`.
- **Looper** (2 tracks, 4 planned): bar-quantized record, overdub, undo, clear, and play/stop all. The
  Chocolate Plus controls it through MIDI Learn, with a default 4-button mapping.
- **Languages**: Catalan (default), Spanish and English.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Bootstrap, MIDI device detection, audio probe | Done |
| 1 | GP-5 controller MVP (CC over USB) | Implemented, pending hardware validation |
| 3a | Looper MVP (2 tracks) | Implemented, pending hardware validation |
| 3b | Metronome, count-in, tap tempo, live groove | Planned ([details](docs/phase-3b-groove.md)) |
| 3c | 4-track looper inspired by Quantiloop | Next after 3a validation |
| 4 | Polish: error handling, themes, PWA, full export/import | Planned |
| 1b | Patch parameter editor (SysEx) | Deferred: pending decision on undocumented SysEx |
| 2 | Chocolate Plus → GP-5 router and scenes | Deferred: the pedal is dedicated to the looper |

**Current scope**: daily GP-5 control over USB with documented CCs, and a 4-track looper. Editing
patch parameters is not in scope for now. Valeton's official app covers it.

## Documentation

- [docs/plan.md](docs/plan.md): full implementation plan (phases, files, conventions, risks).
- [docs/phase-0.md](docs/phase-0.md): Phase 0 progress.
- [docs/phase-1.md](docs/phase-1.md): Phase 1 progress (GP-5 controller MVP).
- [docs/phase-3a-looper.md](docs/phase-3a-looper.md): Phase 3a looper (design, tests, pending validation).
- [docs/phase-3b-groove.md](docs/phase-3b-groove.md): Phase 3b metronome, count-in and live groove (planned).
- [GP-5 manual (Firmware V1.0.3, PDF)](docs/1748936007255.GP-5_Online%C2%A0Manual_EN_Firmware%20V1.0.3.pdf): the MIDI CC table is on p. 40.
- [docs/quantiloop2.pdf](docs/quantiloop2.pdf): Quantiloop user guide, reference for the 4-track looper.
