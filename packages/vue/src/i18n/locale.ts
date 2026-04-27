import { browser, localeFrom } from '@nanostores/i18n'
import { atom } from 'nanostores'

export const AVAILABLE_LOCALES = ['en', 'ru'] as const
export type Locale = (typeof AVAILABLE_LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский'
}

const LOCALE_STORAGE_KEY = 'norka-locale'

export const localeSetting = atom<Locale | undefined>(undefined)

export const locale = localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))

export function setLocale(code: Locale) {
  localeSetting.set(code)
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, code)
  }
}

if (typeof localStorage !== 'undefined') {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null
  if (saved && AVAILABLE_LOCALES.includes(saved)) {
    localeSetting.set(saved)
  }
}
