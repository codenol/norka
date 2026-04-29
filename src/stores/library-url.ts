/**
 * library-url — URL-based library subscriptions.
 *
 * Allows adding libraries by a direct-download URL (e.g. GitHub raw).
 * Periodically checks for updates via conditional GET (If-None-Match).
 * Computes a component diff between old and new versions so the user
 * can see what changed before applying an update.
 */

import { shallowRef, computed } from 'vue'

import { parseFigFile, libraryRegistry } from '@norka/core'

import { useLibraryStore } from './library'

import type { SceneGraph } from '@norka/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LibraryUrlMeta {
  libraryId: string
  url: string
  etag: string | null
  lastModified: string | null
  lastChecked: number // timestamp ms
}

export interface LibraryUpdateInfo {
  newGraph: SceneGraph
  newBuffer: ArrayBuffer
  addedComponents: string[]
  removedComponents: string[]
  totalComponents: number
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'norka:lib-url'

function loadMetas(): LibraryUrlMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LibraryUrlMeta[]) : []
  } catch {
    return []
  }
}

function saveMetas(metas: LibraryUrlMeta[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metas))
  } catch {
    console.warn('[library-url] Failed to save metas')
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const _metas = shallowRef<LibraryUrlMeta[]>(loadMetas())
const _checking = shallowRef(false)
const _fetchError = shallowRef<string | null>(null)

// In-memory pending updates: libraryId → UpdateInfo
const _pendingUpdates = new Map<string, LibraryUpdateInfo>()
// reactive trigger — bump to re-compute hasUpdate computed
const _updateVersion = shallowRef(0)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getComponentNames(graph: SceneGraph): string[] {
  const names: string[] = []
  for (const node of graph.getAllNodes()) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
      names.push(node.name)
    }
  }
  return names
}

function computeDiff(
  oldGraph: SceneGraph | null,
  newGraph: SceneGraph
): Pick<LibraryUpdateInfo, 'addedComponents' | 'removedComponents' | 'totalComponents'> {
  const newNames = getComponentNames(newGraph)
  if (!oldGraph) {
    return { addedComponents: newNames, removedComponents: [], totalComponents: newNames.length }
  }
  const oldSet = new Set(getComponentNames(oldGraph))
  const newSet = new Set(newNames)
  return {
    addedComponents: newNames.filter((n) => !oldSet.has(n)),
    removedComponents: [...oldSet].filter((n) => !newSet.has(n)),
    totalComponents: newNames.length
  }
}

