// Persistence in localStorage. Phase 1: GP-5 state (preset + modules + tuner).
// (Phase 4 will generalise this with export/import of the whole configuration.)

import type { GP5State } from '../gp5/gp5-controller';
import type { LooperAction, MIDITrigger } from '../looper/looper-mapping';

const STORAGE_KEY = 'buccles-gp5:gp5-state';
const LOOPER_STORAGE_KEY = 'buccles-gp5:looper-state';

/** Persistent looper state (BPM + MIDI mapping). */
export interface LooperState {
  bpm: number;
  bindings: Partial<Record<LooperAction, MIDITrigger | null>>;
}

/** Loads the saved GP-5 state (or {} if there is none). */
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

/** Saves the current GP-5 state. */
export function saveGP5State(state: GP5State): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[persistence] No s\'ha pogut desar l\'estat:', err);
  }
}

/** Loads the saved looper state (or {} if there is none). */
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

/** Saves the current looper state. */
export function saveLooperState(state: LooperState): void {
  try {
    localStorage.setItem(LOOPER_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[persistence] No s\'ha pogut desar l\'estat del looper:', err);
  }
}
