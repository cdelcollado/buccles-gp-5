# Fase 1 — MVP controlador GP-5

**Estat**: ✅ Implementat (pendent de validació amb hardware)

## Objectiu

Controlar el GP-5 des de la UI: presets, mòduls d'efecte, afinador i volum, tot per USB amb CC.

## Què s'ha fet

### Fitxers nous
```
src/gp5/
├── gp5-mapping.ts       # Taula CC del GP-5 (font: voes.be) + constants de valors
├── gp5-controller.ts    # GP5Controller: envia CC, manté estat local, emet canvis
└── gp5-ui.ts            # GP5UI: graella 10×10, cadena de 10 mòduls, afinador, volum
src/storage/
└── persistence.ts       # loadGP5State / saveGP5State a localStorage
```

### Funcionalitats implementades
- **Graella de presets 00–99** (CC#0, valor 0–99). Preset actiu ressaltat.
- **Cadena de 10 mòduls** (NR, PRE, DST, N→S, AMP, CAB, EQ, MOD, DLY, RVB) amb toggle on/off (CC#48–57).
- **Navegació** patch± / bank± (CC#22–25).
- **Afinador** (CC#58) i **volum de patch** (CC#7, 0–100).
- **Persistència** de preset, mòduls i afinador a `localStorage`, restaurada a l'inici sense reenviar CC.
- Controls desactivats quan el GP-5 no està detectat (reactiu a `statechange`).

### Semàntica on/off (hipòtesi)
- `0 = off`, `127 = on` per a mòduls i afinador (`MODULE_OFF_VALUE` / `MODULE_ON_VALUE`).
- Controls "trigger" (patch±/bank±/ctl) envien `127` (`TRIGGER_VALUE`).

## Com validar-ho amb el hardware (pendent)

1. Obrir **http://localhost:5173/** a Chrome/Edge i connectar el GP-5 per USB.
2. Clicar un preset de la graella → el GP-5 ha de canviar de patch.
3. Clicar un mòdul (p. ex. AMP) → ha d'encendre/apagar l'efecte. **Confirmar que `127` = on i `0` = off** (o si fa toggle amb qualsevol valor).
4. Afinador → ha d'entrar/sortir de l'afinador.
5. Volum (CC#7) → ha de canviar el volum del patch.

## Notes i riscos

- Els CC del GP-5 són **unidireccionals**: l'estat local de l'app és una suposició, no una lectura del dispositiu. Si el GP-5 canvia d'estat per altres mitjans, la UI pot quedar desincronitzada.
- La **navegació patch±** no actualitza el preset actiu a la graella (no sabem el resultat). Només la graella manté el preset ressaltat fiable.
- Si la semàntica on/off no fos `0/127`, s'ajusta a `gp5-mapping.ts` (constants úniques).

## Següent pas

**Fase 2 — Router MIDI**: Chocolate Plus → GP-5 amb **MIDI Learn**, mapeig configurable i escenes.
