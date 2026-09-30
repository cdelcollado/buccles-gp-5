// UI del looper: transport, BPM, pistes i MIDI Learn.

import { el } from '../ui/components';
import type { LooperEngine, LooperSnapshot } from './looper-engine';
import {
  ACTION_LABELS,
  LOOPER_ACTIONS,
  describeTrigger,
  type LooperAction,
  type LooperMapping,
} from './looper-mapping';
import type { TrackId, TrackState } from './looper-track';

const STATE_LABELS: Record<TrackState, string> = {
  empty: 'buit',
  recording: 'grava…',
  playing: 'sona',
  overdubbing: 'overdub…',
  stopped: 'aturat',
};

export interface LooperUIOptions {
  container: HTMLElement;
  engine: LooperEngine;
  mapping: LooperMapping;
  /** Callback per activar l'àudio del looper (gest d'usuari). */
  onEnable: () => Promise<void>;
}

export class LooperUI {
  private container: HTMLElement;
  private engine: LooperEngine;
  private mapping: LooperMapping;
  private onEnable: () => Promise<void>;

  private enableButton: HTMLButtonElement;
  private statusEl: HTMLElement;
  private bpmInput: HTMLInputElement;
  private bpmLockedEl: HTMLElement;
  private toggleAllButton: HTMLButtonElement;
  private focusNextButton: HTMLButtonElement;
  private learnStatus: HTMLElement;

  private trackStateEls = new Map<TrackId, HTMLElement>();
  private trackLayersEls = new Map<TrackId, HTMLElement>();
  private trackCards = new Map<TrackId, HTMLElement>();
  private learnButtons = new Map<LooperAction, HTMLButtonElement>();

  constructor(options: LooperUIOptions) {
    this.container = options.container;
    this.engine = options.engine;
    this.mapping = options.mapping;
    this.onEnable = options.onEnable;

    this.container.innerHTML = '';

    // --- Activar / estat ---
    const top = el('div', 'looper-top');
    this.enableButton = el('button', 'btn btn-primary', 'Activa el looper');
    this.enableButton.type = 'button';
    this.enableButton.addEventListener('click', () => this.handleEnable());
    this.statusEl = el('span', 'looper-status', '');
    top.append(this.enableButton, this.statusEl);
    this.container.append(top);

    // --- Transport ---
    const transport = el('div', 'looper-transport');

    const bpmLabel = el('label', 'looper-bpm-label', 'BPM');
    this.bpmInput = el('input', 'looper-bpm');
    this.bpmInput.type = 'number';
    this.bpmInput.min = '40';
    this.bpmInput.max = '240';
    this.bpmInput.value = String(this.engine.getBpm());
    this.bpmInput.addEventListener('change', () => {
      this.engine.setBpm(Number(this.bpmInput.value));
    });
    bpmLabel.append(this.bpmInput);
    this.bpmLockedEl = el('span', 'looper-bpm-locked', '');
    this.toggleAllButton = el('button', 'btn', 'Play / Stop totes');
    this.toggleAllButton.type = 'button';
    this.toggleAllButton.addEventListener('click', () => this.engine.dispatch('toggleAll'));
    this.focusNextButton = el('button', 'btn', 'Pista A↔B');
    this.focusNextButton.type = 'button';
    this.focusNextButton.addEventListener('click', () => this.engine.dispatch('focusNext'));

    transport.append(bpmLabel, this.bpmLockedEl, this.toggleAllButton, this.focusNextButton);
    this.container.append(transport);

    // --- Pistes ---
    const tracks = el('div', 'looper-tracks');
    for (const id of ['A', 'B'] as const) {
      tracks.append(this.renderTrackCard(id));
    }
    this.container.append(tracks);

    // --- MIDI Learn ---
    const learn = el('div', 'looper-learn');
    learn.append(el('h3', 'looper-learn-title', 'Mapeig MIDI (Chocolate Plus)'));
    this.learnStatus = el('p', 'looper-learn-status', '');
    learn.append(this.learnStatus);

    for (const action of LOOPER_ACTIONS) {
      const row = el('div', 'looper-learn-row');
      const label = el('span', 'looper-learn-label', ACTION_LABELS[action]);
      const btn = el('button', 'btn looper-learn-btn', '');
      btn.type = 'button';
      btn.addEventListener('click', () => this.toggleLearning(action));
      this.learnButtons.set(action, btn);
      row.append(label, btn);
      learn.append(row);
    }
    this.container.append(learn);

    this.engine.onChange((s) => this.renderState(s));
    this.renderState(this.engine.getSnapshot());
    this.refreshBindings();
  }

