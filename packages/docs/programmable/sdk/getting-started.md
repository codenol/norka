---
title: SDK Getting Started
description: Set up @beresta/vue with createEditor, provideEditor, and a canvas.
---

# SDK Getting Started

## Installation

```bash
bun add @beresta/core @beresta/vue canvaskit-wasm
```

The SDK lives in the monorepo today and is also published as `@beresta/vue`.

```ts
import { createEditor } from '@beresta/core/editor'
import { provideEditor, useCanvas } from '@beresta/vue'
```

## Mental model

There are three layers:

1. `@beresta/core` — framework-agnostic editor engine
2. `@beresta/vue` — Vue composables and headless primitives
3. your app — styling, routing, file flows, product-specific UI

## Minimal setup

### 1. Create an editor

```ts
import { createEditor } from '@beresta/core/editor'

const editor = createEditor({
  width: 1200,
  height: 800,
})
```

### 2. Provide it to Vue

```vue
<script setup lang="ts">
import { provideEditor } from '@beresta/vue'

import type { Editor } from '@beresta/core/editor'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

You can think of this as the provider layer for the editor tree. The docs prefer `provideEditor()` directly because that is the current real API surface.

### 3. Attach a canvas

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor } from '@beresta/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()

useCanvas(canvasRef, editor)
</script>

<template>
  <canvas ref="canvasRef" class="size-full" />
</template>
```

## Using composables

Once the editor is provided, child components can read selection and issue commands:

```ts
import { useEditorCommands, useSelectionState } from '@beresta/vue'

const selection = useSelectionState()
const commands = useEditorCommands()
```

## Basic example

```vue
<script setup lang="ts">
import { ref } from 'vue'

import { useCanvas, useEditor, useSelectionState } from '@beresta/vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const editor = useEditor()
const { selectedCount } = useSelectionState()

useCanvas(canvasRef, editor, {
  onReady: () => {
    console.log('Canvas ready')
  },
})
</script>

<template>
  <div class="grid h-full grid-rows-[1fr_auto]">
    <canvas ref="canvasRef" class="size-full" />
    <div class="border-t px-3 py-2 text-xs text-muted">
      Selected: {{ selectedCount }}
    </div>
  </div>
</template>
```

## Next steps

- [Architecture](./architecture)
- [API Reference](./api/)
- [useEditor](./api/composables/use-editor)
- [useCanvas](./api/composables/use-canvas)
- [useI18n](./api/composables/use-i18n)
