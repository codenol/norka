/**
 * Library store — manages design system libraries for Береста.
 *
 * Libraries are global (app-wide, not per-document).
 * On startup, all persisted libraries are loaded and their
 * variables/styles are injected into the active graph.
 *
 * Persistence strategy:
 *   - `localStorage['beresta:libraries']`   → JSON array of LibraryManifest
 *   - `localStorage['beresta:lib:{id}']`    → base64-encoded .fig bytes
 */

import { shallowRef, computed, type ComputedRef } from 'vue'
import { exportFigFile, parseFigFile, readFigFile, readPenFile, libraryRegistry, LibraryRegistry } from '@beresta/core'

import type { LibraryManifest, SceneGraph } from '@beresta/core'

import { useCodeConnectStore } from './code-connect'
import { isBuiltinLibrary, injectBuiltinComponentsToGraph } from './builtin-library'

// Code Connect store — seeded/pruned alongside library registration
const _codeConnect = useCodeConnectStore()

const MANIFEST_KEY = 'beresta:libraries'
const DATA_KEY_PREFIX = 'beresta:lib:'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function saveManifests(manifests: LibraryManifest[]): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifests))
  } catch {
    console.warn('[library] Failed to save manifests to localStorage')
  }
}

function loadManifests(): LibraryManifest[] {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY)
    return raw ? (JSON.parse(raw) as LibraryManifest[]) : []
  } catch {
    return []
  }
}

function saveLibraryData(id: string, buf: ArrayBuffer): boolean {
  try {
    localStorage.setItem(DATA_KEY_PREFIX + id, arrayBufferToBase64(buf))
    return true
  } catch {
    console.warn('[library] Failed to save library data — storage may be full')
    return false
  }
}

function loadLibraryData(id: string): ArrayBuffer | null {
  try {
    const b64 = localStorage.getItem(DATA_KEY_PREFIX + id)
    return b64 ? base64ToArrayBuffer(b64) : null
  } catch {
    return null
  }
}

function removeLibraryData(id: string): void {
  localStorage.removeItem(DATA_KEY_PREFIX + id)
}

// ---------------------------------------------------------------------------
// Store state
// ---------------------------------------------------------------------------

const _manifests = shallowRef<LibraryManifest[]>([])
const _loading = shallowRef(false)
const _error = shallowRef<string | null>(null)

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function _parseFile(file: File): Promise<{ graph: SceneGraph; buf: ArrayBuffer }> {
  const buf = await file.arrayBuffer()
  const name = file.name.toLowerCase()
  let graph: SceneGraph

  if (name.endsWith('.pen')) {
    graph = await readPenFile(file)
  } else {
    // .fig or unknown — try fig
    graph = await readFigFile(file)
  }
  return { graph, buf }
}

/**
 * Add a library from a user-selected .fig/.pen file.
 */
async function addLibraryFromFile(file: File): Promise<void> {
  _loading.value = true
  _error.value = null
  try {
    const { graph, buf } = await _parseFile(file)
    const name = file.name.replace(/\.(fig|pen)$/i, '')
    const id = crypto.randomUUID()
    const manifest = LibraryRegistry.buildManifest(id, name, graph)

    const saved = saveLibraryData(id, buf)
    if (!saved) {
      _error.value = 'Файл слишком большой для хранения в браузере'
      return
    }

    libraryRegistry.register(manifest, graph)
    _codeConnect.seedFromLibrary(manifest.id)

    const updated = [..._manifests.value, manifest]
    _manifests.value = updated
    saveManifests(updated)
  } catch (err) {
    _error.value = err instanceof Error ? err.message : String(err)
    console.error('[library] Failed to add library:', err)
  } finally {
    _loading.value = false
  }
}

/**
 * Remove a library.
 */
