// UI del controlador GP-5: navegació, graella de presets, cadena de mòduls,
// afinador i volum.

import { el } from '../ui/components';
import { GP5_MODULES, PATCH_RANGE, PATCH_VOLUME_RANGE, type GP5ModuleId } from './gp5-mapping';
import type { GP5Controller } from './gp5-controller';

/**
 * Renderitza i gestiona la vista de control del GP-5 dins d'un contenidor.
 */
export class GP5UI {
  private container: HTMLElement;
  private controller: GP5Controller;

  private presetButtons: HTMLButtonElement[] = [];
  private moduleButtons = new Map<GP5ModuleId, HTMLButtonElement>();
  private tunerButton: HTMLButtonElement | null = null;
  private volumeInput: HTMLInputElement | null = null;
  private interactive: (HTMLButtonElement | HTMLInputElement)[] = [];

  constructor(container: HTMLElement, controller: GP5Controller) {
    this.container = container;
    this.controller = controller;
    this.render();

    controller.onPresetChange((n) => this.updatePreset(n));
    controller.onModuleStateChange((id, on) => this.updateModule(id, on));
    controller.onTunerChange((on) => this.updateTuner(on));

    // Comença desactivat fins que main.ts confirmi la connexió del GP-5.
    this.setConnected(false);
  }

  /** Activa o desactiva tots els controls segons si el GP-5 està connectat. */
  setConnected(connected: boolean): void {
    for (const ctrl of this.interactive) {
      ctrl.disabled = !connected;
    }
  }

  // --- Renderitzat ---

  private render(): void {
    this.container.innerHTML = '';

    // Navegació de patch/banc.
    const nav = el('div', 'gp5-nav');
    nav.append(
      this.button('◀◀ Bank', () => this.controller.bankDown(), 'Bank −'),
      this.button('◀ Patch', () => this.controller.patchDown(), 'Patch −'),
      this.button('Patch ▶', () => this.controller.patchUp(), 'Patch +'),
      this.button('Bank ▶▶', () => this.controller.bankUp(), 'Bank +'),
    );
    this.container.append(nav);

    // Graella de presets 00-99.
    const grid = el('div', 'gp5-grid');
    for (let i = PATCH_RANGE[0]; i <= PATCH_RANGE[1]; i++) {
      const label = String(i).padStart(2, '0');
      const btn = this.button(label, () => this.controller.recallPreset(i), `Preset ${label}`);
      btn.classList.add('gp5-preset');
      this.presetButtons.push(btn);
      grid.append(btn);
    }
    this.container.append(grid);

    // Cadena de mòduls d'efecte.
    const modules = el('div', 'gp5-modules');
    for (const mod of GP5_MODULES) {
      const btn = this.button(
        mod.name,
        () => this.controller.toggleModule(mod.id),
        `${mod.name} — ${mod.description}`,
      );
      btn.classList.add('gp5-module');
      this.moduleButtons.set(mod.id, btn);
      modules.append(btn);
    }
    this.container.append(modules);

    // Afinador i volum.
    const controls = el('div', 'gp5-controls');

    this.tunerButton = this.button('Afinador', () => this.controller.toggleTuner(), 'Afinador on/off');
    this.tunerButton.classList.add('gp5-tuner');
    controls.append(this.tunerButton);

    const volumeLabel = el('label', 'gp5-volume-label', 'Volum');
    volumeLabel.htmlFor = 'gp5-volume';

    this.volumeInput = el('input', 'gp5-volume');
    this.volumeInput.type = 'range';
    this.volumeInput.min = String(PATCH_VOLUME_RANGE[0]);
    this.volumeInput.max = String(PATCH_VOLUME_RANGE[1]);
    this.volumeInput.value = String(PATCH_VOLUME_RANGE[1]);
    this.volumeInput.addEventListener('input', () => {
      this.controller.setPatchVolume(Number(this.volumeInput?.value ?? 0));
    });
    this.interactive.push(this.volumeInput);

    controls.append(volumeLabel, this.volumeInput);
    this.container.append(controls);
  }

  // --- Actualització d'estat ---

  private updatePreset(preset: number): void {
    this.presetButtons.forEach((btn, i) => {
      btn.classList.toggle('active', i === preset);
    });
  }

  private updateModule(id: GP5ModuleId, on: boolean): void {
    this.moduleButtons.get(id)?.classList.toggle('active', on);
  }

  private updateTuner(on: boolean): void {
    this.tunerButton?.classList.toggle('active', on);
  }

  // --- Helpers ---

  private button(label: string, onClick: () => void, title?: string): HTMLButtonElement {
    const btn = el('button', 'btn', label);
    btn.type = 'button';
    if (title) btn.title = title;
    btn.addEventListener('click', onClick);
    this.interactive.push(btn);
    return btn;
  }
}
