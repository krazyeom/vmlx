export type Locale =
  | 'ko'
  | 'en'
  | 'zh'
  | 'ja'
  | 'es'
  | 'fr'
  | 'de'
  | 'ru'
  | 'pt'
  | 'it'
  | 'vi'

export const LOCALES: readonly Locale[] = [
  'ko',
  'en',
  'zh',
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
  ko: '한국어',
  en: 'English',
  zh: '中文',
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
  ko: '🇰🇷',
  en: '🇺🇸',
  zh: '🇨🇳',
  ja: '🇯🇵',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  ru: '🇷🇺',
  pt: '🇧🇷',
  it: '🇮🇹',
  vi: '🇻🇳',
}
