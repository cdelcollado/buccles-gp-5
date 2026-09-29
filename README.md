# buccles-gp-5

Web app to control a **Valeton GP-5** connected via USB and the **Chocolate Plus (M-VAVE)** as a MIDI controller, with a built-in **looper** (Quantiloop/Korg-style).

---

# Plan: web app to control the Valeton GP-5 and the Chocolate Plus + looper

## 1. Idea summary

A PWA (or a simple HTTPS-served web page) that acts as the **"central hub"**:

- Controls the **GP-5** over USB (presets, effects, tuner…).
- Reads the **Chocolate Plus** as a MIDI controller.
- Acts as a **router/translator** between the Chocolate Plus and the GP-5.
- Includes a **looper** (Quantiloop/Korg-style) triggered by the Chocolate Plus over MIDI, recording the guitar audio coming in through the GP-5 (which is also a USB audio interface).

Everything runs in the browser with two standard APIs: **Web MIDI API** and **Web Audio API**.

---

## 2. Technical feasibility (what we've confirmed)

### 2.1 Valeton GP-5
- **MIDI over USB-C**: yes, class-compliant (works on Win/Mac/iOS/Android). It does *not* send MIDI over Bluetooth, only over cable.
- **Listens on MIDI channel 1** (fixed, not configurable).
- **Presets**: recalled with **CC#0** (value 0–99 = preset 00–99). It does *not* use Program Change for presets (unusual).
- **Effect modules** (10: NR, PRE, DST, N→S, AMP, CAB, EQ, MOD, DLY, RVB): toggled on/off with **CC** (hypothesis: 0 = off, 127 = on).
- **Patch/bank scroll** and **tuner**: also via CC (Patch+/Patch−, Bank+/Bank−).
- It is also a **2-in/2-out USB audio interface** → the processed guitar can be captured in the browser for the looper.
- ⚠️ **Careful with SysEx**: there are documented cases of GP-5 units being "bricked" by receiving MIDI messages misinterpreted as firmware SysEx. *Never* send undocumented SysEx. The GP-5 has a full SysEx protocol (with **XOR/checksum encoding**) but for now we only use CC over USB.
- **Sources**: official CC table at <https://voes.be/midi-cc/valeton_gp5.html>; SysEx protocol and connection guides at <https://rvalladares.com/gp5/>.

### 2.2 Chocolate Plus (M-VAVE)
- A **4-button** foot controller, configurable.
- Sends **PC, CC, Note On/Off and SysEx** (and has a USB host port, TRS MIDI and BT).
- **Class-compliant USB MIDI** → the browser sees it as a MIDI input device.
- Configured with the **Cube Suite** app (or directly from our app, if we wanted to).
- Note: the wireless connection is the least reliable part (non-standard BT on some versions). **USB recommended** for this app.

### 2.3 Browsers (Web MIDI API)
| Browser | Web MIDI | Notes |
|---|---|---|
| Chrome / Edge / Opera | ✅ yes | Recommended. Requires **HTTPS** or `localhost`. SysEx needs the extra `sysex: true` permission. |
| Firefox 108+ | ✅ yes (partial) | Requires installing a "permission add-on". Not on Firefox Android. |
| **Safari (mac/iOS)** | ❌ **no** | No version supports it. On iOS, even Chrome/Edge use WebKit → also not supported. |

> This is the **key limitation**: your "Quantiloop for iOS" reference works on iOS because it's a native app. A *web* app **cannot read MIDI on iOS/Safari**. The **looper with Web Audio does work on iOS**, but without foot MIDI control (you'd have to tap on-screen buttons).

### 2.4 Looper with Web Audio API
- Universal support (including Safari). Loop recording/playback, multi-track, overdub, undo, quantize, BPM. Entirely feasible.

---

## 3. Architecture

### Connection topology (all on the PC)

