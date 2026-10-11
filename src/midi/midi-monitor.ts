// MIDI monitor: shows incoming MIDI messages on screen for debugging.
// Uses the standard Web MIDI message set (0x8, 0x9, 0xA, 0xB, 0xC, 0xE, 0xF).

import type { ParsedMIDIMessage } from './midi.types';
import { intlLocale, t } from '../i18n';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface MIDIMonitorOptions {
  /** <pre> element to write the log to. */
  logElement: HTMLElement;
  /** Maximum number of lines to keep. */
  maxLines?: number;
}

/**
 * Converts the bytes of a MIDI message into a readable object.
 */
export function parseMIDIMessage(data: Uint8Array): ParsedMIDIMessage {
  const status = data[0] ?? 0;
  const command = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const data1 = data[1] ?? 0;
  const data2 = data.length > 2 ? data[2] : undefined;

  return { data, status, command, channel, data1, data2 };
}

/** Returns the name of a MIDI note (e.g. "C#4"). */
export function noteName(note: number): string {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

/**
 * Returns a human-readable description of a MIDI message for the log.
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
      // Combines the two 7-bit bytes into a 14-bit value (centred at 8192).
      const bend = ((data2 ?? 0) << 7) | data1;
      return { text: `PitchBend ${bend}  ch${channel}`, cssClass: 'msg-other' };

    case 0xf0: // System
      return { text: t('monitor.sysex', { n: msg.data.length }), cssClass: 'msg-sysex' };

    default:
      return { text: t('monitor.unknown', { bytes: msg.data.join(' ') }), cssClass: 'msg-other' };
  }
}

/**
 * Component that writes MIDI messages into a UI element.
 */
export class MIDIMonitor {
  private element: HTMLElement;
  private maxLines: number;
  private lines: string[] = [];

  constructor(options: MIDIMonitorOptions) {
    this.element = options.logElement;
    this.maxLines = options.maxLines ?? 200;
  }

  /** Adds a message to the log. */
  log(data: Uint8Array): void {
    const msg = parseMIDIMessage(data);
    const { text, cssClass } = describeMessage(msg);
    const hex = [...data].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const timestamp = new Date().toLocaleTimeString(intlLocale(), { hour12: false });

    this.lines.push(`<span class="msg-time">${timestamp}</span>  <span class="${cssClass}">${text}</span>  <span class="msg-other">[${hex}]</span>`);

    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }

    this.render();
  }

  /** Clears the log. */
  clear(): void {
    this.lines = [];
    this.render();
  }

  private render(): void {
    this.element.innerHTML = this.lines.join('\n');
    this.element.scrollTop = this.element.scrollHeight;
  }
}
