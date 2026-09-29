// Taula de mapeig CC del Valeton GP-5.
// Font: https://voes.be/midi-cc/valeton_gp5.html (llista oficial de Control Change).
//
// El GP-5 escolta al canal MIDI 1 (fix, no configurable).
// Presets: 00-99 (CC#0, valor 0-99). NO usa Program Change per presets.

/** Canal MIDI fix del GP-5. */
export const GP5_CHANNEL = 1;

/** Identificador dels mòduls d'efecte del GP-5. */
export type GP5ModuleId =
  | 'NR'
  | 'PRE'
  | 'DST'
  | 'NS'
  | 'AMP'
  | 'CAB'
  | 'EQ'
  | 'MOD'
  | 'DLY'
  | 'RVB';

/** Definició d'un mòdul d'efecte del GP-5. */
export interface GP5Module {
  id: GP5ModuleId;
  cc: number;
  name: string;
  description: string;
}

/** Control Changes especials (no mòduls). */
export const GP5_CC = {
  patchRecall: 0,
  patchVolume: 7,
  bankDown: 22,
  bankUp: 23,
  patchDown: 24,
  patchUp: 25,
  patchDownSong: 29,
  patchUpSong: 30,
  tuner: 58,
  ctl: 69,
} as const;

/** Els 10 mòduls d'efecte, en ordre de la cadena de senyal. */
export const GP5_MODULES: readonly GP5Module[] = [
  { id: 'NR', cc: 48, name: 'NR', description: 'Noise Reduction' },
  { id: 'PRE', cc: 49, name: 'PRE', description: 'Preamp' },
  { id: 'DST', cc: 50, name: 'DST', description: 'Distortion' },
  { id: 'NS', cc: 51, name: 'N→S', description: 'Noise Suppressor' },
  { id: 'AMP', cc: 52, name: 'AMP', description: 'Amplifier' },
  { id: 'CAB', cc: 53, name: 'CAB', description: 'Cabinet' },
  { id: 'EQ', cc: 54, name: 'EQ', description: 'Equalizer' },
  { id: 'MOD', cc: 55, name: 'MOD', description: 'Modulation' },
  { id: 'DLY', cc: 56, name: 'DLY', description: 'Delay' },
  { id: 'RVB', cc: 57, name: 'RVB', description: 'Reverb' },
] as const;

/**
 * Semàntica on/off dels mòduls.
 * HIPÒTESI: 0 = off, 127 = on. Pendent de validar amb el maquinari
 * (els codis SysEx equivalents tenen ON i OFF com a missatges separats).
 */
export const MODULE_OFF_VALUE = 0;
export const MODULE_ON_VALUE = 127;

/** Valor usat per als controls de tipus "trigger" (patch+/-, bank+/-, ctl). */
export const TRIGGER_VALUE = 127;

/** Rang de presets: 00-99. */
export const PATCH_RANGE: readonly [number, number] = [0, 99];

/** Rang del volum de patch (CC#7). */
export const PATCH_VOLUME_RANGE: readonly [number, number] = [0, 100];
