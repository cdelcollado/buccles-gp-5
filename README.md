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
- **Looper** (2 tracks): bar-quantized record, overdub, undo, clear, and play/stop all. The
  Chocolate Plus controls it through MIDI Learn, with a default 4-button mapping.
- **Languages**: Catalan (default), Spanish and English.

## Status

| Phase | Scope | Status |
|---|---|---|
| 0 | Bootstrap, MIDI device detection, audio probe | Done |
| 1 | GP-5 controller MVP | Implemented, pending hardware validation |
| 3a | Looper MVP (2 tracks) | Implemented, pending hardware validation |
| 3b | Metronome, count-in, tap tempo | Planned |
| 3c | 4 tracks, waveform, per-track volume/mute/solo | Planned |
| 2 | Chocolate Plus → GP-5 router and scenes | Deferred |
| 4 | Polish: error handling, themes, PWA, full export/import | Planned |

## Documentation

- [docs/plan.md](docs/plan.md): full implementation plan (phases, files, conventions, risks).
- [docs/phase-0.md](docs/phase-0.md): Phase 0 progress.
- [docs/phase-1.md](docs/phase-1.md): Phase 1 progress (GP-5 controller MVP).
- [docs/phase-3a-looper.md](docs/phase-3a-looper.md): Phase 3a looper (design, tests, pending validation).
