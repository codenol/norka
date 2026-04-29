import { ref } from 'vue'

const open = ref(false)

export function useSettingsDialog() {
  return {
    open,
    show: () => {
      open.value = true
    }
  }
}
