export type Locale =
  | 'en'
  | 'zh'
  | 'ko'
  | 'ja'
  | 'es'
  | 'fr'
  | 'de'
  | 'ru'
  | 'pt'
  | 'it'
  | 'vi'

export const LOCALES: readonly Locale[] = [
  'en',
  'zh',
  'ko',
  'ja',
  'es',
  'fr',
  'de',
  'ru',
  'pt',
  'it',
  'vi',
]

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ko: '한국어',
  ja: '日本語',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  pt: 'Português',
  it: 'Italiano',
  vi: 'Tiếng Việt',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: '🇺🇸',
  zh: '🇨🇳',
  ko: '🇰🇷',
  ja: '🇯🇵',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  ru: '🇷🇺',
  pt: '🇧🇷',
  it: '🇮🇹',
  vi: '🇻🇳',
}
