// Paced MIDI sender: keeps a minimum gap between outgoing messages and coalesces queued
// messages that share a key, so a fast knob drag sends only its latest value.
//
// The GP-5 has a shallow MIDI input queue and can lock up when it is flooded, so every
// outgoing message goes through here. Messages without a key are never merged or dropped.

/** Minimum gap between two outgoing messages, in ms (same figure as the GP-5 SysEx toolkit). */
export const MIDI_MIN_INTERVAL_MS = 20;

export type MidiSend = (bytes: number[]) => void;

export class MidiPacer {
  /** Pending messages in send order. A coalesced key keeps only its latest bytes. */
  private queue = new Map<string, number[]>();
  private anonymous = 0;
  private lastSentAt = Number.NEGATIVE_INFINITY;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly send: MidiSend,
    private readonly minIntervalMs = MIDI_MIN_INTERVAL_MS,
  ) {}

  /**
   * Queue a message. With `key`, a message still waiting under the same key is replaced and
   * moves to the back of the queue; without it, the message is sent in order.
   */
  enqueue(bytes: number[], key?: string): void {
    const k = key ?? `#${this.anonymous++}`;
    this.queue.delete(k);
    this.queue.set(k, bytes);
    if (this.timer === null) this.drain();
  }

  /** Drop everything waiting to be sent (for example when the output is disconnected). */
  clear(): void {
    this.queue.clear();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Messages waiting to be sent. */
  get pending(): number {
    return this.queue.size;
  }

  private drain(): void {
    this.timer = null;
    const next = this.queue.keys().next();
    if (next.done) return;

    const wait = this.lastSentAt + this.minIntervalMs - Date.now();
    if (wait > 0) {
      this.timer = setTimeout(() => this.drain(), wait);
      return;
    }

    const key = next.value;
    const bytes = this.queue.get(key);
    this.queue.delete(key);
    this.lastSentAt = Date.now();
    if (bytes) this.send(bytes);

    if (this.queue.size > 0) this.timer = setTimeout(() => this.drain(), this.minIntervalMs);
  }
}
