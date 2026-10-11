// Internationalisation: Catalan (default), Spanish and English.
// Static HTML is translated through `data-i18n` attributes; dynamic UI reads `t()`
// and subscribes to `onLocaleChange` to re-render itself.

import { en, type MessageKey } from './en';
import { ca } from './ca';
import { es } from './es';

export type { MessageKey };
export type Locale = 'ca' | 'es' | 'en';
export type MessageParams = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { ca, es, en };
const LOCALES = Object.keys(DICTIONARIES) as Locale[];
const STORAGE_KEY = 'buccles-gp-5:locale';
const DEFAULT_LOCALE: Locale = 'ca';

/** Nom de cada idioma escrit en el seu propi idioma (per al selector). */
export const LOCALE_NAMES: Record<Locale, string> = {
  ca: 'Català',
  es: 'Español',
  en: 'English',
};

/** Locale BCP 47 per a les funcions d'Intl (hores, números). */
const INTL_LOCALES: Record<Locale, string> = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
};

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value);
}

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // localStorage can be blocked (private mode, disabled site data): fall through.
  }
  const browser = navigator.language?.slice(0, 2);
  return isLocale(browser) ? browser : DEFAULT_LOCALE;
}

let current: Locale = detectLocale();
const listeners = new Set<(locale: Locale) => void>();

/** Retorna el locale actual. */
export function getLocale(): Locale {
  return current;
}

/** Locale per a Intl (ex. "ca-ES"). */
export function intlLocale(): string {
  return INTL_LOCALES[current];
}

/**
 * Tradueix una clau amb el locale actual. Els paràmetres s'escriuen com `{nom}`
 * dins del text.
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const template = DICTIONARIES[current][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Canvia l'idioma: el desa, actualitza els textos estàtics i avisa els subscriptors. */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not persisted: the language still applies for this session.
  }
  applyStaticTranslations();
  for (const cb of listeners) cb(current);
}

/** Subscripció a canvis d'idioma. Retorna la funció per desfer-la. */
export function onLocaleChange(cb: (locale: Locale) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Aplica les traduccions als elements de l'HTML:
 * - `data-i18n="clau"` → textContent
 * - `data-i18n-title="clau"` → atribut title
 * - `data-i18n-aria="clau"` → atribut aria-label
 */
export function applyStaticTranslations(root: ParentNode = document): void {
  document.documentElement.lang = current;

  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n as MessageKey);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((node) => {
    node.title = t(node.dataset.i18nTitle as MessageKey);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((node) => {
    node.setAttribute('aria-label', t(node.dataset.i18nAria as MessageKey));
  });
}

export { LOCALES };
