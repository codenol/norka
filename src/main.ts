import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import 'primeicons/primeicons.css'
import 'primereact/resources/primereact.min.css'
import { IS_TAURI } from '@/constants'
import { preloadFonts } from '@/engine/fonts'
import { useLibraryStore } from '@/stores/library'
import { initBuiltinLibraries } from '@/stores/builtin-library'
import { createTab, getActiveStore } from '@/stores/tabs'

import App from './App.vue'
import router from './router'

preloadFonts()
initBuiltinLibraries()       // register built-in PrimeReact library (sync, before user libs)
void useLibraryStore().init()
try {
  getActiveStore()
} catch {
  createTab()
}
const head = createHead()
createApp(App).use(router).use(head).mount('#app')

if (!IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
  })
}
