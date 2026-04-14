import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { IS_TAURI } from '@/constants'
import { preloadFonts } from '@/engine/fonts'
import { useLibraryStore } from '@/stores/library'
import { initBuiltinLibraries } from '@/stores/builtin-library'

import App from './App.vue'
import router from './router'

preloadFonts()
initBuiltinLibraries()       // register built-in PrimeReact library (sync, before user libs)
void useLibraryStore().init()
const head = createHead()
createApp(App).use(router).use(head).mount('#app')

if (!IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