  /** Re-renderitza els botons d'aprenentatge i l'estat de "learning". */
  refreshBindings(): void {
    for (const [action, btn] of this.learnButtons) {
      const trigger = this.mapping.get(action);
      btn.textContent = trigger ? describeTrigger(trigger) : '— sense assignar —';
      btn.classList.toggle('learning', this.mapping.isLearning && this.mapping.learningAction === action);
    }

    const learning = this.mapping.learningAction;
    this.learnStatus.textContent = learning
      ? `Aprenent «${ACTION_LABELS[learning]}»… prem un botó del pedal.`
      : 'Prem un botó "aprendre" i després prem el botó del pedal que l\'ha de disparar.';
  }

  // --- Renderitzat intern ---

  private renderTrackCard(id: TrackId): HTMLElement {
    const card = el('div', 'looper-track');
    card.dataset.track = id;

    const header = el('div', 'looper-track-header');
    const title = el('span', 'looper-track-title', `Pista ${id}`);
    const stateEl = el('span', 'looper-track-state', '');
    const layersEl = el('span', 'looper-track-layers', '');
    header.append(title, stateEl, layersEl);
    card.append(header);

    const buttons = el('div', 'looper-track-buttons');
    const recBtn = el('button', 'btn', 'Rec/Overdub');
    recBtn.type = 'button';
    recBtn.addEventListener('click', () => this.focusAnd(id, 'recordOverdub'));
    const undoBtn = el('button', 'btn', 'Undo');
    undoBtn.type = 'button';
    undoBtn.addEventListener('click', () => this.focusAnd(id, 'undo'));
    const clearBtn = el('button', 'btn', 'Clear');
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', () => this.focusAnd(id, 'clear'));
    buttons.append(recBtn, undoBtn, clearBtn);
    card.append(buttons);

    // Clic a la targeta = enfocar la pista (sense disparar cap acció).
    card.addEventListener('click', () => this.engine.focusTrack(id));

    this.trackCards.set(id, card);
    this.trackStateEls.set(id, stateEl);
    this.trackLayersEls.set(id, layersEl);
    return card;
  }

  private renderState(s: LooperSnapshot): void {
    this.enableButton.disabled = s.ready;
    this.enableButton.textContent = s.ready ? 'Looper actiu' : 'Activa el looper';
    this.statusEl.textContent = s.ready ? '' : 'Cal activar l\'àudio per usar el looper.';

    this.bpmInput.value = String(s.bpm);
    this.bpmInput.disabled = s.bpmLocked;
    this.bpmLockedEl.textContent = s.bpmLocked
      ? ' (BPM fixat: esborra les pistes per canviar-lo)'
      : '';

    this.toggleAllButton.disabled = !s.ready;
    this.focusNextButton.disabled = !s.ready;

    for (const id of ['A', 'B'] as const) {
      const card = this.trackCards.get(id);
      if (!card) continue;
      const snap = s.tracks[id];
      card.classList.toggle('focused', s.focused === id);

      const stateEl = this.trackStateEls.get(id);
      const layersEl = this.trackLayersEls.get(id);
      if (stateEl) {
        stateEl.textContent = STATE_LABELS[snap.state];
        stateEl.className = `looper-track-state state-${snap.state}`;
      }
      if (layersEl) {
        layersEl.textContent = snap.hasContent ? `${snap.layers} capa(es)` : '';
      }

      card.querySelectorAll('button').forEach((b) => (b.disabled = !s.ready));
    }
  }

  private focusAnd(id: TrackId, action: LooperAction): void {
    this.engine.focusTrack(id);
    this.engine.dispatch(action);
  }

  private toggleLearning(action: LooperAction): void {
    if (this.mapping.isLearning && this.mapping.learningAction === action) {
      this.mapping.cancelLearning();
    } else {
      this.mapping.startLearning(action);
    }
    this.refreshBindings();
  }

  private async handleEnable(): Promise<void> {
    this.enableButton.disabled = true;
    this.statusEl.textContent = 'Activant àudio…';
    try {
      await this.onEnable();
      this.statusEl.textContent = 'Looper actiu.';
    } catch (err) {
      console.error(err);
      this.statusEl.textContent = `Error: ${(err as Error).message}`;
      this.enableButton.disabled = false;
    }
  }
}
