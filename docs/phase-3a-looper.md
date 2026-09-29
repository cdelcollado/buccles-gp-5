# Phase 3a — Looper MVP (2 tracks)

**Status**: planned (not started)

## Goal

A working 2-track looper in the browser, recording the processed guitar audio from the
GP-5 (USB audio interface) and controlled by the **Chocolate Plus** foot controller, which
is now **dedicated to the looper**.

This document supersedes the "1 track" scoping in `docs/plan.md` (Phase 3, iteration 3a):
the MVP ships **2 tracks** from the start. Iterations 3b (metronome/count-in) and 3c
(2 → 4 tracks) remain as follow-ups.

## Decisions (reconfirmed)

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
  `autoGainControl: false` (already done in `audio-manager.ts` during Phase 0).
- A `MediaStreamAudioSourceNode` feeds the looper; the looper mix is routed to
  `AudioContext.destination`.
- `Tone.start()` must run on the first user gesture (autoplay policy).

## Track model

Each track is an independent record/playback lane that shares the same loop length and clock.

- **State machine**: `empty` → `recording` → `playing` → `overdubbing` → `playing` (→ `empty` on clear).
- **Master loop length** is set by the **first** recording; every subsequent record/overdub on
  either track is quantized to that length (whole number of bars).
- Both tracks stay synchronized to the same `Tone.Transport` clock; the master length is the
  reference for both.
- Per-track operations: `record`, `play/stop`, `overdub`, `undo`, `clear`, plus `stop all`.

## Quantize & timing

- `Tone.Transport` provides the master BPM and bar/beat position.
- `record`, `stop`, and `overdub` edges **snap to the next bar boundary** (no drift).
- Loop length is always a whole number of bars (e.g. 4 bars at the current BPM).
- BPM is user-configurable in the UI and persisted.

## MIDI control (Chocolate Plus, MIDI Learn)

The app listens to the Chocolate Plus input and maps any incoming message to a looper action.

- **MIDI Learn**: the user selects an action, presses "Learn", then presses a pedal button.
  The app stores the captured message (status + data bytes) as the trigger for that action.
- **Default mapping** (4 buttons), so it works without any configuration:

  | Button | Action |
  |---|---|
  | 1 | Record / Overdub (focused track) |
  | 2 | Play / Stop (all) |
  | 3 | Undo (focused track) |
  | 4 | Switch focused track (A ↔ B) |

- "Focused track" is the lane that `record`, `overdub`, `undo` and `clear` act on; it is shown
  in the UI and switchable from the pedal (button 4) or the screen.

## File structure (new)

```
src/looper/
├── looper-engine.ts      # LooperEngine: owns tracks, mix, audio routing, stop all
├── looper-track.ts       # LooperTrack: record/play/stop/overdub/undo/clear
├── looper-clock.ts       # Tone.Transport init, BPM, quantize scheduling
├── looper-mapping.ts     # MIDI Learn: action <-> captured MIDI message
└── looper-ui.ts          # Transport buttons, BPM, track indicators, focus

src/audio/
└── audio-manager.ts      # (extended) central AudioContext + input routing for the looper
```

## Tasks

| # | Task | File(s) | Detail |
|---|------|---------|--------|
| 3a.1 | Audio routing | `src/audio/audio-manager.ts` | Expose the central `AudioContext` and a `MediaStreamAudioSourceNode` from the GP-5 input; route into the looper. |
| 3a.2 | Clock / Tone.js init | `src/looper/looper-clock.ts` | `Tone.Transport` init, BPM get/set, bar/beat math, `Tone.start()` on first gesture. |
| 3a.3 | Track engine | `src/looper/looper-track.ts` | `LooperTrack` with the state machine and per-track ops; stores audio in memory. |
| 3a.4 | Looper engine | `src/looper/looper-engine.ts` | Owns 2 tracks, master length, mix to destination, `stopAll`. |
| 3a.5 | Quantize | `src/looper/looper-clock.ts` | Snap record/stop/overdub edges to the next bar; enforce whole-bar loop length. |
| 3a.6 | Looper UI | `src/looper/looper-ui.ts` | Track state indicators, transport buttons, BPM input, focus highlight. |
| 3a.7 | MIDI control | `src/looper/looper-mapping.ts` | MIDI Learn + default mapping; route Chocolate Plus messages to looper actions. |

## Acceptance criteria

1. Recording the GP-5 input via a pedal button (or UI) creates a loop; a second press closes
   the loop at a bar boundary and starts playback.
2. Two tracks can be recorded independently and play back synchronized.
3. `overdub`, `undo` and `clear` work per focused track; `stop all` stops both.
4. The 4 Chocolate Plus buttons trigger the default mapping without any configuration.
5. MIDI Learn can rebind any action to any pedal message.
6. BPM is editable and persisted (`localStorage`).

## Risks

- **Input latency**: Web Audio has non-negligible input latency. `latencyHint: "interactive"`
  plus disabled processing is already applied; must be validated with real hardware.
- **Autoplay policy**: `AudioContext`/`Tone` start requires a user gesture; handle the
  `suspended` state and offer a "click to enable audio" path.
- **Quantize feel**: snapping to bar boundaries changes the loop start; validate that the
  master length and BPM feel right (may need a count-in → deferred to 3b).
- **Pedal message variety**: the Chocolate Plus can send CC, Note or PC. MIDI Learn must store
  the full message (status + data), not just a CC number.

## Out of scope (deferred)

- Metronome and count-in → **Phase 3b**.
- 2 → 4 tracks, waveform display, per-track volume/mute/solo → **Phase 3c**.
- Hybrid scene (GP-5 + looper) and the full router → **Phase 2** (deferred).

## Next step

Implement tasks 3a.1 → 3a.7, then validate against the acceptance criteria with the GP-5 and
the Chocolate Plus connected over USB.
