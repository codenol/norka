export const ANALYTICS_SECTION_IDS = [
  'task',
  'users',
  'scenarios',
  'states',
  'constraints',
  'metrics',
  'importantNotes',
  'questions'
] as const

export type StructuredSection = (typeof ANALYTICS_SECTION_IDS)[number]

export type StructuredAnalyticsPayload = {
  section: StructuredSection
  answer: string
  nextQuestion: string
  readyToSave: boolean
}

const STRUCTURED_SECTION_SET: ReadonlySet<string> = new Set(ANALYTICS_SECTION_IDS)

export function extractStructuredJsonBlock(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match?.[0] ?? null
}

export function parseStructuredAnalyticsPayload(raw: string): StructuredAnalyticsPayload | null {
  const jsonBlock = extractStructuredJsonBlock(raw)
  if (!jsonBlock) return null
  try {
    const parsed = JSON.parse(jsonBlock) as Record<string, unknown>
    const sectionRaw = parsed.section
    const answerRaw = parsed.answer
    const nextQuestionRaw = parsed.nextQuestion
    const readyRaw = parsed.readyToSave
    if (
      typeof sectionRaw !== 'string' ||
      !STRUCTURED_SECTION_SET.has(sectionRaw) ||
      typeof answerRaw !== 'string' ||
      typeof nextQuestionRaw !== 'string'
    ) {
      return null
    }
    const normalizedAnswer = answerRaw.trim()
    const normalizedNextQuestion = nextQuestionRaw.trim()
    const normalizedReadyToSave =
      typeof readyRaw === 'boolean'
        ? readyRaw
        : normalizedAnswer.length > 0 && normalizedNextQuestion.length === 0
    return {
      section: sectionRaw as StructuredSection,
      answer: normalizedAnswer,
      nextQuestion: normalizedNextQuestion,
      readyToSave: normalizedReadyToSave
    }
  } catch {
    return null
  }
}
