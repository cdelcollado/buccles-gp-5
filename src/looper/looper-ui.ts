// Looper UI: transport, BPM, tracks and MIDI Learn.

import { el } from '../ui/components';
import { t, onLocaleChange, type MessageKey } from '../i18n';
import type { LooperEngine, LooperSnapshot } from './looper-engine';
import {
  LOOPER_ACTIONS,
  describeTrigger,
  type LooperAction,
  type LooperMapping,
} from './looper-mapping';
import type { TrackId, TrackState } from './looper-track';

const STATE_KEYS: Record<TrackState, MessageKey> = {
  empty: 'looper.state.empty',
  recording: 'looper.state.recording',
  playing: 'looper.state.playing',
  overdubbing: 'looper.state.overdubbing',
  stopped: 'looper.state.stopped',
};

const ACTION_KEYS: Record<LooperAction, MessageKey> = {
  recordOverdub: 'looper.action.recordOverdub',
  toggleAll: 'looper.action.toggleAll',
  undo: 'looper.action.undo',
  clear: 'looper.action.clear',
  focusNext: 'looper.action.focusNext',
};

export interface LooperUIOptions {
  container: HTMLElement;
  engine: LooperEngine;
  mapping: LooperMapping;
  /** Callback to enable the looper's audio (user gesture). */
  onEnable: () => Promise<void>;
}

export class LooperUI {
  private container: HTMLElement;
  private engine: LooperEngine;
  private mapping: LooperMapping;
  private onEnable: () => Promise<void>;

  // DOM elements: recreated on every `build()` (language change).
  private enableButton!: HTMLButtonElement;
  private statusEl!: HTMLElement;
  private bpmInput!: HTMLInputElement;
  private bpmLockedEl!: HTMLElement;
  private toggleAllButton!: HTMLButtonElement;
  private focusNextButton!: HTMLButtonElement;
  private learnStatus!: HTMLElement;

  private trackStateEls = new Map<TrackId, HTMLElement>();
  private trackLayersEls = new Map<TrackId, HTMLElement>();
  private trackCards = new Map<TrackId, HTMLElement>();
  private learnButtons = new Map<LooperAction, HTMLButtonElement>();

  constructor(options: LooperUIOptions) {
    this.container = options.container;
    this.engine = options.engine;
    this.mapping = options.mapping;
    this.onEnable = options.onEnable;

    // Subscribe only once: the callbacks always use the current elements.
    this.engine.onChange((s) => this.renderState(s));
    onLocaleChange(() => this.build());

    this.build();
  }

  /** Re-renders the learn buttons and the "learning" state. */
  refreshBindings(): void {
    for (const [action, btn] of this.learnButtons) {
      const trigger = this.mapping.get(action);
      btn.textContent = trigger ? describeTrigger(trigger) : t('looper.learn.unassigned');
      btn.classList.toggle('learning', this.mapping.isLearning && this.mapping.learningAction === action);
    }

    const learning = this.mapping.learningAction;
    this.learnStatus.textContent = learning
      ? t('looper.learn.active', { action: t(ACTION_KEYS[learning]) })
      : t('looper.learn.idle');
  }

  // --- DOM construction ---

