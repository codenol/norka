/**
 * Snapshot store — in-memory named version snapshots.
 *
 * Snapshots are serialized as .fig buffers (via exportFigFile) and restored
 * by calling editor.replaceGraph(). All snapshots live in RAM for the current
 * session; they are not persisted to disk.
 */

import { computed, shallowRef } from 'vue'

import { exportFigFile, parseFigFile } from '@norka/core'

import type { SceneGraph } from '@norka/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditorLike {
  graph: SceneGraph
  replaceGraph(g: SceneGraph): void
  undo: { clear(): void }
  requestRender(): void
}

export interface Snapshot {
  id: string
  name: string
  timestamp: number
  buffer: Uint8Array
  pageCount: number
  nodeCount: number
}

// ---------------------------------------------------------------------------
// Singleton state
// ---------------------------------------------------------------------------

const _snapshots = shallowRef<Snapshot[]>([])
const _saving = shallowRef(false)
const _restoring = shallowRef(false)
const _error = shallowRef<string | null>(null)

let _idCounter = 0

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  return `snap-${Date.now()}-${++_idCounter}`
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('ru', { dateStyle: 'short', timeStyle: 'short' })
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function createSnapshot(name: string, editor: EditorLike): Promise<void> {
  _saving.value = true
  _error.value = null
  try {
    const buffer = await exportFigFile(editor.graph)
    const snap: Snapshot = {
      id: genId(),
      name: name.trim() || formatTimestamp(Date.now()),
      timestamp: Date.now(),
      buffer,
      pageCount: editor.graph.getPages().length,
      nodeCount: editor.graph.nodes.size
    }
    _snapshots.value = [..._snapshots.value, snap]
  } catch (e) {
    console.error('[Snapshots] Failed to create snapshot:', e)
    _error.value = e instanceof Error ? e.message : String(e)
  } finally {
    _saving.value = false
  }
}

async function restoreSnapshot(id: string, editor: EditorLike): Promise<void> {
  const snap = _snapshots.value.find((s) => s.id === id)
  if (!snap) return
  _restoring.value = true
  _error.value = null
  try {
    const ab = snap.buffer.buffer.slice(
      snap.buffer.byteOffset,
      snap.buffer.byteOffset + snap.buffer.byteLength
    ) as ArrayBuffer
    const graph = await parseFigFile(ab)
    editor.replaceGraph(graph)
    editor.undo.clear()
    editor.requestRender()
  } catch (e) {
    console.error('[Snapshots] Failed to restore snapshot:', e)
    _error.value = e instanceof Error ? e.message : String(e)
  } finally {
    _restoring.value = false
  }
}

function deleteSnapshot(id: string): void {
  _snapshots.value = _snapshots.value.filter((s) => s.id !== id)
}

function renameSnapshot(id: string, newName: string): void {
  const trimmed = newName.trim()
  if (!trimmed) return
  _snapshots.value = _snapshots.value.map((s) => (s.id === id ? { ...s, name: trimmed } : s))
}

function clearError(): void {
  _error.value = null
}

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

const snapshotCount = computed(() => _snapshots.value.length)

export interface SnapshotStore {
  snapshots: typeof _snapshots
  saving: typeof _saving
  restoring: typeof _restoring
  error: typeof _error
  snapshotCount: typeof snapshotCount
  createSnapshot: typeof createSnapshot
  restoreSnapshot: typeof restoreSnapshot
  deleteSnapshot: typeof deleteSnapshot
  renameSnapshot: typeof renameSnapshot
  clearError: typeof clearError
}

const store: SnapshotStore = {
  snapshots: _snapshots,
  saving: _saving,
  restoring: _restoring,
  error: _error,
  snapshotCount,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  renameSnapshot,
  clearError
}

export function useSnapshotStore(): SnapshotStore {
  return store
}
