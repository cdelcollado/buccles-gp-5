// Monitor MIDI: mostra en pantalla els missatges MIDI entrants per a debug.
// Utilitza el protócol comú de Web MIDI (0x8, 0x9, 0xA, 0xB, 0xC, 0xE, 0xF).

import type { ParsedMIDIMessage } from './midi.types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface MIDIMonitorOptions {
  /** Element <pre> on escriure el log. */
  logElement: HTMLElement;
  /** Nombre màxim de línies a mantenir. */
  maxLines?: number;
}

/**
 * Converteix els bytes d'un missatge MIDI en un objecte llegible.
 */
export function parseMIDIMessage(data: Uint8Array): ParsedMIDIMessage {
  const status = data[0] ?? 0;
  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const data1 = data[1] ?? 0;
  const data2 = data.length > 2 ? data[2] : undefined;

  return { data, status, command, channel, data1, data2 };
}

/** Retorna el nom d'una nota MIDI (ex. "C#4"). */
export function noteName(note: number): string {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

/**
 * Retorna una descripció llegible d'un missatge MIDI per al log.
 */
export function describeMessage(msg: ParsedMIDIMessage): { text: string; cssClass: string } {
  const { command, channel, data1, data2 } = msg;

  switch (command) {
    case 0x90: // Note On
      if ((data2 ?? 0) === 0) {
        return { text: `Note Off  ${noteName(data1)} (vel 0)  ch${channel}`, cssClass: 'msg-note' };
      }
      return { text: `Note On   ${noteName(data1)}  vel ${data2}  ch${channel}`, cssClass: 'msg-note' };

    case 0x80: // Note Off
      return { text: `Note Off  ${noteName(data1)}  vel ${data2 ?? 0}  ch${channel}`, cssClass: 'msg-note' };

    case 0xb0: // Control Change
      return { text: `CC        #${data1} = ${data2}  ch${channel}`, cssClass: 'msg-cc' };

    case 0xc0: // Program Change
      return { text: `PC        #${data1}  ch${channel}`, cssClass: 'msg-pc' };

    case 0xa0: // Poly Aftertouch
      return { text: `Aftertouch ${noteName(data1)} = ${data2}  ch${channel}`, cssClass: 'msg-other' };

    case 0xd0: // Channel Pressure
      return { text: `Pressure  ${data1}  ch${channel}`, cssClass: 'msg-other' };

    case 0xe0: // Pitch Bend
      // Combina els dos bytes de 7 bits en un valor de 14 bits (centrat a 8192).
      const bend = ((data2 ?? 0) << 7) | data1;
      return { text: `PitchBend ${bend}  ch${channel}`, cssClass: 'msg-other' };

    case 0xf0: // System
      return { text: `SysEx/System (${msg.data.length} bytes)`, cssClass: 'msg-sysex' };

    default:
      return { text: `Desconegut ${msg.data.join(' ')}`, cssClass: 'msg-other' };
  }
}

/**
 * Component que escriu els missatges MIDI en un element de la UI.
 */
export class MIDIMonitor {
  private element: HTMLElement;
  private maxLines: number;
  private lines: string[] = [];

  constructor(options: MIDIMonitorOptions) {
    this.element = options.logElement;
    this.maxLines = options.maxLines ?? 200;
  }

  /** Afegeix un missatge al log. */
  log(data: Uint8Array): void {
    const msg = parseMIDIMessage(data);
    const { text, cssClass } = describeMessage(msg);
    const hex = [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const timestamp = new Date().toLocaleTimeString('ca-ES', { hour12: false });

    this.lines.push(`<span class="msg-time">${timestamp}</span>  <span class="${cssClass}">${text}</span>  <span class="msg-other">[${hex}]</span>`);

    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }

    this.render();
  }

  /** Buida el log. */
  clear(): void {
    this.lines = [];
    this.render();
  }

  private render(): void {
    this.element.innerHTML = this.lines.join('\n');
    this.element.scrollTop = this.element.scrollHeight;
  }
}
