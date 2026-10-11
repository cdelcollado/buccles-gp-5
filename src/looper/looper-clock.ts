// Looper clock: wraps Tone.Transport for the BPM and bar quantisation.

import * as Tone from 'tone';

/** Allowed BPM range. */
const BPM_MIN = 40;
const BPM_MAX = 240;

/**
 * Source of truth for the tempo and the bar grid (4/4).
 * The actual quantisation happens by sampling in the audio processor; here we only
 * compute the BPM and schedule callbacks at the next bar boundary.
 */
export class LooperClock {
  private bpm = 120;
  private started = false;

  /** Enables audio and starts the transport (must be called inside a user gesture). */
  async start(): Promise<void> {
    await Tone.start();
    Tone.Transport.timeSignature = [4, 4];
    Tone.Transport.bpm.value = this.bpm;
    if (!this.started) {
      Tone.Transport.start();
      this.started = true;
    }
  }

  getBpm(): number {
    return this.bpm;
  }

  setBpm(bpm: number): void {
    this.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)));
    Tone.Transport.bpm.value = this.bpm;
  }

  /** Duration of one bar (4/4) in seconds. */
  barSeconds(): number {
    return Tone.Time('1m').toSeconds();
  }

  /** Duration of one bar in samples for a given sampleRate. */
  barSamples(sampleRate: number): number {
    return Math.round(this.barSeconds() * sampleRate);
  }

  /**
   * Schedules a callback at the start of the next bar.
   * The callback receives the exact audio time (context time) of that boundary.
   */
  scheduleAtNextBar(callback: (contextTime: number) => void): void {
    const nextBar = Tone.Transport.nextSubdivision('1m');
    Tone.Transport.scheduleOnce((time) => callback(time), nextBar);
  }
}
