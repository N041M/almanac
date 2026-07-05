import type { ISODate } from '../time/iso-date.js';
import { dateFromISO } from '../time/iso-date.js';
import type { Locale } from './locale.js';
import { bcp47 } from './locale.js';

/** Messages for one namespace: key → template (with `{{param}}` placeholders). */
export type Messages = Record<string, string>;
/** One language's bundle: namespace → messages. Each module ships its own namespace. */
export type NamespaceBundle = Record<string, Messages>;
/** All loaded bundles: language → namespace bundle. */
export type LocaleBundles = Record<string, NamespaceBundle>;

export interface I18n {
  readonly locale: Locale;
  /** Resolve a `"namespace:key"` string; missing key → English → the key itself (L7). */
  t(key: string, params?: Record<string, string | number>): string;
  formatDate(date: ISODate, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
}

const DEFAULT_FALLBACK = 'en';

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export function createI18n(config: {
  locale: Locale;
  bundles: LocaleBundles;
  fallbackLanguage?: string;
}): I18n {
  const { locale, bundles } = config;
  const fallback = config.fallbackLanguage ?? DEFAULT_FALLBACK;

  function lookup(language: string, namespace: string, key: string): string | undefined {
    return bundles[language]?.[namespace]?.[key];
  }

  return {
    locale,
    t(key, params) {
      const sep = key.indexOf(':');
      // A well-formed key is "namespace:key"; anything else resolves to itself.
      if (sep <= 0) return key;
      const namespace = key.slice(0, sep);
      const messageKey = key.slice(sep + 1);
      const template =
        lookup(locale.language, namespace, messageKey) ??
        lookup(fallback, namespace, messageKey) ??
        key; // last resort: the key (L7)
      return params === undefined ? template : interpolate(template, params);
    },
    formatDate(date, options) {
      const value = dateFromISO(date);
      const opts: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC', // keep calendar dates timezone-stable
        ...options,
      };
      return new Intl.DateTimeFormat(bcp47(locale), opts).format(value);
    },
    formatNumber(value, options) {
      return new Intl.NumberFormat(bcp47(locale), options).format(value);
    },
  };
}