```
[Guitar] → [GP-5]  ──USB (MIDI + AUDIO)──┐
                                          ├──→ [PC / Browser = APP]
[Chocolate Plus] ──USB (MIDI)─────────────┘
```

The browser is the central element. There are two parallel logics:

**Flow A — GP-5 control:**
```
Chocolate Plus (CC/PC) ─→ App (routing/translator) ─→ GP-5 (CC#0, modules…)
App UI (buttons/presets) ────────────────────────────→ GP-5
```

**Flow B — Looper:**
```
GP-5 (USB audio, processed guitar) ─→ Web Audio (recording) ─→ Looper
Chocolate Plus (CC/Note) ─→ App ─→ looper control (rec/play/overdub/undo…)
Looper ─→ audio output (PC speakers or back to the GP-5)
```

### Key design point
The app does **two things with the same Chocolate Plus input**:
1. **"GP-5 control" mode**: the Chocolate Plus buttons fire CC toward the GP-5 (or change preset, toggles, tuner).
2. **"Looper" mode**: the same buttons (or a different "layer") fire looper functions.

This is resolved with **scenes/banks** switchable from the app itself (or with a dedicated "Looper mode" button).

> **Current decision**: the Chocolate Plus is now **dedicated to the looper**. The GP-5 is controlled from the on-screen UI. The scene-based architecture is kept so the hybrid (GP-5 + looper) can be added later as a small addition.

---

## 4. Application modules

1. **Device Manager (Web MIDI)**
   - `navigator.requestMIDIAccess({ sysex: true })`
   - Lists input and output devices, detects "GP-5" and "Chocolate Plus" by name.
   - Handles `statechange` (hot-plug).
   - Shows if HTTPS is missing or the browser doesn't support MIDI.

