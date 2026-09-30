// Pista del looper: manté l'àudio gravat (mono), les capes, l'undo i la reproducció.
//
// Simplificació d'aquesta fase: àudio MONO (downmix estèreo → mono). L'estèreo
// i els controls per pista (volum/mute/solo) queden per a la Fase 3c.

export type TrackId = 'A' | 'B';
export type TrackState = 'empty' | 'recording' | 'playing' | 'overdubbing' | 'stopped';

/** Retalla o estén (amb silenci) un buffer fins a `length`. */
function fit(buffer: Float32Array<ArrayBuffer>, length: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(length);
  out.set(buffer.subarray(0, Math.min(length, buffer.length)));
  return out;
}

export class LooperTrack {
  readonly id: TrackId;
  state: TrackState = 'empty';
  /** Nombre de capes compromeses (per a la UI i l'undo). */
  layerCount = 0;

  private context: BaseAudioContext;

  private master: Float32Array<ArrayBuffer> | null = null;
  private lengthSamples = 0;
  private undoStack: Float32Array<ArrayBuffer>[] = [];

  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode;

  // Buffer de captura en curs (creixent).
  private captureBuf = new Float32Array(0);
  private captureLen = 0;

  constructor(id: TrackId, context: BaseAudioContext, destination: AudioNode) {
    this.id = id;
    this.context = context;
    this.gain = context.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(destination);
  }

  get hasContent(): boolean {
    return this.master !== null;
  }

  // --- Captura ---

  resetCapture(): void {
    this.captureLen = 0;
  }

  /** Afegeix una mostra (downmix estèreo → mono). */
  pushSample(left: number, right: number): void {
    if (this.captureLen >= this.captureBuf.length) {
      const next = new Float32Array(Math.max(this.captureBuf.length * 2, 4096));
      next.set(this.captureBuf.subarray(0, this.captureLen));
      this.captureBuf = next;
    }
    this.captureBuf[this.captureLen++] = (left + right) * 0.5;
  }

  /** Retorna una còpia exacta del que s'ha capturat fins ara. */
  captureResult(): Float32Array<ArrayBuffer> {
    return this.captureBuf.slice(0, this.captureLen);
  }

  // --- Commit de gravació / overdub ---

  /** Grava el buffer capturat com a capa inicial de la pista. */
  commitRecording(lengthSamples: number, captured: Float32Array<ArrayBuffer>): void {
    this.master = fit(captured, lengthSamples);
    this.lengthSamples = lengthSamples;
    this.undoStack = [];
    this.layerCount = 1;
  }

  /** Barreja el buffer capturat (una volta) sobre el master. */
  mixOverdub(captured: Float32Array<ArrayBuffer>): void {
    if (!this.master) return;
    this.undoStack.push(this.master.slice());
    const m = this.master;
    const len = Math.min(m.length, captured.length);
    for (let i = 0; i < len; i++) {
      m[i] += captured[i];
    }
    this.layerCount += 1;
  }

  /** Desfà l'última capa. Retorna false si no hi havia res a desfer. */
  undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.master = prev;
    this.lengthSamples = prev.length;
    this.layerCount = Math.max(1, this.layerCount - 1);
    return true;
  }

  clear(): void {
    this.stop();
    this.master = null;
    this.undoStack = [];
    this.lengthSamples = 0;
    this.layerCount = 0;
    this.state = 'empty';
  }

  // --- Reproducció ---

  /** (Re)inicia la reproducció en bucle a partir de `startTime` (context time). */
  startPlayback(startTime: number): void {
    if (!this.master) return;
    this.stop();

    const buffer = this.context.createBuffer(1, this.lengthSamples, this.context.sampleRate);
    buffer.copyToChannel(this.master, 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gain);

    const t = Math.max(startTime, this.context.currentTime);
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setValueAtTime(1, t);
    source.start(t);
    this.source = source;
  }

  /** Atura la reproducció (amb un petit fade per evitar clics). */
  stop(): void {
    if (!this.source) return;
    const source = this.source;
    this.source = null;

    const t = this.context.currentTime;
    const gain = this.gain.gain;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(gain.value, t);
    gain.linearRampToValueAtTime(0, t + 0.015);
    try {
      source.stop(t + 0.02);
    } catch {
      /* ja estava aturada */
    }
  }

  dispose(): void {
    this.stop();
    this.gain.disconnect();
  }
}
