# Phase 0 — Bootstrap and feasibility prototype

**Status**: ✅ Completed

## Goal

Have the project compiling and served, and verify that the Web MIDI and Web Audio APIs work with the hardware (GP-5 and Chocolate Plus).

## What was done

### Dependencies
- `tone@^15.1.22` added to `dependencies`.

### Structure created
```
src/
├── index.html              # Base UI: connection, devices, MIDI monitor, audio test
├── main.ts                 # Entry point: initialises MIDI + audio + UI
├── style.css               # Dark theme, panels, status indicators, monitor log
├── midi/
│   ├── midi.types.ts       # Types for the Web MIDI API (not in the standard TS library)
│   ├── midi-manager.ts     # requestMIDIAccess, device list, GP-5/Chocolate detection, statechange
│   └── midi-monitor.ts     # Parse and display MIDI messages (Note/CC/PC/SysEx)
├── audio/
│   └── audio-manager.ts    # GP-5 getUserMedia, loopback monitoring, latency measurement
└── ui/
    └── components.ts       # UI helpers + status indicators
```

### Implemented features
- Automatic detection of the **Chocolate Plus** (input) and the **GP-5** (output) by substring, with status indicators and a manual fallback.
- Real-time **MIDI monitor** to verify that the Chocolate Plus sends messages.
- **Audio test**: GP-5 input selection, loopback monitoring and base latency measurement.
- `statechange` handling (hot connect/disconnect).
- `npm run build` (tsc + vite) passes without errors.

### Vite configuration
`root: 'src'` because `index.html` lives in `src/`, with `build.outDir` redirected to `dist/` (project root).

## How to verify with the hardware (task 0.9)

1. Open **http://localhost:5173/** in Chrome/Edge.
2. Connect the **GP-5** via USB → indicator "Valeton GP-5: ✅".
3. Connect the **Chocolate Plus** via USB → indicator "Chocolate Plus: ✅".
4. Press buttons on the Chocolate Plus → messages appear in the **MIDI Monitor**.
5. In **Audio test**, select the GP-5 as input and press "Monitor input" → hear the guitar through the speakers with the displayed latency.

## Notes and detected risks

- Device detection is by **substring** match on the MIDI port name. The real names must be validated (Windows/Linux/macOS) and the patterns adjusted if needed.
- The looper **latency** must be validated with the real hardware. `latencyHint: "interactive"` and audio processing disabled (`echoCancellation`/`noiseSuppression`/`autoGainControl` = false) are applied.
- No **SysEx** is sent (risk of bricking the GP-5). Only CCs documented in Phase 1 are used.

## Next step

**Phase 1 — GP-5 controller MVP**: presets, effect blocks and tuner. It requires the **GP-5 manual's CC table** (page ~40) to fill `gp5-mapping.ts`.
