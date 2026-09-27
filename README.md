# buccles-gp-5

App web per controlar un **Valeton GP‑5** connectat per USB i el **Chocolate Plus (M‑VAVE)** com a controlador MIDI, amb un **looper** integrat (estil Quantiloop / Korg).

---

# Pla: app web per controlar el Valeton GP‑5 i el Chocolate Plus + looper

## 1. Resum de la idea

Una PWA (o simple pàgina web servida per HTTPS) que actua de **"hub central"**:

- Controla el **GP‑5** per USB (presets, efectes, afinador…).
- Llegeix el **Chocolate Plus** com a controlador MIDI.
- Fa de **router/translator** entre el Chocolate Plus i el GP‑5.
- Incorpora un **looper** (tipus Quantiloop/Korg) que el Chocolate Plus dispara per MIDI, i que grava l'àudio de la guitarra que entra pel GP‑5 (que també és interfície d'àudio USB).

Tot funciona al navegador amb dues APIs estàndard: **Web MIDI API** i **Web Audio API**.

---

## 2. Viabilitat tècnica (què hem confirmat)

### 2.1 Valeton GP‑5
- **MIDI per USB‑C**: sí, class‑compliant (funciona Win/Mac/iOS/Android). *No* envia MIDI per Bluetooth, només per cable.
- **Escolta al canal MIDI 1** (fix, no configurable).
- **Presets**: es recorden amb **CC#0** (valor 1–100 = preset 1–100). *No* usa Program Change per presets (fet poc habitual).
- **Blocs d'efecte** (drive, mod, delay, reverb, amp, EQ…): s'encenen/apaguen amb **CC** (valor 0 = bypass, 127 = on).
- **Scroll** de patch/bank i **afinador**: també per CC (Patch+/Patch‑, Bank+/Bank‑).
- També és **interfície d'àudio USB 2‑in/2‑out** → la guitarra processada es pot capturar al navegador per al looper.
- ⚠️ **Cura amb SysEx**: hi ha casos documentats de GP‑5 "bricked" per rebre missatges MIDI mal interpretats com a SysEx de firmware. *Mai* enviar SysEx no documentat. La taula CC completa és al manual (pàg. ~40).

### 2.2 Chocolate Plus (M‑VAVE)
- Controlador de peu de **4 botons**, configurables.
- Envia **PC, CC, Note On/Off i SysEx** (i té port USB host, TRS MIDI i BT).
- **USB MIDI class‑compliant** → el navegador el veu com a dispositiu MIDI d'entrada.
- Es configura amb l'app **Cube Suite** (o directament des de la nostra app, si volem).
- Nota: la connexió sense fils és la part menys fiable (BT no estàndard en algunes versions). **Recomano USB** per a aquesta app.

### 2.3 Navegadors (Web MIDI API)
| Navegador | Web MIDI | Notes |
|---|---|---|
| Chrome / Edge / Opera | ✅ sí | Recomanat. Requereix **HTTPS** o `localhost`. SysEx demana permís extra `sysex: true`. |
| Firefox 108+ | ✅ sí (parcial) | Demana instal·lar un "permission add‑on". No a Firefox Android. |
| **Safari (mac/iOS)** | ❌ **no** | Cap versió el suporta. A iOS, fins i tot Chrome/Edge fan servir WebKit → tampoc. |

> Això és la **limitació clau**: el teu referent "Quantiloop per iOS" funciona a iOS perquè és una app nativa. Una app *web* **no podrà llegir MIDI a iOS/Safari**. El **looper amb Web Audio sí que funciona a iOS**, però sense control MIDI per peu (hauries de tocar botons a la pantalla).

### 2.4 Looper amb Web Audio API
- Suport universal (inclou Safari). Gravació i reproducció de loops, multi‑pista, overdub, undo, quantize, BPM. Totalment factible.

---

## 3. Arquitectura

### Topologia de connexions (tota al PC)

```
[Guitarra] → [GP-5]  ──USB (MIDI + ÀUDIO)──┐
                                             ├──→ [PC / Navegador = APP]
[Chocolate Plus] ──USB (MIDI)───────────────┘
```

El navegador és l'element central. Hi ha dues lògiques paral·leles:

**Flux A — Control del GP‑5:**
```
Chocolate Plus (CC/PC) ─→ App (routing/translator) ─→ GP-5 (CC#0, blocs…)
App UI (botons/presets) ─────────────────────────────→ GP-5
```

**Flux B — Looper:**
```
GP-5 (àudio USB, guitarra processada) ─→ Web Audio (gravació) ─→ Looper
Chocolate Plus (CC/Note) ─→ App ─→ control del looper (rec/play/overdub/undo…)
Looper ─→ sortida àudio (altaveus PC o retorn al GP-5)
```

### Punt clau de disseny
L'app fa **dues coses amb la mateixa entrada del Chocolate Plus**:
1. **Mode "Control GP‑5"**: els botons del Chocolate Plus disparen CC cap al GP‑5 (o canvien preset, toggles, afinador).
2. **Mode "Looper"**: els mateixos botons (o un "layer" diferent) disparen funcions del looper.

Això es resol amb **escenes/bancs** commutables des de la mateixa app (o amb un botó dedicat "Mode looper").

---

## 4. Mòduls de l'aplicació

1. **Device Manager (Web MIDI)**
   - `navigator.requestMIDIAccess({ sysex: true })`
   - Llista dispositius d'entrada i sortida, detecta "GP‑5" i "Chocolate Plus" pel nom.
   - Gestiona `statechange` (connectar/desconnectar en calent).
   - Mostra si falta HTTPS o si el navegador no suporta MIDI.

