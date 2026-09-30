// Rellotge del looper: embolcalla Tone.Transport per al BPM i la quantize per compàs.

import * as Tone from 'tone';

/** Marge de BPM permès. */
const BPM_MIN = 40;
const BPM_MAX = 240;

/**
 * Font de veritat del tempo i de la graella de compassos (4/4).
 * La quantize real es fa mostrejant al processador d'àudio; aquí només
 * calculem el BPM i programem callbacks al límit del següent compàs.
 */
export class LooperClock {
  private bpm = 120;
  private started = false;

  /** Activa l'àudio i arrenca el transport (cal cridar-ho dins un gest d'usuari). */
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

  /** Durada d'un compàs (4/4) en segons. */
  barSeconds(): number {
    return Tone.Time('1m').toSeconds();
  }

  /** Durada d'un compàs en mostres per a un sampleRate donat. */
  barSamples(sampleRate: number): number {
    return Math.round(this.barSeconds() * sampleRate);
  }

  /**
   * Programa un callback a l'inici del següent compàs.
   * El callback rep el temps d'àudio (context time) exacte d'aquest límit.
   */
  scheduleAtNextBar(callback: (contextTime: number) => void): void {
    const nextBar = Tone.Transport.nextSubdivision('1m');
    Tone.Transport.scheduleOnce((time) => callback(time), nextBar);
  }
}
