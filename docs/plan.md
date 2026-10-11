# buccles-gp-5 — Implementation plan

## Summary

Web app to control a **Valeton GP-5** (USB MIDI + audio) and a **Chocolate Plus (M-VAVE)** (foot MIDI controller), with a built-in **looper**. Everything runs in the browser with the **Web MIDI API**, the **Web Audio API** and **Tone.js**.

---

## Resolved decisions

| Decision | Answer |
|---|---|
| iOS | **No**. Desktop only (Chrome/Edge). |
| Looper audio source | **GP-5 USB** (USB audio interface). |
| Chocolate Plus configuration | **MIDI Learn** (the app learns any message from the pedal; Cube Suite is not needed). |
| Looper complexity | **1 track first**, then iterate to 4. |
| UI | **Vanilla TypeScript** (no framework). |
| Audio library | **Tone.js** (transport, scheduling, quantize). |

---

## Architecture

```
[Guitar] → [GP-5]  ──USB (MIDI + AUDIO)──┐
                                          ├──→ [PC / Chrome = APP]
[Chocolate Plus] ──USB (MIDI)─────────────┘
```

**Flow A — GP-5 control:**
```
Chocolate Plus (CC/PC) ─→ App (router) ─→ GP-5 (CC#0, blocks…)
App UI (buttons/presets) ────────────────→ GP-5
```

**Flow B — Looper:**
```
GP-5 (USB audio) ─→ getUserMedia ─→ Tone.js ─→ Looper buffer
Chocolate Plus (CC) ─→ App ─→ looper control (rec/play/overdub/undo)
Looper ─→ audio output (PC speakers)
```

---

## File structure

```
src/
├── index.html
├── main.ts                      # Entry point, init all modules
├── style.css                    # Global styles
│
├── midi/
│   ├── midi-manager.ts          # requestMIDIAccess, device listing, statechange
│   ├── midi-monitor.ts          # Debug: display incoming MIDI messages
│   └── midi.types.ts            # Shared MIDI type definitions
│
├── gp5/
│   ├── gp5-mapping.ts           # CC number table (from GP-5 manual)
│   ├── gp5-controller.ts        # High-level API: recallPreset, toggleBlock, tuner…
│   └── gp5-ui.ts                # Preset grid + effect chain UI
│
├── router/
│   ├── midi-router.ts           # Routing engine: input CC → output CC
│   ├── mapping-editor.ts        # UI to configure mappings + MIDI learn
│   ├── scenes.ts                # Scene/bank switching (GP-5 mode vs Looper mode)
│   └── default-mappings.ts      # Factory default mapping
│
├── looper/
│   ├── looper-engine.ts         # Core: record, playback, mix (Tone.js based)
│   ├── looper-track.ts          # Single track: record, overdub, undo, clear
│   ├── looper-clock.ts          # BPM master clock + quantize via Tone.Transport
│   ├── looper-metronome.ts      # Optional click + count-in
│   └── looper-ui.ts             # Waveform display, transport controls, BPM
│
├── audio/
│   └── audio-manager.ts         # Centralized AudioContext, input selection, routing
│
├── storage/
│   └── persistence.ts           # localStorage wrapper, export/import JSON
│
├── ui/
│   ├── components.ts            # Reusable UI helpers (buttons, toggles, indicators)
│   └── layout.ts                # Page sections, navigation between views
│
└── types/
    └── global.d.ts              # Web MIDI type augmentations if needed
```

---

## Implementation phases

### Phase 0 — Bootstrap and feasibility prototype

**Goal**: project compiles and is served; verify that MIDI and audio work with the hardware.

