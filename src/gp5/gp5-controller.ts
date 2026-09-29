// Controlador d'alt nivell del GP-5: envia CC per canviar presets, mòduls, etc.
//
// Els CC del GP-5 són unidireccionals (no es pot llegir l'estat del dispositiu),
// així que aquesta classe en manté un estat local i l'emet als subscriptors.

import type { MIDIOutput } from '../midi/midi.types';
import {
  GP5_CHANNEL,
  GP5_CC,
  GP5_MODULES,
  MODULE_OFF_VALUE,
  MODULE_ON_VALUE,
  PATCH_RANGE,
  PATCH_VOLUME_RANGE,
  TRIGGER_VALUE,
  type GP5ModuleId,
} from './gp5-mapping';

export type ModuleStateChangeCallback = (id: GP5ModuleId, on: boolean) => void;
export type PresetChangeCallback = (preset: number) => void;
export type TunerChangeCallback = (on: boolean) => void;

/** Estat complet del controlador (per a persistència). */
export interface GP5State {
  currentPreset: number | null;
  moduleState: Record<GP5ModuleId, boolean>;
  tunerOn: boolean;
}

/** Limita un valor dins d'un rang tancat [min, max]. */
function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Classe que encapsula l'enviament de CC al GP-5.
 */
export class GP5Controller {
  private output: MIDIOutput | null = null;

  private currentPreset: number | null = null;
  private moduleState = new Map<GP5ModuleId, boolean>();
  private tunerOn = false;

  private moduleListeners = new Set<ModuleStateChangeCallback>();
  private presetListeners = new Set<PresetChangeCallback>();
  private tunerListeners = new Set<TunerChangeCallback>();

  // --- Selecció del dispositiu ---

  /** Assigna la sortida MIDI del GP-5 (o null si es desconnecta). */
  setOutput(output: MIDIOutput | null): void {
    this.output = output;
  }

  get isConnected(): boolean {
    return this.output !== null;
  }

  // --- Subscripció ---

  onModuleStateChange(cb: ModuleStateChangeCallback): () => void {
    this.moduleListeners.add(cb);
    return () => this.moduleListeners.delete(cb);
  }

  onPresetChange(cb: PresetChangeCallback): () => void {
    this.presetListeners.add(cb);
    return () => this.presetListeners.delete(cb);
  }

  onTunerChange(cb: TunerChangeCallback): () => void {
    this.tunerListeners.add(cb);
    return () => this.tunerListeners.delete(cb);
  }

  // --- Estat ---

  getState(): GP5State {
    return {
      currentPreset: this.currentPreset,
      moduleState: Object.fromEntries(this.moduleState) as Record<GP5ModuleId, boolean>,
      tunerOn: this.tunerOn,
    };
  }

  getModuleState(id: GP5ModuleId): boolean {
    return this.moduleState.get(id) ?? false;
  }

  getCurrentPreset(): number | null {
    return this.currentPreset;
  }

  isTunerOn(): boolean {
    return this.tunerOn;
  }

  /**
   * Restaura l'estat desat sense enviar cap CC (per no "spamejar" el dispositiu
   * en arrencar). Només actualitza l'estat local i n'emet el canvi a la UI.
   */
  restoreState(state: Partial<GP5State>): void {
    if (state.currentPreset != null) {
      this.currentPreset = state.currentPreset;
      this.emitPresetChange(state.currentPreset);
    }
    if (state.moduleState) {
      for (const [id, on] of Object.entries(state.moduleState)) {
        this.moduleState.set(id as GP5ModuleId, on);
        this.emitModuleChange(id as GP5ModuleId, on);
      }
    }
    if (state.tunerOn != null) {
      this.tunerOn = state.tunerOn;
      this.emitTunerChange(state.tunerOn);
    }
  }

  // --- Accions ---

  /** Canvia al preset indicat (0-99). */
  recallPreset(preset: number): void {
    const p = clamp(preset, PATCH_RANGE);
    this.sendCC(GP5_CC.patchRecall, p);
    this.currentPreset = p;
    this.emitPresetChange(p);
  }

  /** Ajusta el volum de patch (0-100). */
  setPatchVolume(volume: number): void {
    this.sendCC(GP5_CC.patchVolume, clamp(volume, PATCH_VOLUME_RANGE));
  }

  /** Activa/desactiva un mòdul d'efecte. */
  setModule(id: GP5ModuleId, on: boolean): void {
    this.sendCC(this.moduleCC(id), on ? MODULE_ON_VALUE : MODULE_OFF_VALUE);
    this.moduleState.set(id, on);
    this.emitModuleChange(id, on);
  }

  /** Commuta l'estat d'un mòdul d'efecte. */
  toggleModule(id: GP5ModuleId): void {
    this.setModule(id, !this.getModuleState(id));
  }

  patchUp(): void {
    this.sendCC(GP5_CC.patchUp, TRIGGER_VALUE);
  }

  patchDown(): void {
    this.sendCC(GP5_CC.patchDown, TRIGGER_VALUE);
  }

  bankUp(): void {
    this.sendCC(GP5_CC.bankUp, TRIGGER_VALUE);
  }

  bankDown(): void {
    this.sendCC(GP5_CC.bankDown, TRIGGER_VALUE);
  }

  /** Activa/desactiva l'afinador. */
  setTuner(on: boolean): void {
    this.sendCC(GP5_CC.tuner, on ? MODULE_ON_VALUE : MODULE_OFF_VALUE);
    this.tunerOn = on;
    this.emitTunerChange(on);
  }

  /** Commuta l'afinador. */
  toggleTuner(): void {
    this.setTuner(!this.tunerOn);
  }

  // --- Helpers ---

  private moduleCC(id: GP5ModuleId): number {
    const mod = GP5_MODULES.find((m) => m.id === id);
    if (!mod) throw new Error(`Mòdul desconegut: ${id}`);
    return mod.cc;
  }

  private sendCC(cc: number, value: number): void {
    if (!this.output) {
      console.warn('[GP5] No hi ha cap sortida GP-5 seleccionada.');
      return;
    }
    // Status de Control Change al canal 1: 0xB0 | (canal - 1).
    const status = 0xb0 | (GP5_CHANNEL - 1);
    this.output.send([status, cc, value]);
  }

  private emitPresetChange(preset: number): void {
    for (const cb of this.presetListeners) cb(preset);
  }

  private emitModuleChange(id: GP5ModuleId, on: boolean): void {
    for (const cb of this.moduleListeners) cb(id, on);
  }

  private emitTunerChange(on: boolean): void {
    for (const cb of this.tunerListeners) cb(on);
  }
}
