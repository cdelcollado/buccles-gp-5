// Tipus per a la Web MIDI API, que no estan al lib estàndard de TypeScript.

export type MIDIPortType = 'input' | 'output';
export type MIDIPortConnectionState = 'open' | 'closed' | 'pending';
export type MIDIPortDeviceState = 'connected' | 'disconnected';

/** Missatge MIDI entrant desglossat en els seus components. */
export interface ParsedMIDIMessage {
  /** Bytes originals del missatge. */
  data: Uint8Array;
  /** Byte d'estat (conté el tipus de missatge i el canal). */
  status: number;
  /** Tipus de missatge (0x8 noteoff, 0x9 noteon, 0xB CC, 0xC PC, …). */
  command: number;
  /** Canal MIDI (1-16). */
  channel: number;
  /** Data byte 1 (nota, número de CC, número de PC…). */
  data1: number;
  /** Data byte 2 (velocitat, valor de CC…). Pot ser undefined per PC. */
  data2?: number;
}

declare global {
  interface Navigator {
    requestMIDIAccess(options?: { sysex?: boolean; software?: boolean }): Promise<MIDIAccess>;
  }
}

export interface MIDIAccess extends EventTarget {
  inputs: MIDIInputMap;
  outputs: MIDIOutputMap;
  sysexEnabled: boolean;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
}

export interface MIDIInputMap extends ReadonlyMap<string, MIDIInput> {}
export interface MIDIOutputMap extends ReadonlyMap<string, MIDIOutput> {}

export interface MIDIPort extends EventTarget {
  id: string;
  manufacturer: string;
  name: string;
  type: MIDIPortType;
  version: string;
  state: MIDIPortDeviceState;
  connection: MIDIPortConnectionState;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
  open(): Promise<MIDIPort>;
  close(): Promise<MIDIPort>;
}

export interface MIDIInput extends MIDIPort {
  type: 'input';
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
}

export interface MIDIOutput extends MIDIPort {
  type: 'output';
  send(data: number[] | Uint8Array, timestamp?: number): void;
  clear(): void;
}

export interface MIDIConnectionEvent extends Event {
  port: MIDIPort;
}

export interface MIDIMessageEvent extends Event {
  data: Uint8Array;
  receivedTime: number;
}
