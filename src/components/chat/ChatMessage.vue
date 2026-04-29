<script setup lang="ts">
import { isTextUIPart, isToolUIPart, getToolName } from 'ai'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { ref } from 'vue'
import { Markdown } from 'vue-stream-markdown'
import 'vue-stream-markdown/index.css'

import { parseStructuredAnalyticsPayload } from '@/utils/analytics-chat'

import type { PropType } from 'vue'
import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'
import type { StructuredAnalyticsPayload } from '@/utils/analytics-chat'

const {
  message,
  isAnalyticsMode,
  onImportStructuredAnalytics,
  isStructuredAnalyticsMessageImported
} =
  defineProps({
    message: { type: Object as PropType<UIMessage>, required: true },
    isAnalyticsMode: { type: Boolean, default: false },
    onImportStructuredAnalytics: {
      type: Function as PropType<(message: UIMessage) => void>,
      required: false
    },
    isStructuredAnalyticsMessageImported: {
      type: Function as PropType<(messageId: string) => boolean>,
      required: false
    }
})

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>
const copied = ref(false)

function toolDisplayName(part: ToolPart): string {
  return getToolName(part)
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function hasErrorOutput(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    typeof part.output === 'object' &&
    part.output !== null &&
    'error' in part.output
  )
}

function getToolOutputText(part: ToolPart): string {
  if (part.state === 'output-error' && part.errorText) return part.errorText
  if (hasErrorOutput(part)) return (part.output as { error: string }).error
  return JSON.stringify(part.output, null, 2)
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  if (part.state === 'output-error' || hasErrorOutput(part)) return 'error'
  if (part.state === 'output-available') return 'done'
  return 'pending'
}

function partKey(part: UIMessagePart<UIDataTypes, UITools>, index: number): string {
  if ('toolCallId' in part) return part.toolCallId
  return `part-${index}`
}

function structuredAnalyticsPayload(text: string): StructuredAnalyticsPayload | null {
  if (!isAnalyticsMode) return null
  return parseStructuredAnalyticsPayload(text)
}

function shouldRenderStructuredAnalytics(text: string): boolean {
  return Boolean(structuredAnalyticsPayload(text))
}

function isStructuredAnalyticsImported(): boolean {
  return isStructuredAnalyticsMessageImported?.(message.id) ?? false
}

function importStructuredAnalytics() {
  onImportStructuredAnalytics?.(message)
}

function buildVisibleAnalyticsText(payload: StructuredAnalyticsPayload): string {
  const lines: string[] = []
  if (payload.readyToSave && payload.answer) {
    lines.push(`Раздел: ${payload.section}`)
    lines.push(payload.answer)
  }
  if (payload.nextQuestion) {
    lines.push(payload.nextQuestion)
  }
  return lines.join('\n\n').trim()
}

function buildCopyText() {
  const lines: string[] = []
  for (const part of message.parts) {
    if (isTextUIPart(part) && part.text) {
      const payload = structuredAnalyticsPayload(part.text)
      lines.push(payload ? buildVisibleAnalyticsText(payload) : part.text)
      continue
    }
    if (isToolUIPart(part)) {
      const output = getToolOutputText(part)
      lines.push(`[${toolDisplayName(part)}]`)
      lines.push(output ?? '')
    }
  }
  return lines.join('\n\n').trim()
}

async function copyMessage() {
  const text = buildCopyText()
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1200)
}
</script>

