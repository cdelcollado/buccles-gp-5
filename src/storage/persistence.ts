// Persistència a localStorage. Fase 1: estat del GP-5 (preset + mòduls + afinador).
// (La Fase 4 generalitzarà això amb export/import de tota la configuració.)

import type { GP5State } from '../gp5/gp5-controller';
import type { LooperAction, MIDITrigger } from '../looper/looper-mapping';

const STORAGE_KEY = 'buccles-gp5:gp5-state';
const LOOPER_STORAGE_KEY = 'buccles-gp5:looper-state';

/** Estat persistent del looper (BPM + mapeig MIDI). */
export interface LooperState {
  bpm: number;
  bindings: Partial<Record<LooperAction, MIDITrigger | null>>;
}

/** Carrega l'estat desat del GP-5 (o {} si no n'hi ha). */
export function loadGP5State(): Partial<GP5State> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<GP5State>;
  } catch (err) {
    console.warn('[persistence] No s\'ha pogut llegir l\'estat desat:', err);
    return {};
  }
}

/** Desa l'estat actual del GP-5. */
export function saveGP5State(state: GP5State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[persistence] No s\'ha pogut desar l\'estat:', err);
  }
}

/** Carrega l'estat desat del looper (o {} si no n'hi ha). */
export function loadLooperState(): Partial<LooperState> {
  try {
    const raw = localStorage.getItem(LOOPER_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<LooperState>;
  } catch (err) {
    console.warn('[persistence] No s\'ha pogut llegir l\'estat del looper:', err);
    return {};
  }
}

/** Desa l'estat actual del looper. */
export function saveLooperState(state: LooperState): void {
  try {
    localStorage.setItem(LOOPER_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[persistence] No s\'ha pogut desar l\'estat del looper:', err);
  }
}
