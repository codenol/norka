import dynamicIconImports from 'lucide-react/dynamicIconImports'

type UnknownRecord = Record<string, unknown>

export const FULL_LUCIDE_ICON_LIST = Object.freeze(
  Object.keys(dynamicIconImports).sort((a, b) => a.localeCompare(b))
)

export const DEFAULT_LUCIDE_FALLBACK_ICON = 'circle'

export interface IconPolicy {
  possibleIcons: readonly string[]
  fallbackIcon: string
}

function normalizeIconName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export function resolveIconPolicy(meta: unknown): IconPolicy {
  const fallbackFromMeta =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? normalizeIconName((meta as UnknownRecord).fallbackIcon)
      : null
  const fallbackIcon = fallbackFromMeta ?? DEFAULT_LUCIDE_FALLBACK_ICON
  const possibleIconsRaw =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as UnknownRecord).possibleIcons
      : undefined
  const possibleIcons = Array.isArray(possibleIconsRaw)
    ? Array.from(
        new Set(
          possibleIconsRaw
            .map((icon) => normalizeIconName(icon))
            .filter((icon): icon is string => icon !== null)
        )
      )
    : [...FULL_LUCIDE_ICON_LIST]
  if (!possibleIcons.includes(fallbackIcon)) possibleIcons.push(fallbackIcon)
  return { possibleIcons, fallbackIcon }
}

export function sanitizeIconName(raw: unknown, policy: IconPolicy): string | null {
  const normalized = normalizeIconName(raw)
  if (!normalized) return null
  return policy.possibleIcons.includes(normalized) ? normalized : policy.fallbackIcon
}

export function hasIconProps(props: UnknownRecord): boolean {
  return 'icon' in props || 'iconLeft' in props || 'iconRight' in props
}
