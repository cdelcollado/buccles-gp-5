// High-level GP-5 controller: sends CCs to change presets, modules, etc.
//
// GP-5 CCs are one-way (the device state cannot be read back),
// so this class keeps a local state and emits it to subscribers.

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

/** Full controller state (for persistence). */
export interface GP5State {
  currentPreset: number | null;
  moduleState: Record<GP5ModuleId, boolean>;
  tunerOn: boolean;
}

/** Clamps a value within the closed range [min, max]. */
function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Class that encapsulates sending CCs to the GP-5.
 */
export class GP5Controller {
  private output: MIDIOutput | null = null;

  private currentPreset: number | null = null;
  private moduleState = new Map<GP5ModuleId, boolean>();
  private tunerOn = false;

  private moduleListeners = new Set<ModuleStateChangeCallback>();
  private presetListeners = new Set<PresetChangeCallback>();
  private tunerListeners = new Set<TunerChangeCallback>();

  // --- Device selection ---

  /** Sets the GP-5 MIDI output (or null when it is disconnected). */
  setOutput(output: MIDIOutput | null): void {
    this.output = output;
  }

  get isConnected(): boolean {
    return this.output !== null;
  }

  // --- Subscriptions ---

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

  // --- State ---

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
   * Restores the saved state without sending any CC (so the device is not flooded
   * on start-up). Only updates the local state and emits the change to the UI.
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

  // --- Actions ---

  /** Switches to the given preset (0-99). */
  recallPreset(preset: number): void {
    const p = clamp(preset, PATCH_RANGE);
    this.sendCC(GP5_CC.patchRecall, p);
    this.currentPreset = p;
    this.emitPresetChange(p);
  }

  /** Sets the patch volume (0-100). */
  setPatchVolume(volume: number): void {
    this.sendCC(GP5_CC.patchVolume, clamp(volume, PATCH_VOLUME_RANGE));
  }

  /** Turns an effect module on/off. */
  setModule(id: GP5ModuleId, on: boolean): void {
    this.sendCC(this.moduleCC(id), on ? MODULE_ON_VALUE : MODULE_OFF_VALUE);
    this.moduleState.set(id, on);
    this.emitModuleChange(id, on);
  }

  /** Toggles the state of an effect module. */
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

  /** Turns the tuner on/off. */
  setTuner(on: boolean): void {
    this.sendCC(GP5_CC.tuner, on ? MODULE_ON_VALUE : MODULE_OFF_VALUE);
    this.tunerOn = on;
    this.emitTunerChange(on);
  }

  /** Toggles the tuner. */
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
    // Control Change status on channel 1: 0xB0 | (channel - 1).
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