function removeLibrary(id: string): void {
  if (isBuiltinLibrary(id)) return  // built-in libraries cannot be removed
  libraryRegistry.unregister(id)
  _codeConnect.pruneLibrary(id)
  removeLibraryData(id)
  const updated = _manifests.value.filter((m) => m.id !== id)
  _manifests.value = updated
  saveManifests(updated)
}

/**
 * Inject all registered libraries' variables + styles into the given graph.
 * Also copies built-in PrimeReact components to __library_components__ page
 * so the AI's get_components tool can find them.
 * Called when a document is loaded/replaced or created.
 */
function enableForGraph(graph: SceneGraph): void {
  // Copy built-in PrimeReact components into the document
  injectBuiltinComponentsToGraph(graph)

  for (const manifest of _manifests.value) {
    if (libraryRegistry.has(manifest.id)) {
      libraryRegistry.injectIntoGraph(manifest.id, graph)
    }
  }
}

/**
 * Insert a library component into the active document.
 * Copies the component tree to a local internal page if not already present,
 * then creates an instance on the current page.
 */
function insertComponent(
  libraryId: string,
  componentId: string,
  graph: SceneGraph,
  currentPageId: string
): string | null {
  // Check if we already copied this component
  let local = libraryRegistry.findLocalComponent(libraryId, componentId, graph)
  if (!local) {
    local = libraryRegistry.copyComponentToGraph(libraryId, componentId, graph)
  }
  if (!local) return null

  // Create an instance on the current page
  const instance = graph.createInstance(local.id, currentPageId)
  return instance?.id ?? null
}

/**
 * Copy a variable collection (+ its variables) from a library into the local
 * graph as a proper local collection (no libraryId marker — user-owned copy).
 */
function importCollectionToDoc(
  libraryId: string,
  collectionId: string,
  graph: SceneGraph
): void {
  const libGraph = libraryRegistry.getGraph(libraryId)
  if (!libGraph) return
  const col = libGraph.variableCollections.get(collectionId)
  if (!col) return

  // Create a fresh local copy (new IDs, no libraryId)
  const newCol = graph.createCollection(`${col.name} (from library)`)

  for (const varId of col.variableIds) {
    const v = libGraph.variables.get(varId)
    if (!v) continue
    graph.createVariable(v.name, v.type, newCol.id, Object.values(v.valuesByMode)[0])
  }
}

/**
 * Copy a style from a library into the local graph as a user-owned copy.
 */
function importStyleToDoc(
  libraryId: string,
  styleId: string,
  graph: SceneGraph
): void {
  const libGraph = libraryRegistry.getGraph(libraryId)
  if (!libGraph) return
  const style = libGraph.styles.get(styleId)
  if (!style) return

  // Add a clean copy without libraryId
  const { libraryId: _lib, ...rest } = style as typeof style & { libraryId?: string }
  graph.addStyle({ ...rest })
}

/**
 * Add a library from a raw ArrayBuffer (e.g. fetched from a URL).
 * Returns the new library id.
 */
async function addLibraryFromBuffer(name: string, buf: ArrayBuffer): Promise<string> {
  _loading.value = true
  _error.value = null
  try {
    const graph = await parseFigFile(buf)
    const id = crypto.randomUUID()
    const manifest = LibraryRegistry.buildManifest(id, name, graph)
    const saved = saveLibraryData(id, buf)
    if (!saved) {
      _error.value = 'Файл слишком большой для хранения в браузере'
      return ''
    }
    libraryRegistry.register(manifest, graph)
    _codeConnect.seedFromLibrary(manifest.id)
    const updated = [..._manifests.value, manifest]
    _manifests.value = updated
    saveManifests(updated)
    return id
  } catch (err) {
    _error.value = err instanceof Error ? err.message : String(err)
    console.error('[library] Failed to add library from buffer:', err)
    return ''
  } finally {
    _loading.value = false
  }
}

/**
 * Replace an existing library's data with a new buffer.
 * Updates the manifest counts and re-registers in the registry.
 */
