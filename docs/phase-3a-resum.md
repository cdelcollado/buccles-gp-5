# Resum — Fase 3a (Looper MVP, 2 pistes)

Fet ✅. La **Fase 3a (Looper MVP, 2 pistes)** està implementada, compila net i està pujada a `main` (commit `531b3e6`).

## Què s'ha construït

**Mòdul `src/looper/`** (5 fitxers nous):

- `looper-clock.ts` — BPM + graella de compassos via `Tone.Transport`; programa callbacks al límit del següent compàs amb el temps d'àudio exacte.
- `looper-track.ts` — una pista: àudio (mono), capes, pila d'undo i reproducció en bucle.
- `looper-mapping.ts` — MIDI Learn + mapeig per defecte dels 4 botons del pedal.
- `looper-engine.ts` — orquestra les 2 pistes, el capturador `ScriptProcessorNode`, la longitud/fase mestra i les accions.
- `looper-ui.ts` — transport, BPM, targetes de pista i MIDI Learn.

**Modificats**: `audio-manager.ts` (comparteix el flux d'entrada), `persistence.ts` (BPM + bindings), `index.html` (secció Looper), `main.ts` (routing MIDI + persistència), `style.css`.

## Com funciona el model de temps

- El **primer loop defineix la longitud mestra** (nombre enter de compassos) i la fase.
- Tots els inicis/aturades **es quantitzen al límit de compàs** (sense deriva), amb captura mostrejada pel `ScriptProcessorNode`.
- `record` al primer loop = tap per començar / tap per tancar. Després (pista buida o overdub) = **una volta automàtica** alineada al master.
- El **BPM es bloqueja** un cop gravat (esborra les pistes per canviar-lo).

## Mapeig per defecte del Chocolate Plus (HIPÒTESI)

| Botó | Acció | Missatge assumit |
|---|---|---|
| 1 | Rec / Overdub | PC#0 ch1 |
| 2 | Play / Stop totes | PC#1 ch1 |
| 3 | Undo | PC#2 ch1 |
| 4 | Canvia pista A↔B | PC#3 ch1 |

`clear` no té botó per defecte (només 4 botons): es fa amb **MIDI Learn** o des de la UI. Si el pedal envia CC/Note en lloc de PC, usa els botons "aprendre" de la secció Looper.

## Com provar-ho

```bash
cd ~/Projects/buccles-gp-5 && npm run dev
```

1. Obre **http://localhost:5173/** a Chrome/Edge.
2. A «Prova d'àudio» selecciona el GP‑5 com a entrada.
3. A «Looper», prem **«Activa el looper»** (gest d'usuari que obre l'entrada + arrenca Tone).
4. Prem el botó 1 del pedal (o «Rec/Overdub» de la Pista A) → grava; torna a prémer per tancar el loop.
5. Pista B, overdub, undo, clear i «Play/Stop totes» des de la UI o el pedal.

## ⚠️ Pendent de validar amb el teu hardware

1. **Latència real** d'entrada GP‑5 → navegador (criteri per decidir si cal *lookahead scheduling*).
2. **Missatges reals del Chocolate Plus** (PC vs CC) → reconfigura el mapeig amb MIDI Learn si cal.
3. **Quantize feel** (que el loop tanqui just al compàs).

## Següents passes

- **Fase 3b**: metrònom + count-in, tap tempo, time-stretching (`GrainPlayer`).
- **Fase 3c**: 4 pistes, waveform, volum/mute/solo per pista.
- **Híbrid (Fase 2)**: afegir l'escena "GP‑5" al mateix pedal (arquitectura d'escenes ja prevista).

Vols que seguim amb la **Fase 3b (metrònom + count-in)**, o primer proves la 3a amb el pedal i m'expliques què falla?