  /** Builds (or rebuilds) the whole UI in the current language. */
  private build(): void {
    this.container.innerHTML = '';
    this.trackCards.clear();
    this.trackStateEls.clear();
    this.trackLayersEls.clear();
    this.learnButtons.clear();

    // --- Enable / status ---
    const top = el('div', 'looper-top');
    this.enableButton = el('button', 'btn btn-primary', t('looper.enable'));
    this.enableButton.type = 'button';
    this.enableButton.addEventListener('click', () => this.handleEnable());
    this.statusEl = el('span', 'looper-status', '');
    top.append(this.enableButton, this.statusEl);
    this.container.append(top);

    // --- Transport ---
    const transport = el('div', 'looper-transport');

    const bpmLabel = el('label', 'looper-bpm-label', t('looper.bpm'));
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
    this.toggleAllButton = el('button', 'btn', t('looper.playStopAll'));
    this.toggleAllButton.type = 'button';
    this.toggleAllButton.addEventListener('click', () => this.engine.dispatch('toggleAll'));
    this.focusNextButton = el('button', 'btn', t('looper.switchTrack'));
    this.focusNextButton.type = 'button';
    this.focusNextButton.addEventListener('click', () => this.engine.dispatch('focusNext'));

    transport.append(bpmLabel, this.bpmLockedEl, this.toggleAllButton, this.focusNextButton);
    this.container.append(transport);

    // --- Tracks ---
    const tracks = el('div', 'looper-tracks');
    for (const id of ['A', 'B'] as const) {
      tracks.append(this.renderTrackCard(id));
    }
    this.container.append(tracks);

    // --- MIDI Learn ---
    const learn = el('div', 'looper-learn');
    learn.append(el('h3', 'looper-learn-title', t('looper.learn.title')));
    this.learnStatus = el('p', 'looper-learn-status', '');
    learn.append(this.learnStatus);

    for (const action of LOOPER_ACTIONS) {
      const row = el('div', 'looper-learn-row');
      const label = el('span', 'looper-learn-label', t(ACTION_KEYS[action]));
      const btn = el('button', 'btn looper-learn-btn', '');
      btn.type = 'button';
      btn.addEventListener('click', () => this.toggleLearning(action));
      this.learnButtons.set(action, btn);
      row.append(label, btn);
      learn.append(row);
    }
    this.container.append(learn);

    this.renderState(this.engine.getSnapshot());
    this.refreshBindings();
  }

  private renderTrackCard(id: TrackId): HTMLElement {
    const card = el('div', 'looper-track');
    card.dataset.track = id;

    const header = el('div', 'looper-track-header');
    const title = el('span', 'looper-track-title', t('looper.track', { id }));
    const stateEl = el('span', 'looper-track-state', '');
    const layersEl = el('span', 'looper-track-layers', '');
    header.append(title, stateEl, layersEl);
    card.append(header);

    const buttons = el('div', 'looper-track-buttons');
    const recBtn = el('button', 'btn', t('looper.recOverdub'));
    recBtn.type = 'button';
    recBtn.addEventListener('click', () => this.focusAnd(id, 'recordOverdub'));
    const undoBtn = el('button', 'btn', t('looper.undo'));
    undoBtn.type = 'button';
    undoBtn.addEventListener('click', () => this.focusAnd(id, 'undo'));
    const clearBtn = el('button', 'btn', t('looper.clear'));
    clearBtn.type = 'button';
    clearBtn.addEventListener('click', () => this.focusAnd(id, 'clear'));
    buttons.append(recBtn, undoBtn, clearBtn);
    card.append(buttons);

    // Clicking the card = focus the track (without triggering any action).
    card.addEventListener('click', () => this.engine.focusTrack(id));

    this.trackCards.set(id, card);
    this.trackStateEls.set(id, stateEl);
    this.trackLayersEls.set(id, layersEl);
    return card;
  }

  // --- State rendering ---

  private renderState(s: LooperSnapshot): void {
    this.enableButton.disabled = s.ready;
    this.enableButton.textContent = s.ready ? t('looper.enabled') : t('looper.enable');
    this.statusEl.textContent = s.ready ? '' : t('looper.needAudio');

    this.bpmInput.value = String(s.bpm);
    this.bpmInput.disabled = s.bpmLocked;
    this.bpmLockedEl.textContent = s.bpmLocked ? t('looper.bpmLocked') : '';

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
        stateEl.textContent = t(STATE_KEYS[snap.state]);
        stateEl.className = `looper-track-state state-${snap.state}`;
      }
      if (layersEl) {
        layersEl.textContent = snap.hasContent ? t('looper.layers', { n: snap.layers }) : '';
      }

      card.querySelectorAll('button').forEach((b) => (b.disabled = !s.ready));
    }
  }

  // --- Actions ---

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
    this.statusEl.textContent = t('looper.activating');
    try {
      await this.onEnable();
      this.statusEl.textContent = t('looper.activated');
    } catch (err) {
      console.error(err);
      this.statusEl.textContent = t('error.generic', { message: (err as Error).message });
      this.enableButton.disabled = false;
    }
  }
}
