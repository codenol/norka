<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '@beresta/vue/context/editorContext'
import { useNodeProps } from '@beresta/vue/controls/useNodeProps'
import { useSceneComputed } from '@beresta/vue/internal/useSceneComputed'
import { providePropertyList } from './context'

import type { Fill, Stroke, Effect, SceneNode } from '@beresta/core'

type ArrayPropKey = 'fills' | 'strokes' | 'effects'
type ArrayItemType = Fill | Stroke | Effect

const props = defineProps<{
  propKey: ArrayPropKey
  label?: string
}>()

const emit = defineEmits<{
  add: [item: ArrayItemType]
  remove: [index: number]
  update: [index: number, item: ArrayItemType]
  patch: [index: number, changes: Record<string, unknown>]
  toggleVisibility: [index: number]
}>()

const editor = useEditor()
const { isArrayMixed } = useNodeProps()

const selectedNodes = useSceneComputed(() => {
  void editor.state.sceneVersion
  return editor.getSelectedNodes()
})
const activeNode = useSceneComputed<SceneNode | null>(() => {
  void editor.state.sceneVersion
  return editor.getSelectedNode() ?? selectedNodes.value[0] ?? null
})
const isMulti = computed(() => selectedNodes.value.length > 1)
const active = computed(() => selectedNodes.value.length > 0)

const isMixed = computed(() => isArrayMixed(props.propKey))

const items = useSceneComputed(() => {
  void editor.state.sceneVersion
  if (isMixed.value) return []
  return (activeNode.value?.[props.propKey] ?? []) as ArrayItemType[]
})

function targetNodes(): SceneNode[] {
  if (isMulti.value) return selectedNodes.value
  return activeNode.value ? [activeNode.value] : []
}

function add(defaults: ArrayItemType) {
  emit('add', defaults)
  for (const n of targetNodes()) {
    const arr = isMulti.value ? [defaults] : [...n[props.propKey], defaults]
    editor.updateNodeWithUndo(
      n.id,
      { [props.propKey]: arr } as Partial<SceneNode>,
      isMulti.value ? `Set ${props.propKey}` : `Add ${props.propKey}`
    )
  }
}

function remove(index: number) {
  emit('remove', index)
  for (const n of targetNodes()) {
    editor.updateNodeWithUndo(
      n.id,
      {
        [props.propKey]: (n[props.propKey] as ArrayItemType[]).filter((_, i) => i !== index)
      } as Partial<SceneNode>,
      `Remove ${props.propKey}`
    )
  }
}

function update(index: number, item: ArrayItemType) {
  emit('update', index, item)
  for (const n of targetNodes()) {
    const arr = [...n[props.propKey]] as ArrayItemType[]
    arr[index] = item
    editor.updateNodeWithUndo(n.id, { [props.propKey]: arr } as Partial<SceneNode>, `Change ${props.propKey}`)
  }
}

function patch(index: number, changes: Record<string, unknown>) {
  emit('patch', index, changes)
  for (const n of targetNodes()) {
    const arr = [...n[props.propKey]] as ArrayItemType[]
    arr[index] = { ...arr[index], ...changes } as ArrayItemType
    editor.updateNodeWithUndo(n.id, { [props.propKey]: arr } as Partial<SceneNode>, `Change ${props.propKey}`)
  }
}

function toggleVisibility(index: number) {
  emit('toggleVisibility', index)
  const nodes = targetNodes()
  if (nodes.length === 0) return
  if (nodes.length > 1) {
    editor.undo.beginBatch(`Toggle ${props.propKey} visibility`)
  }
  for (const n of nodes) {
    const liveNode = editor.getNode(n.id)
    if (!liveNode) continue
    const arr = liveNode[props.propKey] as Array<{ visible: boolean }>
    if (!arr[index]) continue
    const newArr = [...liveNode[props.propKey]] as Array<{ visible: boolean }>
    newArr[index] = { ...newArr[index], visible: !arr[index].visible }
    editor.updateNodeWithUndo(
      n.id,
      { [props.propKey]: newArr } as Partial<SceneNode>,
      `Toggle ${props.propKey} visibility`
    )
  }
  if (nodes.length > 1) {
    editor.undo.commitBatch()
  }
}

providePropertyList({
  editor,
  propKey: props.propKey,
  items,
  isMixed,
  activeNode,
  isMulti,
  add,
  remove,
  update,
  patch,
  toggleVisibility
})
</script>

<template>
  <slot
    v-if="active"
    :items="items"
    :is-mixed="isMixed"
    :is-multi="isMulti"
    :active-node="activeNode"
    :add="add"
    :remove="remove"
    :update="update"
    :patch="patch"
    :toggle-visibility="toggleVisibility"
  />
</template>
