<script setup lang="ts">
import { computed } from 'vue'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { useI18n } from '@beresta/vue'
import { useAIChat } from '@/composables/use-chat'
import { useLinterStore } from '@/stores/linter'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'
import LintPanel from './LintPanel.vue'
import SnapshotsPanel from './SnapshotsPanel.vue'
import ZoomDropdown from './ZoomDropdown.vue'

const { activeTab } = useAIChat()
const { panels } = useI18n()

const linter = useLinterStore()
const lintErrorCount = computed(() => linter.results.value?.errorCount ?? 0)
const lintWarningCount = computed(() => linter.results.value?.warningCount ?? 0)
const lintBadgeCount = computed(() => lintErrorCount.value || lintWarningCount.value)
</script>

<template>
  <aside
    data-test-id="properties-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
        <TabsTrigger
          value="design"
          data-test-id="properties-tab-design"
          class="rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          {{ panels.design }}
        </TabsTrigger>
        <TabsTrigger
          value="code"
          data-test-id="properties-tab-code"
          class="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-code class="size-3" />
          {{ panels.code }}
        </TabsTrigger>
        <TabsTrigger
          value="ai"
          data-test-id="properties-tab-ai"
          class="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-sparkles class="size-3" />
          {{ panels.ai }}
        </TabsTrigger>
        <TabsTrigger
          value="lint"
          data-test-id="properties-tab-lint"
          class="relative flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-shield-check class="size-3" />
          {{ panels.lint }}
          <!-- Badge: shows error count if > 0, else warning count -->
          <span
            v-if="lintBadgeCount > 0"
            class="absolute -right-1 -top-0.5 flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white leading-none"
            :class="lintErrorCount > 0 ? 'bg-error' : 'bg-warning'"
          >
            {{ lintBadgeCount > 9 ? '9+' : lintBadgeCount }}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="snapshots"
          data-test-id="properties-tab-snapshots"
          class="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          <icon-lucide-history class="size-3" />
          {{ panels.snapshots }}
        </TabsTrigger>
        <ZoomDropdown v-if="activeTab === 'design'" />
      </TabsList>

      <TabsContent
        value="design"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'design'"
      >
        <DesignPanel />
      </TabsContent>

      <TabsContent
        value="code"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'code'"
      >
        <CodePanel />
      </TabsContent>

      <TabsContent
        value="ai"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'ai'"
      >
        <ChatPanel />
      </TabsContent>

      <TabsContent
        value="lint"
        data-test-id="properties-tab-lint-content"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'lint'"
      >
        <LintPanel v-if="activeTab === 'lint'" />
      </TabsContent>

      <TabsContent
        value="snapshots"
        data-test-id="properties-tab-snapshots-content"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'snapshots'"
      >
        <SnapshotsPanel v-if="activeTab === 'snapshots'" />
      </TabsContent>
    </TabsRoot>
  </aside>
</template>
