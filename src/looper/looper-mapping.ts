// Mapeig MIDI → accions del looper (MIDI Learn).

export type LooperAction = 'recordOverdub' | 'toggleAll' | 'undo' | 'clear' | 'focusNext';

/** Missatge MIDI que dispara una acció (status byte + dades). */
export interface MIDITrigger {
  /** Byte d'estat complet (command + canal). */
  status: number;
  data1: number;
  /** Absent per a Program Change. */
  data2?: number;
}

/** Descripció llegible d'un trigger per a la UI. */
export function describeTrigger(t: MIDITrigger): string {
  const command = t.status & 0xf0;
  const channel = (t.status & 0x0f) + 1;
  const ch = `ch${channel}`;
  if (command === 0xc0) return `PC#${t.data1} ${ch}`;
  if (command === 0xb0) return `CC#${t.data1} ${ch}`;
  if (command === 0x90) return `Note#${t.data1} ${ch}`;
  return `0x${t.status.toString(16)} #${t.data1} ${ch}`;
}

/** Compara un missatge rebut amb un trigger. S'activa amb "press", no amb release. */
export function matchesTrigger(data: Uint8Array, trigger: MIDITrigger): boolean {
  if (data.length < 2) return false;
  if (data[0] !== trigger.status) return false;
  if (data[1] !== trigger.data1) return false;
  if (trigger.data2 === undefined) return true; // PC: qualsevol cop = press
  const value = data.length > 2 ? data[2] : 0;
  return value > 0; // CC/Note: valor > 0 = press
}

export const LOOPER_ACTIONS: readonly LooperAction[] = [
  'recordOverdub',
  'toggleAll',
  'undo',
  'clear',
  'focusNext',
];

export const ACTION_LABELS: Record<LooperAction, string> = {
  recordOverdub: 'Rec / Overdub (pista enfocada)',
  toggleAll: 'Play / Stop (totes)',
  undo: 'Undo (pista enfocada)',
  clear: 'Clear (pista enfocada)',
  focusNext: 'Canvia pista (A↔B)',
};

/**
 * Triggers per defecte: Program Change al canal 1, botons 1–4 del Chocolate Plus
 * (0xC0 amb data1 0..3). Són una HIPÒTESI — si el pedal envia altres missatges
 * (CC, Note…), usa el MIDI Learn per sobreescriure'ls. `clear` no té botó per
 * defecte (el Chocolate Plus té 4 botons): s'assigna via MIDI Learn o UI.
 */
export function defaultTriggers(): Record<LooperAction, MIDITrigger | null> {
  return {
    recordOverdub: { status: 0xc0, data1: 0 },
    toggleAll: { status: 0xc0, data1: 1 },
    undo: { status: 0xc0, data1: 2 },
    clear: null,
    focusNext: { status: 0xc0, data1: 3 },
  };
}

export class LooperMapping {
  private bindings: Record<LooperAction, MIDITrigger | null>;
  private learning: LooperAction | null = null;

  constructor(bindings?: Partial<Record<LooperAction, MIDITrigger | null>>) {
    this.bindings = { ...defaultTriggers(), ...(bindings ?? {}) };
  }

  getBindings(): Record<LooperAction, MIDITrigger | null> {
    return { ...this.bindings };
  }

  get(action: LooperAction): MIDITrigger | null {
    return this.bindings[action];
  }

  set(action: LooperAction, trigger: MIDITrigger): void {
    this.bindings[action] = trigger;
  }

  get isLearning(): boolean {
    return this.learning !== null;
  }

  get learningAction(): LooperAction | null {
    return this.learning;
  }

  startLearning(action: LooperAction): void {
    this.learning = action;
  }

  cancelLearning(): void {
    this.learning = null;
  }

  /** Captura un missatge i l'associa a l'acció en aprenentatge. Retorna l'acció apresa o null. */
  completeLearning(data: Uint8Array): LooperAction | null {
    if (this.learning === null) return null;
    if (data.length < 2) return null;
    const status = data[0];
    const command = status & 0xf0;
    const data1 = data[1];
    const trigger: MIDITrigger =
      command === 0xc0 ? { status, data1 } : { status, data1, data2: data.length > 2 ? data[2] : 0 };
    this.bindings[this.learning] = trigger;
    const action = this.learning;
    this.learning = null;
    return action;
  }

  /** Retorna l'acció que dispara aquest missatge, o null. */
  match(data: Uint8Array): LooperAction | null {
    for (const action of LOOPER_ACTIONS) {
      const trigger = this.bindings[action];
      if (trigger && matchesTrigger(data, trigger)) return action;
    }
    return null;
  }
}
