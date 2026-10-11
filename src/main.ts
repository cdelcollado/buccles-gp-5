// Entry point de l'aplicació. Inicialitza els mòduls i enllaça la UI.
// Fase 0 (MIDI + àudio) i Fase 1 (controlador GP-5).

import './style.css';
import { MIDIManager } from './midi/midi-manager';
import { MIDIMonitor } from './midi/midi-monitor';
import { AudioManager } from './audio/audio-manager';
import { GP5Controller } from './gp5/gp5-controller';
import { GP5UI } from './gp5/gp5-ui';
import { LooperEngine } from './looper/looper-engine';
import { LooperUI } from './looper/looper-ui';
import { LooperMapping } from './looper/looper-mapping';
import {
  loadGP5State,
  loadLooperState,
  saveGP5State,
  saveLooperState,
} from './storage/persistence';
import { byId, createStatusIndicator, el } from './ui/components';
import {
  LOCALES,
  LOCALE_NAMES,
  applyStaticTranslations,
  getLocale,
  onLocaleChange,
  setLocale,
  t,
  type Locale,
} from './i18n';
import type { MIDIInput, MIDIMessageEvent } from './midi/midi.types';

// Textos de la UI segons l'idioma: tots s'apliquen amb `t()` i es re-renderitzen
// quan canvia l'idioma.
applyStaticTranslations();

// ---------------------------------------------------------------------------
// Instàncies dels mòduls
// ---------------------------------------------------------------------------

const midiManager = new MIDIManager();
const audioManager = new AudioManager({ onStatus: (s) => setAudioStatus(s) });
const gp5Controller = new GP5Controller();
const gp5UI = new GP5UI(byId<HTMLDivElement>('gp5-ui'), gp5Controller);

// Persistència: desa l'estat del GP-5 quan canvia.
gp5Controller.onPresetChange(() => saveGP5State(gp5Controller.getState()));
gp5Controller.onModuleStateChange(() => saveGP5State(gp5Controller.getState()));
gp5Controller.onTunerChange(() => saveGP5State(gp5Controller.getState()));

// ---------------------------------------------------------------------------
// Referències a la UI
// ---------------------------------------------------------------------------

const statusList = byId<HTMLUListElement>('status-list');
const midiInputsList = byId<HTMLUListElement>('midi-inputs');
const midiOutputsList = byId<HTMLUListElement>('midi-outputs');
const midiLog = byId<HTMLPreElement>('midi-log');
const audioInputSelect = byId<HTMLSelectElement>('audio-input-select');
const audioStatusDiv = byId<HTMLDivElement>('audio-status');
const localeSelect = byId<HTMLSelectElement>('locale-select');

// --- Looper (Fase 3a) ---

const savedLooper = loadLooperState();
const looperEngine = new LooperEngine();
if (savedLooper.bpm != null) {
  looperEngine.setBpm(savedLooper.bpm);
}
const looperMapping = new LooperMapping(savedLooper.bindings);
const looperUI = new LooperUI({
  container: byId<HTMLDivElement>('looper-ui'),
  engine: looperEngine,
  mapping: looperMapping,
  onEnable: () => looperEngine.init(audioManager, audioInputSelect.value || undefined),
});

// Persistència: desa BPM i mapeig del looper quan canvien.
looperEngine.onChange((s) => {
  saveLooperState({ bpm: s.bpm, bindings: looperMapping.getBindings() });
});

const monitor = new MIDIMonitor({ logElement: midiLog });

// Indicadors d'estat (les etiquetes es posen a `updateConnectionIndicators`).
const midiSupportIndicator = createStatusIndicator(statusList, t('status.webmidi'));
const chocolateIndicator = createStatusIndicator(statusList, t('status.chocolate'));
const gp5Indicator = createStatusIndicator(statusList, t('status.gp5'));
const audioIndicator = createStatusIndicator(statusList, t('status.audio'));

/** Estat de l'entrada d'àudio, guardat per poder re-traduir l'indicador. */
let audioIndicatorState: 'unknown' | 'open' | 'error' = 'unknown';
/** Últim missatge de l'àrea d'àudio; és una funció per poder re-traduir-lo. */
let audioStatus: { text: () => string; active: boolean } | null = null;

// ---------------------------------------------------------------------------
// Utilitats de la UI
// ---------------------------------------------------------------------------

