// Components UI reutilitzables i senzills.

/** Retorna un element per id i llança un error si no existeix. */
export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element amb id "${id}" no trobat.`);
  return el as T;
}

/** Crea un element DOM amb classe i text opcionals. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Representa un indicador d'estat (llum verda/groga/vermella + etiqueta). */
export type StatusLevel = 'ok' | 'warn' | 'fail';

export interface StatusIndicator {
  setLevel(level: StatusLevel): void;
  setLabel(label: string): void;
}

/**
 * Crea un indicador d'estat i l'afegeix a una llista.
 */
export function createStatusIndicator(ul: HTMLUListElement, label: string): StatusIndicator {
  const li = el('li', 'status-item');
  const dot = el('span', 'status-dot fail');
  const text = el('span', 'status-label', label);
  li.append(dot, text);
  ul.append(li);

  return {
    setLevel(level: StatusLevel) {
      dot.className = `status-dot ${level}`;
    },
    setLabel(newLabel: string) {
      text.textContent = newLabel;
    },
  };
}
