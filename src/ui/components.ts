// Simple, reusable UI components.

/** Returns an element by id and throws if it does not exist. */
export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element amb id "${id}" no trobat.`);
  return el as T;
}

/** Creates a DOM element with an optional class and text. */
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

/** Status indicator (green/yellow/red light + label). */
export type StatusLevel = 'ok' | 'warn' | 'fail';

export interface StatusIndicator {
  setLevel(level: StatusLevel): void;
  setLabel(label: string): void;
}

/**
 * Creates a status indicator and appends it to a list.
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
