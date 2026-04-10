<script setup lang="ts">
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/stores/editor'
import { useSnapshotStore, formatTimestamp } from '@/stores/snapshots'

const editor = useEditorStore()
const ss = useSnapshotStore()
const { panels } = useI18n()

// ── Create ───────────────────────────────────────────────────────────────────

const newName = ref('')

async function handleCreate() {
  await ss.createSnapshot(newName.value, editor)
  newName.value = ''
}

// ── Restore confirmation ─────────────────────────────────────────────────────

const confirmId = ref<string | null>(null)

function requestRestore(id: string) {
  confirmId.value = id
}

async function confirmRestore() {
  const id = confirmId.value
  if (!id) return
  confirmId.value = null
  await ss.restoreSnapshot(id, editor)
}

function cancelRestore() {
  confirmId.value = null
}

// ── Rename ───────────────────────────────────────────────────────────────────

const editingId = ref<string | null>(null)
const editingName = ref('')

function startRename(id: string, currentName: string) {
  editingId.value = id
  editingName.value = currentName
}

function commitRename() {
  if (editingId.value) {
    ss.renameSnapshot(editingId.value, editingName.value)
  }
  editingId.value = null
  editingName.value = ''
}

function cancelRename() {
  editingId.value = null
  editingName.value = ''
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Create bar -->
    <div class="flex items-center gap-1.5 border-b border-border px-3 py-2 shrink-0">
      <input
        v-model="newName"
        type="text"
        :placeholder="panels.snapshotNamePlaceholder"
        class="min-w-0 flex-1 rounded border border-border bg-panel px-2 py-1 text-xs text-surface placeholder-muted outline-none focus:border-accent"
        @keydown.enter="handleCreate"
      />
      <button
        :disabled="ss.saving.value"
        class="flex shrink-0 items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        @click="handleCreate"
      >
        <icon-lucide-camera class="size-3" />
        {{ ss.saving.value ? panels.snapshotSaving : panels.snapshotCreate }}
      </button>
    </div>

    <!-- Error banner -->
    <div
      v-if="ss.error.value"
      class="flex shrink-0 items-start gap-1.5 border-b border-border bg-error/10 px-3 py-2 text-xs text-error"
    >
      <icon-lucide-triangle-alert class="mt-0.5 size-3 shrink-0" />
      <span class="flex-1">{{ ss.error.value }}</span>
      <button class="text-muted hover:text-surface" @click="ss.clearError()">
        <icon-lucide-x class="size-3" />
      </button>
    </div>

    <!-- Restore confirmation banner -->
    <div
      v-if="confirmId !== null"
      class="flex shrink-0 flex-col gap-2 border-b border-border bg-warning/10 px-3 py-2.5"
    >
      <p class="text-xs text-surface">{{ panels.snapshotRestoreWarning }}</p>
      <div class="flex gap-1.5">
        <button
          :disabled="ss.restoring.value"
          class="rounded bg-warning px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          @click="confirmRestore"
        >
          {{ ss.restoring.value ? panels.snapshotRestoring : panels.snapshotRestoreConfirm }}
        </button>
        <button
          class="rounded px-3 py-1 text-xs text-muted hover:text-surface"
          @click="cancelRestore"
        >
          {{ panels.snapshotCancel }}
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-if="ss.snapshots.value.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center"
    >
      <icon-lucide-history class="size-8 text-muted" />
      <p class="text-xs text-muted">{{ panels.snapshotEmpty }}</p>
    </div>

    <!-- Snapshot list — newest first -->
    <ul v-else class="min-h-0 flex-1 overflow-y-auto">
      <li
        v-for="snap in [...ss.snapshots.value].reverse()"
        :key="snap.id"
        class="flex flex-col gap-1 border-b border-border px-3 py-2.5 transition-colors hover:bg-hover"
        :class="{ 'ring-1 ring-inset ring-warning': confirmId === snap.id }"
      >
        <!-- Name row -->
        <div class="flex items-center gap-1.5">
          <input
            v-if="editingId === snap.id"
            v-model="editingName"
            class="min-w-0 flex-1 rounded border border-accent bg-panel px-1.5 py-0.5 text-xs text-surface outline-none"
            @keydown.enter="commitRename"
            @keydown.escape="cancelRename"
            @blur="commitRename"
          />
          <span
            v-else
            class="flex-1 cursor-text truncate text-xs font-medium text-surface"
            :title="panels.snapshotRenameHint"
            @dblclick="startRename(snap.id, snap.name)"
          >
            {{ snap.name }}
          </span>

          <button
            class="shrink-0 rounded p-0.5 text-muted hover:text-surface"
            :title="panels.snapshotRestore"
            @click="requestRestore(snap.id)"
          >
            <icon-lucide-rotate-ccw class="size-3" />
          </button>
          <button
            class="shrink-0 rounded p-0.5 text-muted hover:text-error"
            :title="panels.snapshotDelete"
            @click="ss.deleteSnapshot(snap.id)"
          >
            <icon-lucide-trash-2 class="size-3" />
          </button>
        </div>

        <!-- Meta row -->
        <div class="flex items-center gap-1.5 text-[10px] text-muted">
          <span>{{ formatTimestamp(snap.timestamp) }}</span>
          <span class="opacity-40">·</span>
          <span>{{ snap.pageCount }} {{ panels.snapshotPagesLabel }}</span>
          <span class="opacity-40">·</span>
          <span>{{ snap.nodeCount }} {{ panels.snapshotNodesLabel }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
