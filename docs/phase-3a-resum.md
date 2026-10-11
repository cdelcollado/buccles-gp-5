# Summary — Phase 3a (Looper MVP, 2 tracks)

Done ✅. **Phase 3a (Looper MVP, 2 tracks)** is implemented, compiles cleanly and is pushed to `main` (commit `531b3e6`).

## What was built

**Module `src/looper/`** (5 new files):

- `looper-clock.ts` — BPM + bar grid via `Tone.Transport`; schedules callbacks at the next bar boundary with the exact audio time.
- `looper-track.ts` — one track: audio (mono), layers, undo stack and loop playback.
- `looper-mapping.ts` — MIDI Learn + default mapping of the pedal's 4 buttons.
- `looper-engine.ts` — orchestrates the 2 tracks, the `ScriptProcessorNode` capture, the master length/phase and the actions.
- `looper-ui.ts` — transport, BPM, track cards and MIDI Learn.

**Modified**: `audio-manager.ts` (shares the input stream), `persistence.ts` (BPM + bindings), `index.html` (Looper section), `main.ts` (MIDI routing + persistence), `style.css`.

## How the timing model works

- The **first loop sets the master length** (a whole number of bars) and the phase.
- All starts/stops **are quantised to the bar boundary** (no drift), with sample-accurate capture by the `ScriptProcessorNode`.
- `record` on the first loop = tap to start / tap to close. Afterwards (empty track or overdub) = **one automatic pass** aligned to the master.
- The **BPM is locked** once something is recorded (clear the tracks to change it).

## Default Chocolate Plus mapping (HYPOTHESIS)

| Button | Action | Assumed message |
|---|---|---|
| 1 | Rec / Overdub | PC#0 ch1 |
| 2 | Play / Stop all | PC#1 ch1 |
| 3 | Undo | PC#2 ch1 |
| 4 | Switch track A↔B | PC#3 ch1 |

`clear` has no default button (only 4 buttons): it is done with **MIDI Learn** or from the UI. If the pedal sends CC/Note instead of PC, use the "learn" buttons in the Looper section.

## How to test it

```bash
cd ~/Projects/buccles-gp-5 && npm run dev
```

1. Open **http://localhost:5173/** in Chrome/Edge.
2. In "Audio test", select the GP‑5 as input.
3. In "Looper", press **"Activate the looper"** (a user gesture that opens the input and starts Tone).
4. Press button 1 on the pedal (or "Rec/Overdub" on Track A) → records; press again to close the loop.
5. Track B, overdub, undo, clear and "Play/Stop all" from the UI or the pedal.

## ⚠️ Pending validation with your hardware

1. **Real latency** from the GP‑5 input to the browser (criterion for deciding whether look-ahead scheduling is needed).
2. **Real Chocolate Plus messages** (PC vs CC) → reconfigure the mapping with MIDI Learn if needed.
3. **Quantise feel** (that the loop closes exactly on the bar).

## Next steps

- **Phase 3b**: metronome + count-in, tap tempo, time-stretching (`GrainPlayer`).
- **Phase 3c**: 4 tracks, waveform, volume/mute/solo per track.
- **Hybrid (Phase 2)**: add the "GP‑5" scene to the same pedal (scene architecture already planned).

Shall we continue with **Phase 3b (metronome + count-in)**, or first test 3a with the pedal and tell me what fails?