function setAudioStatus(text: () => string, active = false): void {
  audioStatus = { text, active };
  renderAudioStatus();
}

function renderAudioStatus(): void {
  audioStatusDiv.textContent = audioStatus ? audioStatus.text() : '';
  audioStatusDiv.className = audioStatus?.active ? 'audio-status active' : 'audio-status';
}

function renderAudioIndicator(): void {
  if (audioIndicatorState === 'open') {
    audioIndicator.setLevel('ok');
    audioIndicator.setLabel(t('status.audio.open'));
  } else if (audioIndicatorState === 'error') {
    audioIndicator.setLevel('fail');
    audioIndicator.setLabel(t('status.audio.error'));
  } else {
    audioIndicator.setLabel(t('status.audio'));
  }
}

function renderDeviceLists(): void {
  midiInputsList.innerHTML = '';
  midiOutputsList.innerHTML = '';

  const inputs = midiManager.inputs;
  const outputs = midiManager.outputs;

  for (const input of inputs) {
    const li = el('li');
    const name = el('span', 'device-name', input.name);
    li.append(name);
    if (input.manufacturer) {
      li.append(el('span', 'device-manufacturer', `(${input.manufacturer})`));
    }
    if (midiManager.selection.chocolateInput?.id === input.id) {
      li.append(el('span', 'badge', 'Chocolate Plus'));
    }
    midiInputsList.append(li);
  }

  if (inputs.length === 0) {
    midiInputsList.append(el('li', 'device-manufacturer', t('midi.noInputs')));
  }

  for (const output of outputs) {
    const li = el('li');
    const name = el('span', 'device-name', output.name);
    li.append(name);
    if (output.manufacturer) {
      li.append(el('span', 'device-manufacturer', `(${output.manufacturer})`));
    }
    if (midiManager.selection.gp5Output?.id === output.id) {
      li.append(el('span', 'badge', 'GP-5'));
    }
    midiOutputsList.append(li);
  }

  if (outputs.length === 0) {
    midiOutputsList.append(el('li', 'device-manufacturer', t('midi.noOutputs')));
  }
}

function updateConnectionIndicators(): void {
  const { chocolateInput, gp5Output } = midiManager.selection;

  midiSupportIndicator.setLevel(midiManager.isEnabled ? 'ok' : 'fail');
  midiSupportIndicator.setLabel(
    midiManager.isEnabled ? t('status.webmidi.on') : t('status.webmidi.off'),
  );

  chocolateIndicator.setLevel(chocolateInput ? 'ok' : 'warn');
  chocolateIndicator.setLabel(
    chocolateInput
      ? t('status.chocolate.on', { name: chocolateInput.name })
      : t('status.chocolate.off'),
  );

  gp5Indicator.setLevel(gp5Output ? 'ok' : 'warn');
  gp5Indicator.setLabel(
    gp5Output ? t('status.gp5.on', { name: gp5Output.name }) : t('status.gp5.off'),
  );

  renderDeviceLists();
}

/** Sincronitza el controlador i la UI del GP-5 amb la selecció actual. */
function syncGP5(): void {
  const { gp5Output } = midiManager.selection;
  gp5Controller.setOutput(gp5Output);
  gp5UI.setConnected(gp5Output !== null);
}

// ---------------------------------------------------------------------------
// Subscripció de missatges MIDI del Chocolate Plus
// ---------------------------------------------------------------------------

let subscribedInput: MIDIInput | null = null;

/** Gestiona un missatge MIDI del Chocolate Plus: Learn o acció del looper. */
function handleLooperMidi(data: Uint8Array): void {
  if (looperMapping.isLearning) {
    const action = looperMapping.completeLearning(data);
    if (action) {
      saveLooperState({ bpm: looperEngine.getBpm(), bindings: looperMapping.getBindings() });
      looperUI.refreshBindings();
    }
    return;
  }

  const action = looperMapping.match(data);
  if (action) {
    looperEngine.dispatch(action);
  }
}

function resubscribeMonitor(): void {
  if (subscribedInput) {
    subscribedInput.onmidimessage = null;
    subscribedInput = null;
  }

  const input = midiManager.selection.chocolateInput;
  if (input) {
    subscribedInput = input;
    input.onmidimessage = (event: MIDIMessageEvent) => {
      monitor.log(event.data);
      handleLooperMidi(event.data);
    };
  }
}

