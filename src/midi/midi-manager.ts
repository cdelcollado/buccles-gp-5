// Web MIDI management: access, device list and detection of the GP-5 and the Chocolate Plus.

import { t } from '../i18n';
import type {
  MIDIAccess,
  MIDIInput,
  MIDIOutput,
  MIDIConnectionEvent,
  MIDIMessageEvent,
} from './midi.types';

/** Names that identify the GP-5 (substring match, case-insensitive). */
const GP5_PATTERNS = ['gp-5', 'gp5', 'valeton'];

/** Names that identify the Chocolate Plus / M-VAVE (substring match). */
const CHOCOLATE_PATTERNS = ['chocolate', 'm-vave', 'mvave'];

export interface DeviceSelection {
  /** MIDI input detected as the Chocolate Plus. */
  chocolateInput: MIDIInput | null;
  /** MIDI output detected as the GP-5. */
  gp5Output: MIDIOutput | null;
}

export type ConnectionChangeCallback = (selection: DeviceSelection) => void;

/**
 * Class that wraps Web MIDI access and device detection.
 */
export class MIDIManager {
  private access: MIDIAccess | null = null;

  /** Callbacks registered for connection changes. */
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
   * Requests MIDI access and detects the known devices.
   * Throws an Error if the browser does not support it or the user denies access.
   */
  async enable(): Promise<void> {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      throw new Error(t('error.midiUnsupported'));
    }

    this.access = await navigator.requestMIDIAccess({ sysex: false });

    this.access.onstatechange = (event: MIDIConnectionEvent) => {
      this.handleStateChange(event);
    };

    this.detectDevices();
  }

  /** Rescans the devices and updates the selection. */
  detectDevices(): void {
    if (!this.access) return;

    const chocolateInput = this.findInput(CHOCOLATE_PATTERNS);
    const gp5Output = this.findOutput(GP5_PATTERNS);

    this.current = { chocolateInput, gp5Output };
    this.notifyListeners();
  }

  /** Registers a callback that runs when the device selection changes. */
  onChange(callback: ConnectionChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /** Subscribes a handler to the MIDI messages of a given input. */
  listen(input: MIDIInput, handler: (event: MIDIMessageEvent) => void): void {
    input.onmidimessage = handler;
  }

  /** Sends MIDI bytes to a given output. */
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
    // Rescan: a device was connected or disconnected.
    this.detectDevices();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.selection);
    }
  }
}