2. **GP‑5 Controller**
   - Recall de preset (CC#0 + valor), scroll patch/bank, toggle de blocs d'efecte, afinador.
   - UI visual (els 100 presets, cadena de 9 blocs, indicadors on/off).
   - Taula de mapeig CC en un arxiu JSON (fàcil de mantenir quan surti el manual).

3. **MIDI Router / Translator**
   - Regles: "entrada Chocolate Plus → CC X → reenviar a GP‑5 com CC Y".
   - Mapeig configurable per l'usuari (mapa "learn" o manual).
   - Commutació d'escenes (GP‑5 vs Looper).

4. **Looper (Web Audio)**
   - Multi‑pista (p. ex. 4), overdub, undo/redo, clear per pista, stop all.
   - **Quantize** a compàs/béat amb un BPM (master clock), sincronia amb el MIDI.
   - Metrònom opcional i "count‑in".
   - Entrada d'àudio via `getUserMedia` del GP‑5 (o qualsevol entrada).

5. **Persistència**
   - Desar configuracions de routing, mapeigs i BPM a `localStorage`/`IndexedDB`.
   - Exportar/importar configs (JSON).

---

## 5. Detall dels missatges MIDI (GP‑5)

Resum del que cal implementar (detall exacte al manual, pàg. ~40):

| Funció | Tipus | Canal | Valor |
|---|---|---|---|
| Recall preset N | CC | 1 | CC#0, valor N (1–100) |
| Patch + / Patch − | CC | 1 | CC dedicat |
| Bank + / Bank − | CC | 1 | CC dedicat |
| Toggle bloc (drive/mod/delay/rev…) | CC | 1 | 0 = bypass, 127 = on |
| Afinador | CC | 1 | CC dedicat |

> Recomanació: **no enviar res que no estigui documentat** (risc de brick per SysEx). Només CC de la taula oficial.

---

## 6. El looper en detall

Característiques a replicar (estil Quantiloop/Korg):

- **4 pistes sincronitzades** a un BPM.
- Operacions per pista: `Record`, `Play/Stop`, `Overdub`, `Undo`, `Clear`, i `Stop all`.
- **Quantize**: comença/atura el loop al següent límit de compàs (evita desfase).
- **MIDI mapping**: cada operació ↔ un CC/PC del Chocolate Plus.
- Flux d'àudio: `getUserMedia` del GP‑5 → nodes Web Audio → buffer de loop → sortida.

**Consideració de latència**: Web Audio té latència d'entrada no negligible. Per a practicar/live casual és acceptable si demanem `latencyHint: "interactive"` i desactivem `echoCancellation`/`noiseSuppression`. Per a exigència d'estudi, una app nativa (o una interfície d'àudio directa) aniria millor. Cal validar‑ho en el prototip.

---

## 7. Riscos i limitacions

1. **Safari/iOS sense Web MIDI** → el looper funciona a iOS, però sense control per peu. Si iOS és un requisit, cal replantejar (app nativa / Web MIDI Browser de tercers / BLE MIDI fora del navegador).
2. **HTTPS obligatori** → cal servit sobre HTTPS (o `localhost` per desenvolupar). Sense certificat, l'API no apareix.
3. **GP‑5 només canal 1 i CC per presets** → cal respectar‑ho; no usa PC per presets.
4. **Risc de brick per SysEx** → mai enviar SysEx no documentat.
5. **Latència del looper** → cal mesurar‑la al prototip; possible feina extra (lookahead scheduling).
6. **Bluetooth del Chocolate Plus poc fiable** → usar USB.
7. **Noms de dispositius** no estandarditzats → detecció robusta (per subcadena) i selecció manual com a fallback.

---

## 8. Roadmap proposat

- **Fase 0 — Prototip de viabilitat (1–2 dies)**
  - Pàgina que llista dispositius Web MIDI i mostra els missatges entrants del Chocolate Plus.
  - Prova de reenviament d'un CC al GP‑5 (recall de preset) des de la consola.
  - Capturar àudio del GP‑5 amb `getUserMedia` i comprovar latència.

- **Fase 1 — MVP control GP‑5**
  - UI de presets + toggle de blocs + afinador. Persistència del mapeig.

- **Fase 2 — Router Chocolate Plus → GP‑5**
  - Mapeig configurable i escenes.

- **Fase 3 — Looper**
  - 1 pista → 4 pistes, overdub, undo, quantize, metrònom.

- **Fase 4 — Polish / PWA**
  - Offline, export/import de configs, theming.

---

## 9. Stack recomanat

- **Vanilla JS/TS + Vite** (n'hi ha prou; no cal framework pesat).
- **WebMidi.js** o **JZZ** per abstraure el Web MIDI (gestió de dispositius i missatges més còmoda). Alternativa: Web MIDI natiu, que és prou senzill.
- **Tone.js** per al looper (tempo, transport, quantize, scheduling) — tot i que també es pot fer amb Web Audio pur si volem menys dependències.
- **lit / Preact** si vols components UI lleugers.
- Servir amb HTTPS (Vite + mkcert en local; Netlify/Vercel/Cloudflare Pages en producció).

---

## 10. Decisions que cal prendre

1. **iOS és un requisit?** (determina si cal una solució no‑web per al MIDI a iOS).
2. **On passa l'àudio del looper**: capturar l'àudio del GP‑5 per USB (recomanat) o una altra font?
3. **Mapeig del Chocolate Plus**: el configures des de Cube Suite (missatges fixes) o ho volem gestionar tot des de la nostra app?
4. **Complexitat del looper**: 4 pistes + quantize és el punt de partida, o ho volem més simple primer?
