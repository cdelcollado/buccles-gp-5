# Fase 0 — Bootstrap i prototip de viabilitat

**Estat**: ✅ Completat

## Objectiu

Tenir el projecte compilant i servint, i verificar que les APIs Web MIDI i Web Audio funcionen amb el hardware (GP-5 i Chocolate Plus).

## Què s'ha fet

### Dependències
- `tone@^15.1.22` afegida a `dependencies`.

### Estructura creada
```
src/
├── index.html              # UI base: connexió, dispositius, monitor MIDI, prova d'àudio
├── main.ts                 # Entry point: inicialitza MIDI + àudio + UI
├── style.css               # Dark theme, panels, indicadors d'estat, monitor log
├── midi/
│   ├── midi.types.ts       # Tipus per a la Web MIDI API (no al lib estàndard de TS)
│   ├── midi-manager.ts     # requestMIDIAccess, llista dispositius, detecció GP-5/Chocolate, statechange
│   └── midi-monitor.ts     # Parse i visualització de missatges MIDI (Note/CC/PC/SysEx)
├── audio/
│   └── audio-manager.ts    # getUserMedia del GP-5, monitoratge loopback, mesura de latència
└── ui/
    └── components.ts       # Helpers UI + indicadors d'estat
```

### Funcionalitats implementades
- Detecció automàtica del **Chocolate Plus** (entrada) i **GP-5** (sortida) per subcadena, amb indicadors d'estat i fallback manual.
- **Monitor MIDI** en temps real per verificar que el Chocolate Plus envia missatges.
- **Prova d'àudio**: selecció de l'entrada del GP-5, monitoratge loopback i mesura de latència base.
- Gestió de `statechange` (connectar/desconnectar en calent).
- `npm run build` (tsc + vite) passa sense errors.

### Configuració de Vite
`root: 'src'` perquè l'`index.html` viu a `src/`, amb `build.outDir` redirigit a `dist/` (arrel del projecte).

## Com verificar-ho amb el hardware (tasca 0.9)

1. Obrir **http://localhost:5173/** a Chrome/Edge.
2. Connectar el **GP-5** per USB → indicador "Valeton GP-5: ✅".
3. Connectar el **Chocolate Plus** per USB → indicador "Chocolate Plus: ✅".
4. Prémer botons del Chocolate Plus → missatges al **Monitor MIDI**.
5. A **Prova d'àudio**, seleccionar el GP-5 com a entrada i prémer "Monitoritza l'entrada" → sentir la guitarra pels altaveus amb la latència mostrada.

## Notes i riscos detectats

- La detecció de dispositius es fa per **subcadena** sobre el nom del port MIDI. Cal validar els noms reals (Windows/Linux/macOS) i ajustar els patrons si cal.
- La **latència** del looper s'ha de validar amb el hardware real. `latencyHint: "interactive"` i processament desactivat (`echoCancellation`/`noiseSuppression`/`autoGainControl` = false) estan aplicats.
- No s'envia cap **SysEx** (risc de brick del GP-5). Només CC documentats a la Fase 1.

## Següent pas

**Fase 1 — MVP controlador GP-5**: presets, blocs d'efecte i afinador. Requereix la **taula de CC del manual del GP-5** (pàg. ~40) per omplir `gp5-mapping.ts`.
