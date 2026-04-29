import { ref, watch } from 'vue'

import { migrateLegacyLocalStorageValue } from '@/utils/local-storage'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LibraryType = 'core' | 'extension' | 'white-label' | 'project'

export interface Library {
  id: string
  name: string
  description: string
  type: LibraryType
  version: string
  componentCount: number
}

export const LIBRARY_TYPE_COLORS: Record<
  LibraryType,
  { bg: string; text: string; border: string }
> = {
  core: { bg: 'bg-accent/15', text: 'text-accent', border: 'border-accent/30' },
  extension: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'white-label': {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30'
  },
  project: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' }
}

export const LIBRARY_TYPE_LABELS: Record<LibraryType, string> = {
  core: 'Core',
  extension: 'Extension',
  'white-label': 'White-label',
  project: 'Project'
}

// ── Singleton state ────────────────────────────────────────────────────────────

const LS_LIBRARIES = 'norka:libraries'
const LEGACY_LIBRARY_KEYS = ['береста:libraries']

function defaultLibraries(): Library[] {
  return [
    {
      id: 'lib-core',
      name: 'Core Library',
      description: 'Базовая библиотека компонентов',
      type: 'core',
      version: '1.4.2',
      componentCount: 8
    },
    {
      id: 'lib-mobile',
      name: 'Mobile Kit',
      description: 'Расширение для мобильных интерфейсов',
      type: 'extension',
      version: '0.9.1',
      componentCount: 3
    }
  ]
}

function loadLibraries(): Library[] {
  try {
    const raw = migrateLegacyLocalStorageValue(LS_LIBRARIES, LEGACY_LIBRARY_KEYS)
    return raw ? (JSON.parse(raw) as Library[]) : defaultLibraries()
  } catch {
    return defaultLibraries()
  }
}

const libraries = ref<Library[]>(loadLibraries())

watch(libraries, (val) => localStorage.setItem(LS_LIBRARIES, JSON.stringify(val)), { deep: true })

// ── Composable ────────────────────────────────────────────────────────────────

export function useLibraries() {
  function addLibrary(
    name: string,
    type: LibraryType = 'extension',
    description = '',
    version = '0.1.0'
  ): Library {
    const library: Library = {
      id: `lib-${Date.now()}`,
      name,
      description,
      type,
      version,
      componentCount: 0
    }
    libraries.value.push(library)
    return library
  }

  function deleteLibrary(id: string) {
    const i = libraries.value.findIndex((l) => l.id === id)
    if (i !== -1) libraries.value.splice(i, 1)
  }

  return {
    libraries,
    addLibrary,
    deleteLibrary
  }
}
