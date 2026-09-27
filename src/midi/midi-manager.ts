// Gestió del Web MIDI: accés, llista de dispositius i detecció del GP-5 i el Chocolate Plus.

import type {
  MIDIAccess,
  MIDIInput,
  MIDIOutput,
  MIDIConnectionEvent,
  MIDIMessageEvent,
} from './midi.types';

/** Noms que identifiquen el GP-5 (per subcadena, sense distingir majúscules). */
const GP5_PATTERNS = ['gp-5', 'gp5', 'valeton'];

/** Noms que identifiquen el Chocolate Plus / M-VAVE (per subcadena). */
const CHOCOLATE_PATTERNS = ['chocolate', 'm-vave', 'mvave'];

export interface DeviceSelection {
  /** Entrada MIDI detectada com a Chocolate Plus. */
  chocolateInput: MIDIInput | null;
  /** Sortida MIDI detectada com a GP-5. */
  gp5Output: MIDIOutput | null;
}

export type ConnectionChangeCallback = (selection: DeviceSelection) => void;

/**
 * Classe que encapsula l'accés al Web MIDI i la detecció de dispositius.
 */
export class MIDIManager {
  private access: MIDIAccess | null = null;

  /** Callbacks registrats per a canvis de connexió. */
  private listeners = new Set<ConnectionChangeCallback>();

  private current: DeviceSelection = {
    chocolateInput: null,
    gp5Output: null,
  };

  get isEnabled(): boolean {
    return this.access !== null;
  }

  get sysexEnabled(): boolean {
    return this.access?.sysexEnabled ?? false;
  }

  get inputs(): MIDIInput[] {
    return this.access ? [...this.access.inputs.values()] : [];
  }

  get outputs(): MIDIOutput[] {
    return this.access ? [...this.access.outputs.values()] : [];
  }

  get selection(): DeviceSelection {
    return { ...this.current };
  }

  /**
   * Demana accés al MIDI i detecta els dispositius coneguts.
   * Llença un Error si el navegador no ho suporta o l'usuari ho denega.
   */
  async enable(): Promise<void> {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      throw new Error('Aquest navegador no suporta Web MIDI. Fes servir Chrome o Edge.');
    }

    this.access = await navigator.requestMIDIAccess({ sysex: false });

    this.access.onstatechange = (event: MIDIConnectionEvent) => {
      this.handleStateChange(event);
    };

    this.detectDevices();
  }

  /** Torna a escanejar els dispositius i actualitza la selecció. */
  detectDevices(): void {
    if (!this.access) return;

    const chocolateInput = this.findInput(CHOCOLATE_PATTERNS);
    const gp5Output = this.findOutput(GP5_PATTERNS);

    this.current = { chocolateInput, gp5Output };
    this.notifyListeners();
  }

  /** Registra un callback que s'executa quan canvia la selecció de dispositius. */
  onChange(callback: ConnectionChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Subscriu un handler als missatges MIDI d'un input concret. */
  listen(input: MIDIInput, handler: (event: MIDIMessageEvent) => void): void {
    input.onmidimessage = handler;
  }

  /** Envia bytes MIDI a una sortida concreta. */
  send(output: MIDIOutput, data: number[] | Uint8Array): void {
    output.send(data);
  }

  private findInput(patterns: string[]): MIDIInput | null {
    for (const input of this.inputs) {
      if (patterns.some((p) => input.name.toLowerCase().includes(p))) {
        return input;
      }
    }
    return null;
  }

  private findOutput(patterns: string[]): MIDIOutput | null {
    for (const output of this.outputs) {
      if (patterns.some((p) => output.name.toLowerCase().includes(p))) {
        return output;
      }
    }
    return null;
  }

  private handleStateChange(event: MIDIConnectionEvent): void {
    const port = event.port;
    console.log(`[MIDI] statechange: ${port.name} (${port.type}) → ${port.state}`);
    // Re-escaneja: un dispositiu s'ha connectat o desconnectat.
    this.detectDevices();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.selection);
    }
  }
}
