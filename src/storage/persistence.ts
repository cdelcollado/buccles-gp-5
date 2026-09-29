// Persistència a localStorage. Fase 1: estat del GP-5 (preset + mòduls + afinador).
// (La Fase 4 generalitzarà això amb export/import de tota la configuració.)

import type { GP5State } from '../gp5/gp5-controller';

const STORAGE_KEY = 'buccles-gp5:gp5-state';

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