<template>
  <div
    v-if="message?.role"
    :data-test-id="`chat-message-${message.role}`"
    :class="message.role === 'user' ? 'flex justify-end' : 'flex'"
  >
    <div
      class="flex min-w-0 max-w-[82%] items-start gap-1.5"
      :class="message.role === 'user' ? 'ml-auto flex-row-reverse' : ''"
    >
      <div class="min-w-0 w-full space-y-1.5">
        <template v-if="message.role === 'assistant'">
          <template v-for="(part, i) in message.parts" :key="partKey(part, i)">
            <!-- Tool call -->
            <div v-if="isToolUIPart(part)" class="rounded-lg border border-border bg-canvas p-2">
              <CollapsibleRoot>
                <CollapsibleTrigger
                  class="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-hover"
                >
                  <div
                    class="flex size-4 items-center justify-center rounded-full"
                    :class="{
                      'bg-accent/20 text-accent': toolState(part) === 'pending',
                      'bg-green-500/20 text-green-400': toolState(part) === 'done',
                      'bg-red-500/20 text-red-400': toolState(part) === 'error'
                    }"
                  >
                    <icon-lucide-loader-circle
                      v-if="toolState(part) === 'pending'"
                      class="size-3 animate-spin"
                    />
                    <icon-lucide-check v-else-if="toolState(part) === 'done'" class="size-3" />
                    <icon-lucide-triangle-alert v-else class="size-3" />
                  </div>
                  <span class="text-[11px] text-surface">
                    {{ toolDisplayName(part) }}
                  </span>
                  <span class="text-[10px] text-muted">
                    {{
                      toolState(part) === 'pending'
                        ? 'Running…'
                        : toolState(part) === 'done'
                          ? 'Done'
                          : 'Error'
                    }}
                  </span>
                  <icon-lucide-chevron-down
                    v-if="toolState(part) !== 'pending'"
                    class="ml-auto size-3 text-muted transition-transform [[data-state=open]>&]:rotate-180"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent
                  v-if="toolState(part) !== 'pending'"
                  class="data-[state=closed]:collapsible-up data-[state=open]:collapsible-down overflow-hidden text-[10px]"
                >
                  <pre class="mt-1 overflow-x-auto rounded bg-input p-2 text-muted">{{
                    getToolOutputText(part)
                  }}</pre>
                </CollapsibleContent>
              </CollapsibleRoot>
            </div>

            <!-- Text -->
            <div
              v-else-if="isTextUIPart(part) && part.text"
              data-test-id="chat-text-bubble"
              class="w-full rounded-xl rounded-tl-md bg-hover px-3 py-2 text-xs leading-relaxed text-surface"
            >
              <template v-if="shouldRenderStructuredAnalytics(part.text)">
                <div class="flex flex-col gap-2">
                  <button
                    v-if="
                      structuredAnalyticsPayload(part.text)?.readyToSave &&
                      structuredAnalyticsPayload(part.text)?.answer
                    "
                    type="button"
                    class="inline-flex w-fit items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-left text-xs font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isStructuredAnalyticsImported()"
                    @click="importStructuredAnalytics"
                  >
                    <icon-lucide-download class="size-3.5" />
                    {{
                      isStructuredAnalyticsImported()
                        ? 'Уже загружено в analytics.md'
                        : 'Загрузить в analytics.md'
                    }}
                  </button>
                  <p
                    v-if="structuredAnalyticsPayload(part.text)?.nextQuestion"
                    class="whitespace-pre-wrap text-xs leading-relaxed text-surface"
                  >
                    {{ structuredAnalyticsPayload(part.text)?.nextQuestion }}
                  </p>
                  <p
                    v-else-if="!structuredAnalyticsPayload(part.text)?.readyToSave"
                    class="whitespace-pre-wrap text-xs leading-relaxed text-surface"
                  >
                    Жду уточнений по этому разделу.
                  </p>
                </div>
              </template>
              <Markdown v-else :content="part.text" :mermaid="false" class="chat-markdown" />
            </div>
          </template>
        </template>

        <!-- User message -->
        <div
          v-else-if="message.role === 'user'"
          data-test-id="chat-text-bubble"
          class="w-full rounded-xl rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-white"
        >
          {{
            message.parts
              .filter(isTextUIPart)
              .map((p) => p.text)
              .join('')
          }}
        </div>
      </div>
      <button
        class="mt-1 inline-flex shrink-0 items-center justify-center rounded p-1 text-muted transition-colors hover:bg-hover hover:text-surface"
        :aria-label="copied ? 'Скопировано' : 'Копировать сообщение'"
        :title="copied ? 'Скопировано' : 'Копировать'"
        @click="copyMessage"
      >
        <icon-lucide-check v-if="copied" class="size-3" />
        <icon-lucide-copy v-else class="size-3" />
      </button>
    </div>
  </div>
</template>
