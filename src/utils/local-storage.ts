export function migrateLegacyLocalStorageValue(
  newKey: string,
  legacyKeys: string[]
): string | null {
  const current = localStorage.getItem(newKey)
  if (current !== null) return current

  for (const legacyKey of legacyKeys) {
    const legacyValue = localStorage.getItem(legacyKey)
    if (legacyValue === null) continue
    localStorage.setItem(newKey, legacyValue)
    localStorage.removeItem(legacyKey)
    return legacyValue
  }

  return null
}
