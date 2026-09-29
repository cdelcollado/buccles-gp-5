# buccles-gp-5 — Pla d'implementació

## Resum

App web per controlar un **Valeton GP-5** (USB MIDI + àudio) i un **Chocolate Plus (M-VAVE)** (controlador MIDI de peu), amb un **looper** integrat. Tot al navegador amb **Web MIDI API**, **Web Audio API** i **Tone.js**.

---

## Decisions resoltes

| Decisió | Resposta |
|---|---|
| iOS | **No**. Només desktop (Chrome/Edge). |
| Font d'àudio del looper | **GP-5 USB** (interfície d'àudio USB). |
| Configuració del Chocolate Plus | **MIDI Learn** (l'app aprèn qualsevol missatge del pedal; no cal Cube Suite). |
| Complexitat del looper | **1 pista primer**, iterar a 4. |
| UI | **Vanilla TypeScript** (sense framework). |
| Llibreria d'àudio | **Tone.js** (transport, scheduling, quantize). |

---

## Arquitectura

```
[Guitarra] → [GP-5]  ──USB (MIDI + ÀUDIO)──┐
                                             ├──→ [PC / Chrome = APP]
[Chocolate Plus] ──USB (MIDI)───────────────┘
```

**Flux A — Control GP-5:**
```
Chocolate Plus (CC/PC) ─→ App (router) ─→ GP-5 (CC#0, blocs…)
App UI (botons/presets) ────────────────→ GP-5
```

**Flux B — Looper:**
```
GP-5 (àudio USB) ─→ getUserMedia ─→ Tone.js ─→ Looper buffer
Chocolate Plus (CC) ─→ App ─→ control looper (rec/play/overdub/undo)
Looper ─→ sortida àudio (altaveus PC)
```

---

## Estructura de fitxers

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

## Fases d'implementació

### Fase 0 — Bootstrap i prototip de viabilitat

**Objectiu**: Projecte compilant, servint, i verificació que MIDI + àudio funcionen amb el hardware.

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 0.1 | Instal·lar dependències | `package.json` | `npm install` + afegir `tone` |
| 0.2 | Crear HTML base | `src/index.html` | Estructura HTML amb `<div id="app">`, link a `main.ts` i `style.css` |
| 0.3 | Entry point | `src/main.ts` | Inicialització seqüencial: MIDI → Àudio → UI |
| 0.4 | Estils base | `src/style.css` | CSS reset, variables de color, layout bàsic (flex/grid) |
| 0.5 | MIDI Manager | `src/midi/midi-manager.ts` | `navigator.requestMIDIAccess()`, llista inputs/outputs, detecta "GP-5" i "Chocolate" per subcadena, gestiona `statechange` |
| 0.6 | MIDI Monitor (debug) | `src/midi/midi-monitor.ts` | Mostra tots els missatges MIDI entrants en temps real (per verificar que el Chocolate Plus funciona) |
| 0.7 | Audio probe | `src/audio/audio-manager.ts` | `getUserMedia({ audio: true })` seleccionant el GP-5 com a input, playback loopback per verificar latència |
| 0.8 | UI de connexió | `src/ui/components.ts` | Indicadors d'estat: "GP-5 connectat ✅/❌", "Chocolate Plus ✅/❌", "Àudio ✅/❌" |
| 0.9 | Verificar manualment | — | Connectar GP-5 i Chocolate Plus, verificar que l'app els detecta i mostra missatges |

**Criteri de completitud**: L'app es serveix a `localhost:5173`, detecta ambdós dispositius en connectar-los, mostra els missatges MIDI del Chocolate Plus en pantalla, i captura àudio del GP-5.

---

### Fase 1 — MVP: Controlador GP-5

**Objectiu**: UI completa per controlar tots els paràmetres del GP-5 des del navegador.

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 1.1 | Taula de mapeig CC | `src/gp5/gp5-mapping.ts` | Objecte TypeScript amb tots els CC del GP-5 (preset recall = CC#0, patch+/patch-, bank+/bank-, toggle blocs, afinador). Cada entrada: `{ cc: number, name: string, description: string, valueRange: [min, max] }` |
| 1.2 | GP-5 Controller | `src/gp5/gp5-controller.ts` | Classe `GP5Controller` amb mètodes: `recallPreset(n: 1-100)`, `toggleBlock(block: string)`, `patchUp()`, `patchDown()`, `bankUp()`, `bankDown()`, `toggleTuner()`. Cada mètode envia el CC corresponent via `MIDIOutput.send()` |
| 1.3 | Preset Grid UI | `src/gp5/gp5-ui.ts` | Graella de 100 botons (10×10), clic = recall preset. Preset actiu ressaltat. Navegació per bancs. |
| 1.4 | Effect Chain UI | `src/gp5/gp5-ui.ts` | 10 mòduls d'efecte en fila (NR, PRE, DST, N→S, AMP, CAB, EQ, MOD, DLY, RVB). Toggle on/off amb indicador visual (color). |
| 1.5 | Afinador | `src/gp5/gp5-ui.ts` | Botó "Tuner" que envia CC d'afinador. Estat visual (on/off). |
| 1.6 | Persistència | `src/storage/persistence.ts` | `localStorage` per: preset actual, estat dels blocs. Càrrega a l'inici. |
| 1.7 | Detecció automàtica | `src/midi/midi-manager.ts` | Match per subcadena al nom del port: "GP-5" → output, "Chocolate" / "M-VAVE" → input. Fallback: selector manual. |

**Criteri de completitud**: Des de la UI es pot canviar de preset, activar/desactivar cada bloc d'efecte, i activar l'afinador. El GP-5 respon correctament a totes les accions.

---

### Fase 2 — Router MIDI: Chocolate Plus → GP-5

**Objectiu**: Els botons del Chocolate Plus controlen el GP-5, amb mapeig configurable i escenes.

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 2.1 | Motor de routing | `src/router/midi-router.ts` | Classe `MIDIRouter`: rep missatges del Chocolate Plus, aplica regles de mapeig, envia CC al GP-5. Regles: `{ inputCC: number, outputCC: number, outputValue?: number, transform?: fn }` |
| 2.2 | Mapeig per defecte | `src/router/default-mappings.ts` | 4 botons del Chocolate Plus → 4 presets (o patch+/patch-/bank+/bank-). Configurable. |
| 2.3 | Editor de mapeig | `src/router/mapping-editor.ts` | UI per configurar cada botó: selector de botó del Chocolate Plus (amb MIDI learn) + selector d'acció del GP-5 (dropdown amb totes les accions disponibles) |
| 2.4 | MIDI Learn | `src/router/mapping-editor.ts` | Mode "Learn": l'usuari prem "Learn", després prem un botó al Chocolate Plus, l'app captura el CC i l'assigna a l'acció seleccionada |
| 2.5 | Escenes | `src/router/scenes.ts` | 2+ escenes commutables. Escena A = "Control GP-5" (botons → presets/blocs). Escena B = "Looper" (botons → looper). Commutació des de UI o des d'un botó dedicat del Chocolate Plus. |
| 2.6 | Persistència de mapeigs | `src/storage/persistence.ts` | Desar regles de routing i escenes a `localStorage` |
| 2.7 | Export/Import | `src/storage/persistence.ts` | Exportar tota la configuració com a JSON. Importar des de fitxer. |

**Criteri de completitud**: Els 4 botons del Chocolate Plus controlen el GP-5 segons el mapeig configurat. L'usuari pot canviar el mapeig des de la UI (amb MIDI learn) i commutar entre escenes.

---

### Fase 3 — Looper

**Objectiu**: Looper funcional amb 1 pista, gravant l'àudio del GP-5, controlable per MIDI. Després iterar a multi-pista.

#### Iteració 3a — Looper bàsic (1 pista)

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 3a.1 | Audio Manager | `src/audio/audio-manager.ts` | Centralitza `AudioContext`, selecciona input (GP-5), crea nodes de routing. `latencyHint: "interactive"`, `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false` |
| 3a.2 | Tone.js init | `src/looper/looper-clock.ts` | Inicialitza `Tone.Transport`, configura BPM. `Tone.start()` al primer click de l'usuari (política d'autoplay). |
| 3a.3 | Track engine | `src/looper/looper-track.ts` | Classe `LooperTrack`: grava amb `Tone.Recorder` o `MediaRecorder` + `AudioBuffer`. Operacions: `record()`, `play()`, `stop()`, `overdub()`, `undo()`, `clear()`. Emmagatzema àudio com `AudioBuffer` en memòria. |
| 3a.4 | Looper Engine | `src/looper/looper-engine.ts` | Orquestra les pistes, gestiona el mix de sortida. Connecta input del GP-5 → recorder → playback → speakers. |
| 3a.5 | Quantize | `src/looper/looper-clock.ts` | Snap de record start/stop al pròxim beat/bar boundary. Usa `Tone.Transport` per calcular el timing exacte. |
| 3a.6 | Looper UI | `src/looper/looper-ui.ts` | Vista de la pista: estat (idle/recording/playing/overdub), botons de transport, indicador de temps, volum. |
| 3a.7 | MIDI control | `src/router/midi-router.ts` | Mapeig dins l'escena "Looper": botó 1 = record/play, botó 2 = stop, botó 3 = undo, botó 4 = clear. |

**Criteri de completitud**: Amb un botó del Chocolate Plus (o de la UI) es grava un loop, amb un altre es reprodueix, overdub, undo i clear. L'àudio gravat ve del GP-5.

#### Iteració 3b — Metrònom i count-in

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 3b.1 | Metrònom | `src/looper/looper-metronome.ts` | Click track amb `Tone.Synth` o `Tone.MembraneSynth`. Sons a cada beat, accent al beat 1. Toggle on/off. |
| 3b.2 | Count-in | `src/looper/looper-metronome.ts` | 1 compàs de count-in abans de començar a gravar (opcional). |
| 3b.3 | BPM UI | `src/looper/looper-ui.ts` | Input numèric per BPM, tap tempo (botó que calcula BPM de taps successius). |

#### Iteració 3c — Multi-pista (2 → 4 pistes)

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 3c.1 | Multi-track | `src/looper/looper-engine.ts` | Ampliar a 2 pistes, després 4. Cada pista: controls independents, volum individual, mute/solo. |
| 3c.2 | Waveform UI | `src/looper/looper-ui.ts` | Visualització de forma d'ona per pista (Canvas o Web Audio AnalyserNode). |
| 3c.3 | Stop All | `src/looper/looper-engine.ts` | Botó "Stop All" que atura totes les pistes simultàniament. |
| 3c.4 | Sync entre pistes | `src/looper/looper-clock.ts` | Totes les pistes sincronitzades al mateix clock/quantize. Loop length de la primera pista = referència per les altres. |

---

### Fase 4 — Polish

**Objectiu**: App robusta, polida i preparada per ús real.

| # | Tasca | Fitxers | Detall |
|---|-------|---------|--------|
| 4.1 | Gestió d'errors | tots | `try/catch` a tot arreu. Missatges d'error clars a la UI. Toast notifications. |
| 4.2 | Desconnexió/reconnexió | `src/midi/midi-manager.ts` | `statechange` handler: si es desconnecta un dispositiu, mostrar warning. Si es reconnecta, reassignar automàticament. |
| 4.3 | AudioContext resume | `src/audio/audio-manager.ts` | Handler per `suspended` state (Chrome autoplay policy). Botó "Click to enable audio" si cal. |
| 4.4 | Dark/Light theme | `src/style.css` | CSS custom properties, toggle a la UI. Respectar `prefers-color-scheme`. |
| 4.5 | Layout responsive | `src/style.css` | Funcional a pantalles de portàtil i tablet. |
| 4.6 | Keyboard shortcuts | `src/ui/components.ts` | Dreceres de teclat per a totes les accions principals (espai = play/stop, R = record, etc.) |
| 4.7 | Export/Import complet | `src/storage/persistence.ts` | JSON amb tota la config: mapeigs, escenes, BPM, preferències. |
| 4.8 | PWA (opcional) | `public/manifest.json`, service worker | Manifest + service worker per funcionament offline. `vite-plugin-pwa` si cal. |

---

## Dependències

### Producció
| Paquet | Per a què |
|--------|-----------|
| `tone` | Transport, scheduling, quantize, metronome, recorder |

### Desenvolupament (ja presents)
| Paquet | Per a què |
|--------|-----------|
| `typescript` | Type safety |
| `vite` | Dev server + build |

### Opcional (Fase 4)
| Paquet | Per a què |
|--------|-----------|
| `vite-plugin-pwa` | PWA support |

---

## Convencions de codi

- **TypeScript estricte** (`strict: true` ja configurat)
- **ES2022** target, ESNext modules
- **Mòduls ES natius** (no CommonJS)
- **Noms de fitxer**: kebab-case (`midi-manager.ts`)
- **Noms de classes**: PascalCase (`GP5Controller`, `LooperTrack`)
- **Noms de funcions/variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE per a valors fixos, camelCase per a objectes de config
- **CSS**: custom properties per a theming, BEM-ish naming per a classes
- **Comentaris**: en català (consistent amb el README)
- **No `any`** — tipar tot, especialment els missatges MIDI

---

## Ordre d'execució recomanat

```
Fase 0  →  Fase 1  →  Fase 2  →  Fase 3a  →  Fase 3b  →  Fase 3c  →  Fase 4
(1-2d)    (2-3d)     (2d)       (2-3d)      (1d)        (2d)        (2d)
```

**Total estimat: ~12-15 dies** de feina concentrada.

---

## Riscos coneguts

1. **Taula CC del GP-5**: el README diu que és al manual (pàg. ~40). Cal tenir el manual a mà per omplir `gp5-mapping.ts` correctament. Si no es troba, caldrà experimentació.
2. **Latència del looper**: Web Audio té latència d'entrada. `latencyHint: "interactive"` i desactivar processament d'àudio hauria de ser suficient per practicar, però cal validar-ho amb el hardware real.
3. **Noms de dispositius MIDI**: poden variar entre SO (Windows vs Linux vs Mac). La detecció per subcadena ha de ser flexible i tenir fallback manual.
4. **Risc de brick del GP-5 per SysEx**: mai enviar SysEx no documentat. Només CC de la taula oficial (voes.be). El protocol SysEx del GP-5 usa encoding XOR/checksum; de moment fora d'abast.
5. **Tone.js + Web MIDI**: cal assegurar-se que `Tone.Transport` i el Web MIDI clock no interfereixin. Són independents però cal coordinar el timing del quantize.
