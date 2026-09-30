// Motor del looper: orquestra les 2 pistes, la captura d'àudio, la quantize i el mix.

import * as Tone from 'tone';
import { LooperClock } from './looper-clock';
import { LooperTrack, type TrackId, type TrackState } from './looper-track';
import type { LooperAction } from './looper-mapping';
import type { AudioManager } from '../audio/audio-manager';

type CaptureMode = 'first' | 'record' | 'overdub';

export interface TrackSnapshot {
  state: TrackState;
  layers: number;
  hasContent: boolean;
}

export interface LooperSnapshot {
  ready: boolean;
  bpm: number;
  /** True quan el BPM queda fixat (ja s'ha gravat el primer loop). */
  bpmLocked: boolean;
  focused: TrackId;
  tracks: Record<TrackId, TrackSnapshot>;
}

const OTHER: Record<TrackId, TrackId> = { A: 'B', B: 'A' };

/**
 * Motor del looper.
 *
 * Model de temps: el primer loop defineix la longitud mestra (un nombre enter de
 * compassos) i la fase. Totes les pistes comparteixen aquesta longitud i s'alineen
 * als límits de compàs que marca Tone.Transport. La captura és mostrejada amb un
 * ScriptProcessorNode per tenir límits exactes (sense deriva).
 */
export class LooperEngine {
  private clock = new LooperClock();
  private context: BaseAudioContext | null = null;
  private tracks: Record<TrackId, LooperTrack> | null = null;
  private focused: TrackId = 'A';

  private masterLengthSamples: number | null = null;

  // Estat de captura gestionat pel processador d'àudio.
  private sampleOrigin: number | null = null;
  private processedSamples = 0;
  private capturing: LooperTrack | null = null;
  private captureMode: CaptureMode = 'first';
  private captureStartSample = 0;
  private pendingStart: { track: LooperTrack; sample: number } | null = null;
  private pendingStop: { track: LooperTrack; sample: number } | null = null;
  private autoCloseSample: number | null = null;

  private listeners = new Set<(s: LooperSnapshot) => void>();

  // --- Inicialització ---

  get isReady(): boolean {
    return this.context !== null;
  }

  /** Obre l'entrada d'àudio, arrenca Tone i munta el graf. Cal un gest d'usuari. */
  async init(audioManager: AudioManager, deviceId?: string): Promise<void> {
    const stream = audioManager.getStream() ?? (await audioManager.openInput(deviceId));
    await this.clock.start();

    const ctx = Tone.getContext().rawContext as AudioContext;
    this.context = ctx;

    const inputSource = ctx.createMediaStreamSource(stream);
    const captureNode = ctx.createScriptProcessor(2048, 2, 2);
    captureNode.onaudioprocess = (e) => this.processAudio(e);
    const muteGain = ctx.createGain();
    muteGain.gain.value = 0;

    // La ruta d'entrada alimenta el capturador, però no passa directe als altaveus
    // (el muteGain evita doble monitoratge). El que se sent és el mix de les pistes.
    inputSource.connect(captureNode);
    captureNode.connect(muteGain);
    muteGain.connect(ctx.destination);

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    this.tracks = {
      A: new LooperTrack('A', ctx, masterGain),
      B: new LooperTrack('B', ctx, masterGain),
    };

    this.emit();
  }

  // --- Estat / subscripció ---

  getBpm(): number {
    return this.clock.getBpm();
  }

  setBpm(bpm: number): void {
    if (this.masterLengthSamples !== null) return; // BPM bloquejat un cop gravat
    this.clock.setBpm(bpm);
    this.emit();
  }

  getFocused(): TrackId {
    return this.focused;
  }

  focusTrack(id: TrackId): void {
    this.focused = id;
    this.emit();
  }

  getSnapshot(): LooperSnapshot {
    const empty: TrackSnapshot = { state: 'empty', layers: 0, hasContent: false };
    const t = this.tracks;
    return {
      ready: this.isReady,
      bpm: this.clock.getBpm(),
      bpmLocked: this.masterLengthSamples !== null,
      focused: this.focused,
      tracks: t
        ? { A: this.snap(t.A), B: this.snap(t.B) }
        : { A: { ...empty }, B: { ...empty } },
    };
  }

  private snap(track: LooperTrack): TrackSnapshot {
    return { state: track.state, layers: track.layerCount, hasContent: track.hasContent };
  }

