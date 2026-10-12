# Phase 3a — Looper MVP (2 tracks)

**Status**: implemented and compiling; pending hardware validation with the GP-5 and the Chocolate Plus.

## Goal

A working 2-track looper in the browser, recording the processed guitar audio from the
GP-5 (USB audio interface) and controlled by the **Chocolate Plus** foot controller, which
is now **dedicated to the looper**.

This document supersedes the "1 track" scoping in `docs/plan.md` (Phase 3, iteration 3a):
the MVP ships **2 tracks** from the start. Iterations 3b (metronome/count-in) and 3c
(2 → 4 tracks) remain as follow-ups.

## Decisions

| Decision | Answer |
|---|---|
| Tracks | **2 tracks** for the MVP (A and B). |
| Chocolate Plus role | **Dedicated to the looper** (not a GP-5 router). GP-5 is driven from the on-screen UI. |
| Chocolate Plus config | **MIDI Learn** — the app learns any message from the pedal; no Cube Suite needed. |
| Audio source | **GP-5 USB** via `getUserMedia`. |
| Audio library | **Tone.js** (`Tone.Transport`, scheduling, quantize). |
| UI | **Vanilla TypeScript** (no framework). |

## Audio flow

```
[Guitar] → [GP-5 USB audio] → getUserMedia → AudioContext ─┐
                                                           ├─→ LooperEngine ─→ destination (speakers)
[Chocolate Plus] → Web MIDI (CC/Note/PC) ─→ MIDI Learn ────┘
```

- `AudioContext` with `latencyHint: "interactive"`.
- Input `MediaStream` requested with `echoCancellation: false`, `noiseSuppression: false`,
  `autoGainControl: false` (set in `audio-manager.ts`).
- A `MediaStreamAudioSourceNode` feeds the looper; the looper mix is routed to
  `AudioContext.destination`.
- `Tone.start()` runs on the first user gesture (autoplay policy).

## What was built

- `src/looper/looper-clock.ts` — BPM + bar grid via `Tone.Transport`; schedules callbacks at the
  next bar boundary with the exact audio time.
- `src/looper/looper-track.ts` — per-track audio (mono), layers, undo stack, looping playback.
- `src/looper/looper-mapping.ts` — MIDI Learn + default PC mappings for the 4 pedal buttons.
- `src/looper/looper-engine.ts` — owns the 2 tracks, the capture `ScriptProcessorNode`, master
  loop length and phase; dispatches looper actions.
- `src/looper/looper-ui.ts` — transport, BPM, track cards and MIDI Learn UI.
- `src/audio/audio-manager.ts` — `getStream()` shares the GP-5 input with the looper.
- `src/storage/persistence.ts` — persists BPM and bindings to `localStorage`.

## Track model

Each track is an independent record/playback lane that shares the same loop length and clock.

- **State machine**: `empty` → `recording` → `playing` → `overdubbing` → `playing` (→ `empty` on clear).
- **Master loop length** is set by the **first** recording; every subsequent record/overdub on
  either track is quantized to that length (whole number of bars).
- Both tracks stay synchronized to the same `Tone.Transport` clock.
- Per-track operations: `record`, `play/stop`, `overdub`, `undo`, `clear`, plus `stop all`.
- **Focused track**: the lane that `record`, `overdub`, `undo` and `clear` act on. Shown in the UI
  and switchable from the pedal (button 4) or the screen.
- The **BPM is locked** once something is recorded (clear the tracks to change it).

## Quantize & timing

- The first loop sets the master length (a whole number of bars) and the phase.
- `record`, `stop`, and `overdub` edges **snap to the next bar boundary** (no drift), with
  sample-accurate capture by the `ScriptProcessorNode` (mono downmix; stereo deferred to 3c).
- On the first loop, `record` is tap-to-start / tap-to-close. Afterwards (empty track or overdub),
  `record` runs **one automatic pass** aligned to the master.

## MIDI control (Chocolate Plus, MIDI Learn)

- **MIDI Learn**: the user selects an action, presses "Learn", then presses a pedal button.
  The app stores the captured message (status + data bytes), not just a CC number, so PC, CC
  and Note triggers all work.
- **Default mapping** (4 buttons), so it works without configuration. **These are hypotheses**
  (Program Change, ch1, data1 0–3):

  | Button | Action | Assumed message |
  |---|---|---|
  | 1 | Record / Overdub (focused track) | PC#0 ch1 |
  | 2 | Play / Stop all | PC#1 ch1 |
  | 3 | Undo (focused track) | PC#2 ch1 |
  | 4 | Switch focused track (A ↔ B) | PC#3 ch1 |

- `clear` has no default button (only 4 buttons): assign it via MIDI Learn or use the UI.

## How to test

```bash
cd ~/Projects/buccles-gp-5 && npm run dev
```

1. Open **http://localhost:5173/** in Chrome or Edge.
2. In "Audio test", select the GP-5 as input.
3. In "Looper", press **"Activate the looper"** (a user gesture that opens the input and starts Tone).
4. Press button 1 on the pedal (or "Rec/Overdub" on Track A) to record; press again to close the loop.
5. Test Track B, overdub, undo, clear and "Play/Stop all" from the UI or the pedal.

## Acceptance criteria

1. Recording the GP-5 input via a pedal button (or UI) creates a loop; a second press closes
   the loop at a bar boundary and starts playback.
2. Two tracks can be recorded independently and play back synchronized.
3. `overdub`, `undo` and `clear` work per focused track; `stop all` stops both.
4. The 4 Chocolate Plus buttons trigger the default mapping without any configuration.
5. MIDI Learn can rebind any action to any pedal message.
6. BPM is editable and persisted (`localStorage`).

## Pending validation with hardware

1. **Real Chocolate Plus messages** (PC vs CC vs Note). If they differ from the defaults, rebind
   with MIDI Learn.
2. **Input latency** from the GP-5 to the browser. This decides whether look-ahead scheduling is needed.
3. **Quantize feel**: the loop closes exactly on the bar and the master length feels right.
   This may call for a count-in (deferred to 3b).

## Risks

- **Input latency**: Web Audio has non-negligible input latency. `latencyHint: "interactive"`
  and disabled processing are applied; validate with real hardware.
- **Autoplay policy**: `AudioContext`/`Tone` start requires a user gesture; the `suspended` state
  needs a "click to enable audio" path.
- **Pedal message variety**: the Chocolate Plus can send CC, Note or PC.
- **ScriptProcessorNode** is deprecated; migrating to an AudioWorklet is planned (see `docs/plan.md`).

## Out of scope (deferred)

- Metronome, count-in, tap tempo → **Phase 3b**.
- 2 → 4 tracks, waveform display, per-track volume/mute/solo → **Phase 3c**.
- Hybrid scene (GP-5 + looper) and the full router → **Phase 2**.

## Next steps

- Validate the points above with the hardware, then reconfigure the mapping if needed.
- **Phase 3b**: metronome, count-in, tap tempo.
- **Phase 3c**: 4 tracks, waveform, volume/mute/solo per track.
- **Phase 2 (hybrid)**: add a "GP-5" scene to the same pedal (the scene architecture is already planned).
