<script setup lang="ts">
import { useSettingsDialog } from '@/composables/use-settings-dialog'

const { show } = useSettingsDialog()
</script>

<template>
  <Tip label="AI settings">
    <button
      type="button"
      data-test-id="provider-settings-trigger"
      class="rounded p-0.5 text-muted hover:bg-hover hover:text-surface"
      @click="show()"
    >
      <icon-lucide-settings class="size-3" />
    </button>
  </Tip>
</template>