2. **GP-5 Controller**
   - Preset recall (CC#0 + value), patch/bank scroll, effect module toggles, tuner.
   - Visual UI (the 100 presets, a chain of 10 modules, on/off indicators).
   - CC mapping table in a JSON file (easy to maintain once the manual is out).

3. **MIDI Router / Translator**
   - Rules: "Chocolate Plus input → CC X → forward to GP-5 as CC Y".
   - User-configurable mapping ("learn" or manual).
   - Scene switching (GP-5 vs Looper).

4. **Looper (Web Audio)**
   - Multi-track (e.g. 4), overdub, undo/redo, per-track clear, stop all.
   - **Quantize** to bar/beat with a BPM (master clock), MIDI sync.
   - Optional metronome and "count-in".
   - Audio input via `getUserMedia` from the GP-5 (or any input).

5. **Persistence**
   - Save routing configs, mappings and BPM to `localStorage`/`IndexedDB`.
   - Export/import configs (JSON).

---

## 5. GP-5 MIDI message details

Summary of what to implement (source: <https://voes.be/midi-cc/valeton_gp5.html>):

| Function | CC# | Value |
|---|---|---|
| Recall preset N | 0 | 0–99 (preset 00–99) |
| Patch volume | 7 | 0–100 |
| Bank − / Bank + | 22 / 23 | trigger |
| Patch − / Patch + | 24 / 25 | trigger |
| Patch − / + (song list) | 29 / 30 | trigger |
| Module on/off (NR/PRE/DST/N→S/AMP/CAB/EQ/MOD/DLY/RVB) | 48–57 | 0 = off, 127 = on (hypothesis) |
| Tuner | 58 | 0 = off, 127 = on |
| CTL | 69 | trigger |

> Recommendation: **never send anything undocumented** (SysEx brick risk). Only CC from the official table.

---

## 6. The looper in detail

Features to replicate (Quantiloop/Korg style):

- **4 synced tracks** at a BPM.
- Per-track operations: `Record`, `Play/Stop`, `Overdub`, `Undo`, `Clear`, and `Stop all`.
- **Quantize**: start/stop the loop at the next bar boundary (avoids drift).
- **MIDI mapping**: each operation ↔ a Chocolate Plus CC/PC.
- Audio flow: `getUserMedia` from the GP-5 → Web Audio nodes → loop buffer → output.

**Latency consideration**: Web Audio has non-negligible input latency. For casual practice/live it is acceptable if we request `latencyHint: "interactive"` and disable `echoCancellation`/`noiseSuppression`. For studio-grade needs, a native app (or a direct audio interface) would be better. Must be validated in the prototype.

---

## 7. Risks and limitations

1. **Safari/iOS without Web MIDI** → the looper works on iOS, but without foot control. If iOS is a requirement, rethink (native app / third-party Web MIDI Browser / BLE MIDI outside the browser).
2. **HTTPS required** → must be served over HTTPS (or `localhost` for development). Without a certificate, the API doesn't appear.
3. **GP-5 only on channel 1 and CC for presets** → must be respected; it doesn't use PC for presets.
4. **SysEx brick risk** → never send undocumented SysEx.
5. **Looper latency** → must be measured in the prototype; possible extra work (lookahead scheduling).
6. **Chocolate Plus Bluetooth unreliable** → use USB.
7. **Device names** not standardized → robust detection (by substring) and manual selection as fallback.

---

## 8. Proposed roadmap

- **Phase 0 — Feasibility prototype (1–2 days)**
  - Page listing Web MIDI devices and showing incoming Chocolate Plus messages.
  - Test forwarding a CC to the GP-5 (preset recall) from the console.
  - Capture GP-5 audio with `getUserMedia` and check latency.

- **Phase 1 — GP-5 control MVP**
  - Presets UI + module toggles + tuner. Mapping persistence.

- **Phase 2 — Router Chocolate Plus → GP-5** *(deferred)*
  - Configurable mapping and scenes.

- **Phase 3 — Looper**
  - 2 tracks → 4 tracks, overdub, undo, quantize, metronome.

- **Phase 4 — Polish / PWA**
  - Offline, export/import configs, theming.

---

## 9. Recommended stack

- **Vanilla JS/TS + Vite** (enough; no heavy framework needed).
- **WebMidi.js** or **JZZ** to abstract Web MIDI (easier device/message handling). Alternative: native Web MIDI, which is simple enough.
- **Tone.js** for the looper (tempo, transport, quantize, scheduling) — though it can also be done with pure Web Audio if we want fewer dependencies.
- **lit / Preact** if you want lightweight UI components.
- Serve over HTTPS (Vite + mkcert locally; Netlify/Vercel/Cloudflare Pages in production).

---

## 10. Decisions

### ✅ Decisions made (2026)

| Decision | Answer |
|---|---|
| iOS | **No**. Desktop only (Chrome/Edge). |
| Looper audio source | **GP-5 USB** (USB audio interface). |
| Chocolate Plus config | **MIDI Learn** (the app learns any message from the pedal; no need to configure it). |
| Looper complexity | **2 tracks first** (MVP), Chocolate Plus dedicated to the looper. |
| UI | **Vanilla TypeScript** (no framework). |
| Audio library | **Tone.js** (transport, scheduling, quantize). |

### Original questions (context)

1. **Is iOS a requirement?** (determines whether a non-web solution is needed for MIDI on iOS).
2. **Where does the looper audio come from**: capture GP-5 audio over USB (recommended) or another source?
3. **Chocolate Plus mapping**: configure it from Cube Suite (fixed messages) or manage everything from our app?
4. **Looper complexity**: is 4 tracks + quantize the starting point, or do we want something simpler first?

---

## 11. Documentation

- [docs/plan.md](docs/plan.md) — Full implementation plan (phases, files, conventions, risks).
- [docs/phase-0.md](docs/phase-0.md) — Phase 0 progress (bootstrap and feasibility prototype).
- [docs/phase-1.md](docs/phase-1.md) — Phase 1 progress (GP-5 controller MVP).
