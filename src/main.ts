// Entry point de l'aplicació. Inicialitza els mòduls i enllaça la UI.
// Fase 0: prototip de viabilitat (MIDI + àudio).

import './style.css';
import { MIDIManager } from './midi/midi-manager';
import { MIDIMonitor } from './midi/midi-monitor';
import { AudioManager } from './audio/audio-manager';
import { byId, createStatusIndicator, el } from './ui/components';
import type { MIDIInput, MIDIMessageEvent } from './midi/midi.types';

// ---------------------------------------------------------------------------
// Instàncies dels mòduls
// ---------------------------------------------------------------------------

const midiManager = new MIDIManager();
const audioManager = new AudioManager({ onStatus: (s) => setAudioStatus(s) });

// ---------------------------------------------------------------------------
// Referències a la UI
// ---------------------------------------------------------------------------

const statusList = byId<HTMLUListElement>('status-list');
const midiInputsList = byId<HTMLUListElement>('midi-inputs');
const midiOutputsList = byId<HTMLUListElement>('midi-outputs');
const midiLog = byId<HTMLPreElement>('midi-log');
const audioInputSelect = byId<HTMLSelectElement>('audio-input-select');
const audioStatusDiv = byId<HTMLDivElement>('audio-status');

const monitor = new MIDIMonitor({ logElement: midiLog });

// Indicadors d'estat
const midiSupportIndicator = createStatusIndicator(statusList, 'Suport Web MIDI');
const chocolateIndicator = createStatusIndicator(statusList, 'Chocolate Plus (M-VAVE)');
const gp5Indicator = createStatusIndicator(statusList, 'Valeton GP-5');
const audioIndicator = createStatusIndicator(statusList, 'Entrada d\'àudio');

// ---------------------------------------------------------------------------
// Utilitats de la UI
// ---------------------------------------------------------------------------

function setAudioStatus(text: string, active = false): void {
  audioStatusDiv.textContent = text;
  audioStatusDiv.className = active ? 'audio-status active' : 'audio-status';
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
    midiInputsList.append(el('li', 'device-manufacturer', 'Cap dispositiu d\'entrada.'));
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
    midiOutputsList.append(el('li', 'device-manufacturer', 'Cap dispositiu de sortida.'));
  }
}

function updateConnectionIndicators(): void {
  const { chocolateInput, gp5Output } = midiManager.selection;

  midiSupportIndicator.setLevel(midiManager.isEnabled ? 'ok' : 'fail');
  midiSupportIndicator.setLabel(
    midiManager.isEnabled ? 'Suport Web MIDI: actiu' : 'Suport Web MIDI: no actiu',
  );

  chocolateIndicator.setLevel(chocolateInput ? 'ok' : 'warn');
  chocolateIndicator.setLabel(
    chocolateInput
      ? `Chocolate Plus: ${chocolateInput.name}`
      : 'Chocolate Plus: no detectat',
  );

  gp5Indicator.setLevel(gp5Output ? 'ok' : 'warn');
  gp5Indicator.setLabel(gp5Output ? `Valeton GP-5: ${gp5Output.name}` : 'Valeton GP-5: no detectat');

  renderDeviceLists();
}

// ---------------------------------------------------------------------------
// Subscripció de missatges MIDI del Chocolate Plus
// ---------------------------------------------------------------------------

let subscribedInput: MIDIInput | null = null;

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
    };
  }
}

midiManager.onChange(() => {
  updateConnectionIndicators();
  resubscribeMonitor();
});

// ---------------------------------------------------------------------------
// Àudio: llista d'entrades i monitoratge
// ---------------------------------------------------------------------------

async function refreshAudioInputs(): Promise<void> {
  const devices = await audioManager.listInputDevices();
  audioInputSelect.innerHTML = '';

  if (devices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Entrada predeterminada';
    audioInputSelect.append(opt);
    return;
  }

  for (const device of devices) {
    const opt = document.createElement('option');
    opt.value = device.deviceId;
    opt.textContent = device.label || `Entrada ${device.deviceId.slice(0, 8)}…`;
    audioInputSelect.append(opt);
  }
}

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
    alert(`Error activant MIDI: ${(err as Error).message}`);
  }
});

byId<HTMLButtonElement>('btn-clear-log').addEventListener('click', () => {
  monitor.clear();
});

byId<HTMLButtonElement>('btn-request-audio').addEventListener('click', async () => {
  try {
    const deviceId = audioInputSelect.value || undefined;
    await audioManager.openInput(deviceId);
    audioIndicator.setLevel('ok');
    audioIndicator.setLabel('Entrada d\'àudio: oberta');
    await refreshAudioInputs();
  } catch (err) {
    console.error(err);
    audioIndicator.setLevel('fail');
    audioIndicator.setLabel('Entrada d\'àudio: error');
    setAudioStatus(`Error: ${(err as Error).message}`);
  }
});

byId<HTMLButtonElement>('btn-monitor-audio').addEventListener('click', async () => {
  try {
    const latency = await audioManager.toggleMonitoring();
    audioIndicator.setLevel(audioManager.isMonitoring ? 'ok' : 'warn');
    setAudioStatus(
      audioManager.isMonitoring
        ? `Monitoratge actiu (~${latency} ms de latència).`
        : 'Monitoratge desactivat.',
      audioManager.isMonitoring,
    );
  } catch (err) {
    console.error(err);
    setAudioStatus(`Error: ${(err as Error).message}`);
  }
});

// ---------------------------------------------------------------------------
// Inicialització
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  updateConnectionIndicators();

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
