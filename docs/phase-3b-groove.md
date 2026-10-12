# Phase 3b — Metronome, count-in and live groove

**Status**: planned (not started). Scope extended from `docs/plan.md` (3b) with a backing
drum groove taken from the reference app in `docs/VGP-MIDI-STEPPER.html`.

## Goal

Give the looper a steady tempo reference and an optional backing groove, so loops are
recorded and played on a clear grid. Everything is driven by the **same** `Tone.Transport`
clock as the looper, so the groove never drifts from the loop bars.

## Scope

| In | Out (for now) |
|---|---|
| Metronome click (on/off, accent on beat 1) | Audio export of the groove |
| Count-in before recording (optional, 1 bar) | MIDI output of groove notes (no drum module) |
| BPM input and tap tempo | Song-part driven GP-5 patch changes |
| Backing groove: 8 styles, one per groove slot | Sample-based drum kits (synthesised only) |
| Groove slots with name, style and BPM | Groove sets and setlists (see Phase 2.5 / 4.7) |
| Song parts: intro, verse, break, chorus | Expression pedal forwarding |

## Decisions

| Decision | Answer | Why |
|---|---|---|
| Clock | `Tone.Transport` (`looper-clock.ts`) | Same grid as the looper bars. The reference app uses its own `setInterval` clock, which would drift. |
| Groove sound | Tone.js synths (`MembraneSynth` for kick, `NoiseSynth` for snare/hi-hat) | Stays inside the Tone.js dependency already planned. |
| Pattern data | Reuse the 16-step tables from the reference app (`getPatternForPart`, lines 1310-1356), converted to typed data in `src/looper/groove-patterns.ts` | Patterns are musical content, not code. Code is rewritten. |
| Output routing | Click and groove go to the speakers only; never into the recorded input | The looper records the GP-5 USB input. Click or groove in the recording path would be printed into the loop. |
| Buffers | Shared noise buffer, no new `AudioBuffer` per hit | The reference app allocates a buffer for every hit. |
| Languages | All UI strings in `src/i18n/` (ca, es, en) | Project i18n policy. The reference app mixes German, Spanish and English. |
| Licence | Ideas and pattern data only. No copied code. | The reference app is © Uwe Müller (LVX AETERNA); its licence is unknown. Confirm before any literal reuse. |

## Groove styles

Each style is a 16-step pattern per bar for kick, snare and hi-hat, taken from the reference
app: `rock`, `metal` (double bass), `pop`, `punk`, `blues`, `shuffle`, `funk`, `ballad` (6/8 feel).

## Song parts

Four parts change the pattern of the running groove:

| Part | Effect (from the reference app) |
|---|---|
| Intro | Sparser: quarter-note hi-hat, reduced kick |
| Verse | Base pattern |
| Break | Kick on 1 and 3, fill in the second half of the bar, no hi-hat |
| Chorus | Eighth-note hi-hat, extra kick on beat 1 |

Parts are selected from the screen first. MIDI Learn for parts is a later step (see
`src/looper/looper-mapping.ts`).

## Tasks

| # | Task | Files | Detail |
|---|---|---|---|
| 3b.1 | Metronome | `src/looper/looper-metronome.ts` | `Tone.MembraneSynth` click on each beat, accent on beat 1. Toggle on/off. Persist the toggle. |
| 3b.2 | Count-in | `src/looper/looper-metronome.ts`, `looper-engine.ts` | One bar of click before the first recording starts. Optional toggle. |
| 3b.3 | BPM UI | `src/looper/looper-ui.ts` | Numeric input (already present) plus tap tempo: average of the last 4 taps, reset after 2 s of silence. |
| 3b.4 | Groove patterns | `src/looper/groove-patterns.ts` | Typed `GrooveStyle` and `SongPart` enums; `getPattern(style, part, step)`. Pure function, unit-testable. |
| 3b.5 | Groove engine | `src/looper/groove-engine.ts` | Schedules kick, snare and hi-hat on the Transport with `scheduleRepeat('16n')`. Restarts cleanly on BPM or style change. |
| 3b.6 | Groove slots | `src/looper/groove-engine.ts`, `looper-ui.ts` | Five slots, each with name, style and BPM. Start/stop per slot. Starting a slot sets the song part. |
| 3b.7 | Groove UI | `src/looper/looper-ui.ts` | Slot cards, part selector, start/stop, active-slot highlight. Same colour tokens as the rest of the app. |
| 3b.8 | Persistence | `src/storage/persistence.ts` | Slots, metronome and count-in toggles in `localStorage`. Versioned key. |
| 3b.9 | Tests | `src/looper/*.test.ts` (if a test runner is added) | Pattern lookup per style and part; tap tempo averaging; BPM clamp. |

## Acceptance criteria

1. The metronome clicks on every beat, with the accent on beat 1, in time with the looper bars.
2. With count-in enabled, pressing record plays one bar of click and then starts recording on the next bar.
3. Tap tempo sets the BPM within ±1 BPM after four taps at a steady pace.
4. A groove slot plays its style at its BPM and stays in sync with the looper loop length.
5. Changing style or BPM while a groove plays updates it on the next bar, with no stuck notes or double clocks.
6. Neither the click nor the groove is audible in a recorded loop (checked with a loop recorded over a silent GP-5 input).
7. All new strings exist in ca, es and en.

## Open questions

1. **Count-in length**: 1 bar is the default. Should it be configurable (1 or 2 bars)?
2. **Groove over the loop**: should the groove keep playing while the looper records, or stop on record? Default: keep playing.
3. **Latency**: the click and the groove sound through the PC output. Measure the offset against the GP-5 input before enabling it by default (see the pending validation in `docs/phase-3a-looper.md`).

## Dependencies

- Phase 3a (looper engine and clock) must be validated with hardware first.
- `tone` (already planned).
