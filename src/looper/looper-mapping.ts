// MIDI mapping → looper actions (MIDI Learn).

export type LooperAction = 'recordOverdub' | 'toggleAll' | 'undo' | 'clear' | 'focusNext';

/** MIDI message that triggers an action (status byte + data). */
export interface MIDITrigger {
  /** Full status byte (command + channel). */
  status: number;
  data1: number;
  /** Absent for Program Change. */
  data2?: number;
}

/** Human-readable description of a trigger for the UI. */
export function describeTrigger(t: MIDITrigger): string {
  const command = t.status & 0xf0;
  const channel = (t.status & 0x0f) + 1;
  const ch = `ch${channel}`;
  if (command === 0xc0) return `PC#${t.data1} ${ch}`;
  if (command === 0xb0) return `CC#${t.data1} ${ch}`;
  if (command === 0x90) return `Note#${t.data1} ${ch}`;
  return `0x${t.status.toString(16)} #${t.data1} ${ch}`;
}

/** Compares a received message with a trigger. Fires on press, not on release. */
export function matchesTrigger(data: Uint8Array, trigger: MIDITrigger): boolean {
  if (data.length < 2) return false;
  if (data[0] !== trigger.status) return false;
  if (data[1] !== trigger.data1) return false;
  if (trigger.data2 === undefined) return true; // PC: every message = press
  const value = data.length > 2 ? data[2] : 0;
  return value > 0; // CC/Note: value > 0 = press
}

export const LOOPER_ACTIONS: readonly LooperAction[] = [
  'recordOverdub',
  'toggleAll',
  'undo',
  'clear',
  'focusNext',
];

/**
 * Default triggers: Program Change on channel 1, Chocolate Plus buttons 1–4
 * (0xC0 with data1 0..3). These are a HYPOTHESIS: if the pedal sends other messages
 * (CC, Note…), use MIDI Learn to override them. `clear` has no default button
 * (the Chocolate Plus has 4 buttons): assign it via MIDI Learn or the UI.
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

  /** Captures a message and binds it to the action being learned. Returns the learned action or null. */
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

  /** Returns the action triggered by this message, or null. */
  match(data: Uint8Array): LooperAction | null {
    for (const action of LOOPER_ACTIONS) {
      const trigger = this.bindings[action];
      if (trigger && matchesTrigger(data, trigger)) return action;
    }
    return null;
  }
}