| # | Task | Files | Detail |
|---|------|-------|--------|
| 0.1 | Install dependencies | `package.json` | `npm install` and add `tone` |
| 0.2 | Create base HTML | `src/index.html` | HTML structure with `<div id="app">`, link to `main.ts` and `style.css` |
| 0.3 | Entry point | `src/main.ts` | Sequential init: MIDI → Audio → UI |
| 0.4 | Base styles | `src/style.css` | CSS reset, colour variables, basic layout (flex/grid) |
| 0.5 | MIDI Manager | `src/midi/midi-manager.ts` | `navigator.requestMIDIAccess()`, list inputs/outputs, detect "GP-5" and "Chocolate" by substring, handle `statechange` |
| 0.6 | MIDI Monitor (debug) | `src/midi/midi-monitor.ts` | Show all incoming MIDI messages in real time (to verify the Chocolate Plus works) |
| 0.7 | Audio probe | `src/audio/audio-manager.ts` | `getUserMedia({ audio: true })` selecting the GP-5 as input, loopback playback to check latency |
| 0.8 | Connection UI | `src/ui/components.ts` | Status indicators: "GP-5 connected ✅/❌", "Chocolate Plus ✅/❌", "Audio ✅/❌" |
| 0.9 | Manual check | — | Connect the GP-5 and the Chocolate Plus; verify the app detects them and shows messages |

**Done when**: the app is served at `localhost:5173`, detects both devices when connected, shows the Chocolate Plus MIDI messages on screen, and captures audio from the GP-5.

---

### Phase 1 — MVP: GP-5 controller

**Goal**: complete UI to control all GP-5 parameters from the browser.

