// Gestió d'àudio: captura de l'entrada (GP-5) via getUserMedia i monitoratge.

export interface AudioManagerOptions {
  onStatus?: (status: string) => void;
}

/**
 * Classe que gestiona l'entrada d'àudio (p. ex. del GP-5 via USB).
 * A la Fase 0 només fem la prova de captura i monitoratge (loopback).
 */
export class AudioManager {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private monitoring = false;

  private onStatus?: (status: string) => void;

  constructor(options: AudioManagerOptions = {}) {
    this.onStatus = options.onStatus;
  }

  get isMonitoring(): boolean {
    return this.monitoring;
  }

  /** Llista els dispositius d'entrada d'àudio disponibles. */
  async listInputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput');
  }

  /**
   * Obre el flux d'àudio d'una entrada concreta (o la predeterminada).
   * Desactiva cancel·lació d'eco, supressió de soroll i AGC per minimitzar latència.
   */
  async openInput(deviceId?: string): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Aquest navegador no suporta getUserMedia.');
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
    this.reportStatus('Flux d\'àudio obert correctament.');
    return this.stream;
  }

  /** Atura i allibera el flux d'àudio. */
  closeInput(): void {
    this.stopMonitoring();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.reportStatus('Flux d\'àudio tancat.');
  }

  /** Mesura i retorna la latència estimada del context d'àudio (en ms). */
  getBaseLatencyMs(): number {
    if (!this.audioContext) return 0;
    return Math.round(this.audioContext.baseLatency * 1000);
  }

  /**
   * Activa/desactiva el monitoratge (escoltar l'entrada pels altaveus).
   * Retorna la latència estimada en ms.
   */
  async toggleMonitoring(): Promise<number> {
    if (this.monitoring) {
      this.stopMonitoring();
      return this.getBaseLatencyMs();
    }

    if (!this.stream) {
      throw new Error('Primer obre una entrada d\'àudio.');
    }

    this.audioContext ??= new AudioContext({ latencyHint: 'interactive' });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.audioContext.destination);
    this.monitoring = true;

    this.reportStatus(
      `Monitoratge actiu. Latència base: ~${this.getBaseLatencyMs()} ms.`,
    );
    return this.getBaseLatencyMs();
  }

  private stopMonitoring(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.monitoring = false;
  }

  private reportStatus(status: string): void {
    this.onStatus?.(status);
  }
}