async function replaceLibrary(id: string, buf: ArrayBuffer): Promise<void> {
  _loading.value = true
  _error.value = null
  try {
    const existing = _manifests.value.find((m) => m.id === id)
    if (!existing) return
    const graph = await parseFigFile(buf)
    const newManifest = LibraryRegistry.buildManifest(id, existing.name, graph)
    libraryRegistry.unregister(id)
    _codeConnect.pruneLibrary(id)
    libraryRegistry.register(newManifest, graph)
    _codeConnect.seedFromLibrary(id)
    saveLibraryData(id, buf)
    _manifests.value = _manifests.value.map((m) => (m.id === id ? newManifest : m))
    saveManifests(_manifests.value)
  } catch (err) {
    _error.value = err instanceof Error ? err.message : String(err)
    console.error('[library] Failed to replace library:', err)
  } finally {
    _loading.value = false
  }
}

/**
 * Export a library's current graph as a .fig buffer.
 * Used for publishing.
 */
async function exportLibraryBuffer(id: string): Promise<Uint8Array | null> {
  const graph = libraryRegistry.getGraph(id)
  if (!graph) return null
  try {
    return await exportFigFile(graph)
  } catch (err) {
    console.error('[library] Failed to export library buffer:', err)
    return null
  }
}

/**
 * Load all libraries from localStorage and register them.
 * Call this once on app startup.
 */
async function init(): Promise<void> {
  const manifests = loadManifests()
  if (manifests.length === 0) return

  _loading.value = true
  const loaded: LibraryManifest[] = []

  for (const manifest of manifests) {
    const buf = loadLibraryData(manifest.id)
    if (!buf) {
      console.warn(`[library] Data for library "${manifest.name}" not found, skipping`)
      continue
    }
    try {
      const blob = new Blob([buf], { type: 'application/octet-stream' })
      const file = new File([blob], manifest.name + '.fig')
      const { graph } = await _parseFile(file)
      libraryRegistry.register(manifest, graph)
      _codeConnect.seedFromLibrary(manifest.id)
      loaded.push(manifest)
    } catch (err) {
      console.error(`[library] Failed to load library "${manifest.name}":`, err)
    }
  }

  _manifests.value = loaded
  if (loaded.length !== manifests.length) {
    saveManifests(loaded)
  }
  _loading.value = false
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LibraryStore {
  manifests: ReturnType<typeof shallowRef<LibraryManifest[]>>
  loading: ReturnType<typeof shallowRef<boolean>>
  error: ReturnType<typeof shallowRef<string | null>>
  libraryCount: ComputedRef<number>
  addLibraryFromFile: (file: File) => Promise<void>
  addLibraryFromBuffer: (name: string, buf: ArrayBuffer) => Promise<string>
  replaceLibrary: (id: string, buf: ArrayBuffer) => Promise<void>
  exportLibraryBuffer: (id: string) => Promise<Uint8Array | null>
  removeLibrary: (id: string) => void
  enableForGraph: (graph: SceneGraph) => void
  insertComponent: (
    libraryId: string,
    componentId: string,
    graph: SceneGraph,
    currentPageId: string
  ) => string | null
  importCollectionToDoc: (libraryId: string, collectionId: string, graph: SceneGraph) => void
  importStyleToDoc: (libraryId: string, styleId: string, graph: SceneGraph) => void
  init: () => Promise<void>
}

const libraryCount = computed(() => _manifests.value.length)

const store: LibraryStore = {
  manifests: _manifests,
  loading: _loading,
  error: _error,
  libraryCount,
  addLibraryFromFile,
  addLibraryFromBuffer,
  replaceLibrary,
  exportLibraryBuffer,
  removeLibrary,
  enableForGraph,
  insertComponent,
  importCollectionToDoc,
  importStyleToDoc,
  init,
}

export function useLibraryStore(): LibraryStore {
  return store
}
