import { describe, expect, it } from 'bun:test'

import { getPrimePreviewDef, normalizePrimeProps } from '@/composables/use-primereact-preview'

describe('primereact preview registry', () => {
  it('defines Dialog as container with required onHide callback', () => {
    const dialog = getPrimePreviewDef('Dialog')
    expect(dialog?.acceptsChildren).toBe(true)
    expect(dialog?.requiredCallbacks).toContain('onHide')
  })

  it('injects safe callback defaults for Dialog props', () => {
    const normalized = normalizePrimeProps('Dialog', { header: 'My dialog', visible: true })
    expect(typeof normalized.onHide).toBe('function')
    expect(normalized.visible).toBe(true)
  })
})
