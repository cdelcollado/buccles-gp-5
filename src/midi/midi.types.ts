// Types for the Web MIDI API, which are not in TypeScript's standard lib.

export type MIDIPortType = 'input' | 'output';
export type MIDIPortConnectionState = 'open' | 'closed' | 'pending';
export type MIDIPortDeviceState = 'connected' | 'disconnected';

/** Incoming MIDI message split into its components. */
export interface ParsedMIDIMessage {
  /** Original message bytes. */
  data: Uint8Array;
  /** Status byte (contains the message type and the channel). */
  status: number;
  /** Message type (0x8 note off, 0x9 note on, 0xB CC, 0xC PC, …). */
  command: number;
  /** MIDI channel (1-16). */
  channel: number;
  /** Data byte 1 (note, CC number, PC number…). */
  data1: number;
  /** Data byte 2 (velocity, CC value…). Undefined for PC. */
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