| # | Task | Files | Detail |
|---|------|-------|--------|
| 1.1 | CC mapping table | `src/gp5/gp5-mapping.ts` | TypeScript object with all GP-5 CCs (preset recall = CC#0, patch+/patch-, bank+/bank-, block toggles, tuner). Each entry: `{ cc: number, name: string, description: string, valueRange: [min, max] }` |
| 1.2 | GP-5 Controller | `src/gp5/gp5-controller.ts` | Class `GP5Controller` with methods: `recallPreset(n: 1-100)`, `toggleBlock(block: string)`, `patchUp()`, `patchDown()`, `bankUp()`, `bankDown()`, `toggleTuner()`. Each method sends the matching CC via `MIDIOutput.send()` |
| 1.3 | Preset grid UI | `src/gp5/gp5-ui.ts` | Grid of 100 buttons (10×10), click = recall preset. Active preset highlighted. Bank navigation. |
| 1.4 | Effect chain UI | `src/gp5/gp5-ui.ts` | 10 effect modules in a row (NR, PRE, DST, N→S, AMP, CAB, EQ, MOD, DLY, RVB). Toggle on/off with a visual indicator (colour). |
| 1.5 | Tuner | `src/gp5/gp5-ui.ts` | "Tuner" button that sends the tuner CC. Visual state (on/off). |
| 1.6 | Persistence | `src/storage/persistence.ts` | `localStorage` for: current preset, block states. Loaded at start. |
| 1.7 | Automatic detection | `src/midi/midi-manager.ts` | Substring match on the port name: "GP-5" → output, "Chocolate" / "M-VAVE" → input. Fallback: manual selector. |

**Done when**: from the UI you can change preset, turn each effect block on/off, and turn the tuner on. The GP-5 responds correctly to every action.

---

### Phase 2 — MIDI router: Chocolate Plus → GP-5

**Goal**: the Chocolate Plus buttons control the GP-5, with configurable mapping and scenes.

| # | Task | Files | Detail |
|---|------|-------|--------|
| 2.1 | Routing engine | `src/router/midi-router.ts` | Class `MIDIRouter`: receives messages from the Chocolate Plus, applies mapping rules, sends CC to the GP-5. Rules: `{ inputCC: number, outputCC: number, outputValue?: number, transform?: fn }` |
| 2.2 | Default mapping | `src/router/default-mappings.ts` | 4 Chocolate Plus buttons → 4 presets (or patch+/patch-/bank+/bank-). Configurable. |
| 2.3 | Mapping editor | `src/router/mapping-editor.ts` | UI to configure each button: Chocolate Plus button selector (with MIDI learn) + GP-5 action selector (dropdown with all available actions) |
| 2.4 | MIDI Learn | `src/router/mapping-editor.ts` | "Learn" mode: the user presses "Learn", then a button on the Chocolate Plus; the app captures the CC and assigns it to the selected action |
| 2.5 | Scenes | `src/router/scenes.ts` | 2+ switchable scenes. Scene A = "GP-5 control" (buttons → presets/blocks). Scene B = "Looper" (buttons → looper). Switching from the UI or from a dedicated Chocolate Plus button. |
| 2.6 | Mapping persistence | `src/storage/persistence.ts` | Save routing rules and scenes to `localStorage` |
| 2.7 | Export/Import | `src/storage/persistence.ts` | Export the whole configuration as JSON. Import from a file. |

**Done when**: the 4 Chocolate Plus buttons control the GP-5 according to the configured mapping. The user can change the mapping from the UI (with MIDI learn) and switch between scenes.

---

### Phase 3 — Looper

**Goal**: working looper with 1 track, recording the GP-5 audio, controllable over MIDI. Then iterate to multi-track.

#### Iteration 3a — Basic looper (1 track)

| # | Task | Files | Detail |
|---|------|-------|--------|
| 3a.1 | Audio Manager | `src/audio/audio-manager.ts` | Centralises `AudioContext`, selects the input (GP-5), creates routing nodes. `latencyHint: "interactive"`, `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false` |
| 3a.2 | Tone.js init | `src/looper/looper-clock.ts` | Initialises `Tone.Transport`, sets BPM. `Tone.start()` on the user's first click (autoplay policy). |
| 3a.3 | Track engine | `src/looper/looper-track.ts` | Class `LooperTrack`: records with `Tone.Recorder` or `MediaRecorder` + `AudioBuffer`. Operations: `record()`, `play()`, `stop()`, `overdub()`, `undo()`, `clear()`. Stores audio as an in-memory `AudioBuffer`. |
| 3a.4 | Looper engine | `src/looper/looper-engine.ts` | Orchestrates tracks, manages the output mix. Connects GP-5 input → recorder → playback → speakers. |
| 3a.5 | Quantize | `src/looper/looper-clock.ts` | Snaps record start/stop to the next beat/bar boundary. Uses `Tone.Transport` to calculate the exact timing. |
| 3a.6 | Looper UI | `src/looper/looper-ui.ts` | Track view: state (idle/recording/playing/overdub), transport buttons, time indicator, volume. |
| 3a.7 | MIDI control | `src/router/midi-router.ts` | Mapping in the "Looper" scene: button 1 = record/play, button 2 = stop, button 3 = undo, button 4 = clear. |

**Done when**: with a Chocolate Plus button (or from the UI) a loop is recorded; with another it plays; overdub, undo and clear work. The recorded audio comes from the GP-5.

#### Iteration 3b — Metronome and count-in

| # | Task | Files | Detail |
|---|------|-------|--------|
| 3b.1 | Metronome | `src/looper/looper-metronome.ts` | Click track with `Tone.Synth` or `Tone.MembraneSynth`. Sounds on every beat, accent on beat 1. Toggle on/off. |
| 3b.2 | Count-in | `src/looper/looper-metronome.ts` | 1 bar of count-in before recording starts (optional). |
| 3b.3 | BPM UI | `src/looper/looper-ui.ts` | Numeric BPM input, tap tempo (a button that calculates the BPM from successive taps). |

#### Iteration 3c — Multi-track (2 → 4 tracks)

| # | Task | Files | Detail |
|---|------|-------|--------|
| 3c.1 | Multi-track | `src/looper/looper-engine.ts` | Extend to 2 tracks, then 4. Each track: independent controls, individual volume, mute/solo. |
| 3c.2 | Waveform UI | `src/looper/looper-ui.ts` | Waveform display per track (Canvas or Web Audio `AnalyserNode`). |
| 3c.3 | Stop All | `src/looper/looper-engine.ts` | "Stop All" button that stops all tracks at the same time. |
| 3c.4 | Sync between tracks | `src/looper/looper-clock.ts` | All tracks synchronised to the same clock/quantize. The first track's loop length is the reference for the others. |

---

### Phase 4 — Polish

**Goal**: robust, polished app ready for real use.

| # | Task | Files | Detail |
|---|------|-------|--------|
| 4.1 | Error handling | all | `try/catch` everywhere. Clear error messages in the UI. Toast notifications. |
| 4.2 | Disconnect/reconnect | `src/midi/midi-manager.ts` | `statechange` handler: if a device disconnects, show a warning. If it reconnects, reassign automatically. |
| 4.3 | AudioContext resume | `src/audio/audio-manager.ts` | Handler for the `suspended` state (Chrome autoplay policy). A "Click to enable audio" button if needed. |
| 4.4 | Dark/Light theme | `src/style.css` | CSS custom properties, toggle in the UI. Respect `prefers-color-scheme`. |
| 4.5 | Responsive layout | `src/style.css` | Works on laptop and tablet screens. |
| 4.6 | Keyboard shortcuts | `src/ui/components.ts` | Keyboard shortcuts for all main actions (space = play/stop, R = record, etc.) |
| 4.7 | Full export/import | `src/storage/persistence.ts` | JSON with the whole configuration: mappings, scenes, BPM, preferences. |
| 4.8 | PWA (optional) | `public/manifest.json`, service worker | Manifest + service worker for offline use. `vite-plugin-pwa` if needed. |

---

## Dependencies

### Production
| Package | Purpose |
|---------|---------|
| `tone` | Transport, scheduling, quantize, metronome, recorder |

### Development (already present)
| Package | Purpose |
|---------|---------|
| `typescript` | Type safety |
| `vite` | Dev server + build |

### Optional (Phase 4)
| Package | Purpose |
|---------|---------|
| `vite-plugin-pwa` | PWA support |

---

## Code conventions

- **Strict TypeScript** (`strict: true`, already configured)
- **ES2022** target, ESNext modules
- **Native ES modules** (no CommonJS)
- **File names**: kebab-case (`midi-manager.ts`)
- **Class names**: PascalCase (`GP5Controller`, `LooperTrack`)
- **Function and variable names**: camelCase
- **Constants**: UPPER_SNAKE_CASE for fixed values, camelCase for config objects
- **CSS**: custom properties for theming, BEM-ish class naming
- **Comments and documentation: in English**
- **UI languages: Catalan (default), Spanish and English** via `src/i18n/`. The English
  dictionary (`en.ts`) defines the keys; `ca.ts` and `es.ts` are typed against it, so a missing
  key fails the build. Static HTML uses `data-i18n` attributes; dynamic UI calls `t()` and
  re-renders on `onLocaleChange`. Console messages and error logs are not translated.
- **No `any`** — type everything, especially MIDI messages

---

## Recommended execution order

```
Phase 0  →  Phase 1  →  Phase 2  →  Phase 3a  →  Phase 3b  →  Phase 3c  →  Phase 4
(1-2d)     (2-3d)      (2d)        (2-3d)       (1d)         (2d)         (2d)
```

**Estimated total: ~12–15 days** of focused work.

---

## Known risks

1. **GP-5 CC table**: the README says it is in the manual (page ~40). The manual is needed to fill `gp5-mapping.ts` correctly. If it cannot be found, experimentation will be needed.
2. **Looper latency**: Web Audio has input latency. `latencyHint: "interactive"` and disabling audio processing should be enough for practice, but this must be validated with the real hardware.
3. **MIDI device names**: they may vary between operating systems (Windows, Linux, macOS). Substring detection must be flexible and have a manual fallback.
4. **Risk of bricking the GP-5 with SysEx**: never send undocumented SysEx. Only CCs from the official table (voes.be). The GP-5 SysEx protocol uses XOR/checksum encoding; out of scope for now.
5. **Tone.js + Web MIDI**: make sure `Tone.Transport` and Web MIDI clock do not interfere with each other. They are independent, but the quantize timing must be coordinated.
