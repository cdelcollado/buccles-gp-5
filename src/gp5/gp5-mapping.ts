// CC mapping table for the Valeton GP-5.
// Source: https://voes.be/midi-cc/valeton_gp5.html (official Control Change list).
//
// The GP-5 listens on MIDI channel 1 (fixed, not configurable).
// Presets: 00-99 (CC#0, value 0-99). It does NOT use Program Change for presets.

/** Fixed MIDI channel of the GP-5. */
export const GP5_CHANNEL = 1;

/** Identifier of the GP-5 effect modules. */
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

/** Definition of a GP-5 effect module. */
export interface GP5Module {
  id: GP5ModuleId;
  cc: number;
  name: string;
  description: string;
}

/** Special Control Changes (not modules). */
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

/** The 10 effect modules, in signal-chain order. */
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
 * On/off semantics of the modules.
 * HYPOTHESIS: 0 = off, 127 = on. To be validated with the hardware
 * (the equivalent SysEx codes use separate ON and OFF messages).
 */
export const MODULE_OFF_VALUE = 0;
export const MODULE_ON_VALUE = 127;

/** Value used for "trigger" controls (patch+/-, bank+/-, ctl). */
export const TRIGGER_VALUE = 127;

/** Preset range: 00-99. */
export const PATCH_RANGE: readonly [number, number] = [0, 99];

/** Patch volume range (CC#7). */
export const PATCH_VOLUME_RANGE: readonly [number, number] = [0, 100];
