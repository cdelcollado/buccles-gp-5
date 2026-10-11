// Audio management: input capture (GP-5) via getUserMedia, and monitoring.

import { t } from '../i18n';

export interface AudioManagerOptions {
  /** Receives a status message; passed as a function so it can be re-translated. */
  onStatus?: (status: () => string) => void;
}

/**
 * Class that manages the audio input (e.g. the GP-5 via USB).
 * In Phase 0 we only do the capture and monitoring test (loopback).
 */
export class AudioManager {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private monitoring = false;

  private onStatus?: (status: () => string) => void;

  constructor(options: AudioManagerOptions = {}) {
    this.onStatus = options.onStatus;
  }

  get isMonitoring(): boolean {
    return this.monitoring;
  }

  /** Returns the open audio stream (or null if it has not been opened yet). */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /** Lists the available audio input devices. */
  async listInputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  /**
   * Opens the audio stream of a given input (or the default one).
   * Disables echo cancellation, noise suppression and AGC to minimise latency.
   */
  async openInput(deviceId?: string): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(t('error.getUserMediaUnsupported'));
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.reportStatus(() => t('audioProbe.streamOpen'));
    return this.stream;
  }

  /** Stops and releases the audio stream. */
  closeInput(): void {
    this.stopMonitoring();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.reportStatus(() => t('audioProbe.streamClosed'));
  }

  /** Measures and returns the estimated latency of the audio context (in ms). */
  getBaseLatencyMs(): number {
    if (!this.audioContext) return 0;
    return Math.round(this.audioContext.baseLatency * 1000);
  }

  /**
   * Turns monitoring on/off (plays the input through the speakers).
   * Returns the estimated latency in ms.
   */
  async toggleMonitoring(): Promise<number> {
    if (this.monitoring) {
      this.stopMonitoring();
      return this.getBaseLatencyMs();
    }

    if (!this.stream) {
      throw new Error(t('error.openInputFirst'));
    }

    this.audioContext ??= new AudioContext({ latencyHint: 'interactive' });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.audioContext.destination);
    this.monitoring = true;

    const latency = this.getBaseLatencyMs();
    this.reportStatus(() => t('audioProbe.monitoringOn', { ms: latency }));
    return this.getBaseLatencyMs();
  }

  private stopMonitoring(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.monitoring = false;
  }

  private reportStatus(status: () => string): void {
    this.onStatus?.(status);
  }
}