  onChange(cb: (s: LooperSnapshot) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // --- Accions (cridades des de la UI o el mapeig MIDI) ---

  dispatch(action: LooperAction): void {
    if (!this.isReady) return;
    switch (action) {
      case 'recordOverdub':
        this.recordOverdub();
        break;
      case 'toggleAll':
        this.toggleAll();
        break;
      case 'undo':
        this.undo();
        break;
      case 'clear':
        this.clear();
        break;
      case 'focusNext':
        this.focusNext();
        break;
    }
  }

  private recordOverdub(): void {
    const track = this.tracks![this.focused];
    switch (track.state) {
      case 'empty':
        if (this.masterLengthSamples === null) {
          this.armStart(track, 'first');
        } else {
          this.armStart(track, 'record');
        }
        track.state = 'recording';
        break;
      case 'recording':
        // Només el primer loop es tanca manualment (tap). La resta es tanca sola.
        if (this.captureMode === 'first' && this.capturing === track && this.pendingStop === null) {
          this.armStop(track);
        }
        break;
      case 'playing':
        this.armStart(track, 'overdub');
        track.state = 'overdubbing';
        break;
      case 'overdubbing':
        break;
      case 'stopped':
        this.schedulePlayback(track);
        track.state = 'playing';
        break;
    }
    this.emit();
  }

  private toggleAll(): void {
    const t = this.tracks!;
    const anyPlaying = t.A.state === 'playing' || t.B.state === 'playing';
    if (anyPlaying) {
      for (const id of ['A', 'B'] as const) {
        const track = t[id];
        if (track.state === 'playing') {
          track.stop();
          track.state = 'stopped';
        }
      }
    } else {
      for (const id of ['A', 'B'] as const) {
        const track = t[id];
        if (track.state === 'stopped') {
          this.schedulePlayback(track);
          track.state = 'playing';
        }
      }
    }
    this.emit();
  }

  private undo(): void {
    const track = this.tracks![this.focused];
    if (!track.hasContent) return;
    const resuming = track.state === 'playing' || track.state === 'overdubbing';
    const ok = track.undo();
    if (ok && resuming) {
      this.schedulePlayback(track);
      track.state = 'playing';
    }
    this.emit();
  }

  private clear(): void {
    const track = this.tracks![this.focused];
    track.clear();
    if (!this.tracks!.A.hasContent && !this.tracks!.B.hasContent) {
      this.masterLengthSamples = null;
    }
    this.emit();
  }

  private focusNext(): void {
    this.focused = OTHER[this.focused];
    this.emit();
  }

  // --- Programació d'inici/aturada al següent compàs ---

  private armStart(track: LooperTrack, mode: CaptureMode): void {
    const sr = this.context!.sampleRate;
    this.clock.scheduleAtNextBar((time) => {
      const sample = Math.round(time * sr);
      this.pendingStart = { track, sample };
      this.captureMode = mode;
      if (mode === 'record' || mode === 'overdub') {
        this.autoCloseSample = sample + this.masterLengthSamples!;
      }
    });
  }

  private armStop(track: LooperTrack): void {
    const sr = this.context!.sampleRate;
    this.clock.scheduleAtNextBar((time) => {
      this.pendingStop = { track, sample: Math.round(time * sr) };
    });
  }

  private schedulePlayback(track: LooperTrack): void {
    this.clock.scheduleAtNextBar((time) => {
      track.startPlayback(time);
    });
  }

  // --- Processador d'àudio ---

  private processAudio(e: AudioProcessingEvent): void {
    if (!this.context) return;
    const sr = this.context.sampleRate;
    const input = e.inputBuffer;
    const n = input.length;
    const ch0 = input.getChannelData(0);
    const ch1 = input.numberOfChannels > 1 ? input.getChannelData(1) : ch0;

    if (this.sampleOrigin === null) {
      this.sampleOrigin = Math.round(e.playbackTime * sr);
    }
    const base = this.sampleOrigin + this.processedSamples;
    this.processedSamples += n;

    const active =
      this.capturing !== null || this.pendingStart !== null || this.pendingStop !== null;
    if (!active) return;

    for (let i = 0; i < n; i++) {
      const abs = base + i;

      if (this.pendingStart && abs >= this.pendingStart.sample) {
        const track = this.pendingStart.track;
        track.resetCapture();
        this.capturing = track;
        this.captureStartSample = this.pendingStart.sample;
        this.pendingStart = null;
      }

      if (this.capturing) {
        this.capturing.pushSample(ch0[i], ch1[i]);
      }

      if (this.pendingStop && abs >= this.pendingStop.sample) {
        this.finishCapture(this.pendingStop.sample, this.captureMode);
        this.pendingStop = null;
      }

      if (this.capturing && this.autoCloseSample !== null && abs >= this.autoCloseSample) {
        this.finishCapture(this.autoCloseSample, this.captureMode);
        this.autoCloseSample = null;
      }
    }
  }

  private finishCapture(boundarySample: number, mode: CaptureMode): void {
    const track = this.capturing;
    if (!track || !this.context) return;
    const sr = this.context.sampleRate;
    const captured = track.captureResult();

    if (mode === 'first') {
      const samplesPerBar = this.clock.barSamples(sr);
      const bars = Math.max(
        1,
        Math.round((boundarySample - this.captureStartSample) / samplesPerBar),
      );
      this.masterLengthSamples = bars * samplesPerBar;
      track.commitRecording(this.masterLengthSamples, captured);
    } else if (mode === 'record') {
      track.commitRecording(this.masterLengthSamples!, captured);
    } else {
      track.mixOverdub(captured);
    }

    track.startPlayback(boundarySample / sr);
    track.state = 'playing';
    this.capturing = null;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const cb of this.listeners) cb(snapshot);
  }
}
