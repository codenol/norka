import { onMounted, ref, watch } from 'vue'
import { IS_BROWSER } from '@/constants'

export const PRIME_THEMES = [
  { id: 'lara-dark-blue', label: 'Lara Dark' },
  { id: 'lara-light-blue', label: 'Lara Light' },
] as const

const PRIME_THEME_LINK_ID = 'norka-prime-theme-link'
const PRIME_THEME_STORAGE_KEY = 'norka:prime-theme'

export function usePrimeTheme() {
  const theme = ref<string>('lara-dark-blue')

  function ensureThemeLink() {
    if (!IS_BROWSER) return null
    let link = document.getElementById(PRIME_THEME_LINK_ID) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = PRIME_THEME_LINK_ID
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    return link
  }

  function applyTheme(themeId: string) {
    const link = ensureThemeLink()
    if (!link) return
    link.href = `https://unpkg.com/primereact@10/resources/themes/${themeId}/theme.css`
    document.documentElement.dataset.primeTheme = themeId
  }

  onMounted(() => {
    if (!IS_BROWSER) return
    const saved = window.localStorage.getItem(PRIME_THEME_STORAGE_KEY)
    if (saved) theme.value = saved
    applyTheme(theme.value)
  })

  watch(theme, (next) => {
    if (IS_BROWSER) {
      window.localStorage.setItem(PRIME_THEME_STORAGE_KEY, next)
    }
    applyTheme(next)
  })

  return { theme, themes: PRIME_THEMES }
}