midiManager.onChange(() => {
  updateConnectionIndicators();
  resubscribeMonitor();
  syncGP5();
});

// ---------------------------------------------------------------------------
// Àudio: llista d'entrades i monitoratge
// ---------------------------------------------------------------------------

async function refreshAudioInputs(): Promise<void> {
  const devices = await audioManager.listInputDevices();
  const previous = audioInputSelect.value;
  audioInputSelect.innerHTML = '';

  if (devices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('audioProbe.defaultInput');
    audioInputSelect.append(opt);
    return;
  }

  for (const device of devices) {
    const opt = document.createElement('option');
    opt.value = device.deviceId;
    opt.textContent =
      device.label || t('audioProbe.inputFallback', { id: device.deviceId.slice(0, 8) });
    audioInputSelect.append(opt);
  }

  // Manté l'entrada que l'usuari ja tenia seleccionada (p. ex. després de canviar d'idioma).
  if (previous && devices.some((d) => d.deviceId === previous)) {
    audioInputSelect.value = previous;
  }
}

// ---------------------------------------------------------------------------
// Idioma
// ---------------------------------------------------------------------------

for (const locale of LOCALES) {
  const opt = document.createElement('option');
  opt.value = locale;
  opt.textContent = LOCALE_NAMES[locale];
  localeSelect.append(opt);
}
localeSelect.value = getLocale();
localeSelect.addEventListener('change', () => setLocale(localeSelect.value as Locale));

onLocaleChange((locale) => {
  localeSelect.value = locale;
  updateConnectionIndicators();
  renderAudioIndicator();
  renderAudioStatus();
  refreshAudioInputs().catch((err) => console.warn('No s\'han pogut llistar els dispositius d\'àudio:', err));
});

// ---------------------------------------------------------------------------
// Handlers dels botons
// ---------------------------------------------------------------------------

byId<HTMLButtonElement>('btn-request-midi').addEventListener('click', async () => {
  try {
    await midiManager.enable();
    updateConnectionIndicators();
    resubscribeMonitor();
  } catch (err) {
    console.error(err);
    alert(t('error.midiActivation', { message: (err as Error).message }));
  }
});

byId<HTMLButtonElement>('btn-clear-log').addEventListener('click', () => {
  monitor.clear();
});

byId<HTMLButtonElement>('btn-request-audio').addEventListener('click', async () => {
  try {
    const deviceId = audioInputSelect.value || undefined;
    await audioManager.openInput(deviceId);
    audioIndicatorState = 'open';
    renderAudioIndicator();
    await refreshAudioInputs();
  } catch (err) {
    console.error(err);
    audioIndicatorState = 'error';
    renderAudioIndicator();
    const message = (err as Error).message;
    setAudioStatus(() => t('error.generic', { message }));
  }
});

byId<HTMLButtonElement>('btn-monitor-audio').addEventListener('click', async () => {
  try {
    const latency = await audioManager.toggleMonitoring();
    audioIndicator.setLevel(audioManager.isMonitoring ? 'ok' : 'warn');
    const monitoring = audioManager.isMonitoring;
    setAudioStatus(
      () =>
        monitoring
          ? t('audioProbe.monitoringOn', { ms: latency })
          : t('audioProbe.monitoringOff'),
      monitoring,
    );
  } catch (err) {
    console.error(err);
    const message = (err as Error).message;
    setAudioStatus(() => t('error.generic', { message }));
  }
});

// ---------------------------------------------------------------------------
// Inicialització
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  updateConnectionIndicators();
  syncGP5();

  // Restaura l'estat desat del GP-5 (sense enviar CC al dispositiu).
  gp5Controller.restoreState(loadGP5State());

  try {
    await refreshAudioInputs();
  } catch (err) {
    console.warn('No s\'han pogut llistar els dispositius d\'àudio:', err);
  }

  // Si el navegador suporta MIDI, intenta activar-lo automàticament.
  if (typeof navigator.requestMIDIAccess === 'function') {
    try {
      await midiManager.enable();
      updateConnectionIndicators();
      resubscribeMonitor();
    } catch (err) {
      console.warn('MIDI no activat automàticament:', err);
    }
  }
}

init();
