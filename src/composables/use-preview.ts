import { ref } from 'vue'

import { selectionToJSX } from '@beresta/core'

import { useAIChat } from '@/composables/use-chat'
import { getActiveEditorStore } from '@/stores/editor'

// Singleton state
const isOpen = ref(false)
const isGenerating = ref(false)
const htmlCode = ref<string | null>(null)
const error = ref<string | null>(null)
let lastNodeKey = ''

function buildSrcdoc(componentCode: string): string {
  // Use string concatenation to avoid linter complaints about escape sequences
  const closeScript = '<' + '/script>'
  return (
    `<!DOCTYPE html>\n<html>\n<head>\n` +
    `  <meta charset="utf-8" />\n` +
    `  <meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
    `  <script src="https://unpkg.com/react@18/umd/react.development.js">${closeScript}\n` +
    `  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js">${closeScript}\n` +
    `  <script src="https://unpkg.com/@babel/standalone/babel.min.js">${closeScript}\n` +
    `  <script src="https://cdn.tailwindcss.com">${closeScript}\n` +
    `</head>\n<body>\n  <div id="root"></div>\n` +
    `  <script type="text/babel">\n${componentCode}\n` +
    `    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component));\n` +
    `  ${closeScript}\n</body>\n</html>`
  )
}

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:jsx?|tsx?|html?)?\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

export function usePreview() {
  function toggle() {
    isOpen.value = !isOpen.value
  }

  function close() {
    isOpen.value = false
  }

  async function generate() {
    const store = getActiveEditorStore()
    const { ensureChat } = useAIChat()

    const selectedNodes = store.getSelectedNodes()
    const selectedIds = selectedNodes.map((n: { id: string }) => n.id)

    // Find first FRAME on current page as fallback
    function findFirstFrame(): string[] {
      const page = store.graph.getNode(store.state.currentPageId)
      if (!page) return []
      for (const childId of page.childIds) {
        const child = store.graph.getNode(childId)
        if (child?.type === 'FRAME') return [childId]
      }
      return []
    }

    const nodeIds = selectedIds.length > 0 ? selectedIds : findFirstFrame()

    if (nodeIds.length === 0) {
      error.value = 'Выберите фрейм или создайте его на холсте'
      return
    }

    const key = nodeIds.sort().join(',')
    if (key === lastNodeKey && htmlCode.value) return // cached

    isGenerating.value = true
    error.value = null
    htmlCode.value = null

    try {
      // Try to get JSX from the scene graph
      const jsx = selectionToJSX(nodeIds, store.graph, 'tailwind')

      if (jsx) {
        const componentCode = `const Component = () => (\n${jsx}\n);`
        htmlCode.value = buildSrcdoc(componentCode)
        lastNodeKey = key
        return
      }

      // Fallback: ask LLM to generate code
      const chat = await ensureChat()
      if (!chat) {
        error.value = 'Подключите AI-провайдера для генерации кода'
        return
      }

      const jsxFallback = selectionToJSX(nodeIds, store.graph, 'tailwind') || 'Нет данных — создай примерный макет.'
      const prompt = [
        'Сгенерируй самодостаточный React-компонент для iframe-предпросмотра.',
        'Требования: Tailwind CDN, без import/export, экспортируй как `const Component = () => ...`.',
        '',
        '## Дизайн (JSX-структура):',
        jsxFallback,
        '',
        'Верни только код в блоке ```jsx```.'
      ].join('\n')

      await chat.sendMessage({ text: prompt })

      // Wait for response to complete
      await new Promise<void>((resolve) => {
        const check = () => {
          const status = chat.status
          if (status === 'ready' || status === 'error') {
            resolve()
          } else {
            setTimeout(check, 200)
          }
        }
        check()
      })

      const last = chat.messages.at(-1)
      const parts: Array<{ type: string; text?: string }> = last ? (last.parts as Array<{ type: string; text?: string }>) : []
      const textPart = parts.find((p) => p.type === 'text')
      const responseText = textPart?.text ?? ''
      const code = extractCodeBlock(responseText)

      if (code) {
        htmlCode.value = buildSrcdoc(code)
        lastNodeKey = key
      } else {
        error.value = 'Не удалось извлечь код из ответа'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isGenerating.value = false
    }
  }

  function reset() {
    htmlCode.value = null
    error.value = null
    lastNodeKey = ''
  }

  return {
    isOpen,
    isGenerating,
    htmlCode,
    error,
    toggle,
    close,
    generate,
    reset
  }
}