function updateMeta(id: string, patch: Partial<LibraryUrlMeta>): void {
  _metas.value = _metas.value.map((m) => (m.libraryId === id ? { ...m, ...patch } : m))
  saveMetas(_metas.value)
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

async function fetchLibrary(
  url: string,
  etag: string | null
): Promise<{ buf: ArrayBuffer; etag: string | null; lastModified: string | null } | null> {
  const headers: Record<string, string> = {}
  if (etag) headers['If-None-Match'] = etag

  const resp = await fetch(url, { headers })

  if (resp.status === 304) return null // not modified
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)

  const buf = await resp.arrayBuffer()
  return {
    buf,
    etag: resp.headers.get('etag'),
    lastModified: resp.headers.get('last-modified')
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Preview a URL before adding — returns manifest info without registering.
 */
export async function previewUrl(
  url: string
): Promise<{ name: string; componentCount: number; variableCount: number; styleCount: number }> {
  const result = await fetchLibrary(url, null)
  if (!result) throw new Error('Empty response')
  const graph = await parseFigFile(result.buf)
  let componentCount = 0
  for (const node of graph.getAllNodes()) {
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') componentCount++
  }
  const variableCount = graph.variables.size
  const styleCount = graph.styles.size
  const segments = url.split('/')
  const filename = segments[segments.length - 1] ?? 'library'
  const name = filename.replace(/\.fig$/i, '')
  return { name, componentCount, variableCount, styleCount }
}

/**
 * Add a library from a URL and subscribe to updates.
 */
export async function addLibraryFromUrl(url: string, name?: string): Promise<void> {
  _fetchError.value = null
  const libStore = useLibraryStore()

  // Check if already subscribed
  if (_metas.value.some((m) => m.url === url)) {
    _fetchError.value = 'Эта библиотека уже подключена'
    return
  }

  let result: { buf: ArrayBuffer; etag: string | null; lastModified: string | null } | null
  try {
    result = await fetchLibrary(url, null)
  } catch (err) {
    _fetchError.value = err instanceof Error ? err.message : String(err)
    console.error('[library-url] Failed to fetch:', err)
    return
  }
  if (!result) {
    _fetchError.value = 'Пустой ответ от сервера'
    return
  }

  const segments = url.split('/')
  const filename = segments[segments.length - 1] ?? 'library'
  const libraryName = name ?? filename.replace(/\.fig$/i, '')

  const libraryId = await libStore.addLibraryFromBuffer(libraryName, result.buf)
  if (!libraryId) return

  const meta: LibraryUrlMeta = {
    libraryId,
    url,
    etag: result.etag,
    lastModified: result.lastModified,
    lastChecked: Date.now()
  }
  _metas.value = [..._metas.value, meta]
  saveMetas(_metas.value)
}

/**
 * Check all subscribed libraries for updates.
 */
export async function checkAllUpdates(): Promise<void> {
  if (_checking.value) return
  _checking.value = true
  _fetchError.value = null

  for (const meta of _metas.value) {
    try {
      const result = await fetchLibrary(meta.url, meta.etag)
      updateMeta(meta.libraryId, { lastChecked: Date.now() })

      if (!result) continue // 304 — not modified

      const newGraph = await parseFigFile(result.buf)
      const oldGraph = libraryRegistry.getGraph(meta.libraryId)
      const diff = computeDiff(oldGraph, newGraph)

      _pendingUpdates.set(meta.libraryId, {
        newGraph,
        newBuffer: result.buf,
        ...diff
      })
      updateMeta(meta.libraryId, {
        etag: result.etag ?? meta.etag,
        lastModified: result.lastModified ?? meta.lastModified
      })
    } catch (err) {
      console.warn(`[library-url] Update check failed for ${meta.libraryId}:`, err)
    }
  }

  _updateVersion.value++
  _checking.value = false
}

/**
 * Apply a pending update for a library.
 */
export async function applyUpdate(libraryId: string): Promise<void> {
  const info = _pendingUpdates.get(libraryId)
  if (!info) return
  const libStore = useLibraryStore()
  await libStore.replaceLibrary(libraryId, info.newBuffer)
  _pendingUpdates.delete(libraryId)
  _updateVersion.value++
}

/**
 * Dismiss a pending update without applying it.
 */
export function dismissUpdate(libraryId: string): void {
  _pendingUpdates.delete(libraryId)
  _updateVersion.value++
}

/**
 * Remove URL subscription when the library is removed.
 */
export function removeUrlMeta(libraryId: string): void {
  _metas.value = _metas.value.filter((m) => m.libraryId !== libraryId)
  _pendingUpdates.delete(libraryId)
  saveMetas(_metas.value)
}

// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------

export function getUrlMeta(libraryId: string): LibraryUrlMeta | null {
  return _metas.value.find((m) => m.libraryId === libraryId) ?? null
}

export function getUpdateInfo(libraryId: string): LibraryUpdateInfo | null {
  return _pendingUpdates.get(libraryId) ?? null
}

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

const urlLibraryIds = computed(() => {
  void _updateVersion.value
  return new Set(_metas.value.map((m) => m.libraryId))
})

const librariesWithUpdates = computed(() => {
  void _updateVersion.value
  return new Set(_pendingUpdates.keys())
})

export interface LibraryUrlStore {
  metas: typeof _metas
  checking: typeof _checking
  fetchError: typeof _fetchError
  urlLibraryIds: typeof urlLibraryIds
  librariesWithUpdates: typeof librariesWithUpdates
  previewUrl: typeof previewUrl
  addLibraryFromUrl: typeof addLibraryFromUrl
  checkAllUpdates: typeof checkAllUpdates
  applyUpdate: typeof applyUpdate
  dismissUpdate: typeof dismissUpdate
  removeUrlMeta: typeof removeUrlMeta
  getUrlMeta: typeof getUrlMeta
  getUpdateInfo: typeof getUpdateInfo
}

const store: LibraryUrlStore = {
  metas: _metas,
  checking: _checking,
  fetchError: _fetchError,
  urlLibraryIds,
  librariesWithUpdates,
  previewUrl,
  addLibraryFromUrl,
  checkAllUpdates,
  applyUpdate,
  dismissUpdate,
  removeUrlMeta,
  getUrlMeta,
  getUpdateInfo
}

export function useLibraryUrlStore(): LibraryUrlStore {
  return store
}
