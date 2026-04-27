import type { Command as ShellCommand } from '@tauri-apps/plugin-shell'

import { decodeTauriStderr } from '@/utils/tauri'
import { AUTOMATION_HTTP_PORT, IS_TAURI, randomHex } from '@norka/core'

interface AutomationHealth {
  status: 'ok' | 'no_app'
  authRequired?: boolean
  token?: string
}

export interface AutomationServerHandle {
  disconnect: () => void
  authToken: string | null
}

const DEV_AUTOMATION_AUTH_TOKEN = import.meta.env.DEV ? __NORKA_LOCAL_AUTOMATION_TOKEN__ : null
const noop = () => undefined

let runtimeAutomationAuthToken: string | null = DEV_AUTOMATION_AUTH_TOKEN

async function readHealth(): Promise<AutomationHealth | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`, {
      signal: AbortSignal.timeout(1500)
    })
    if (!res.ok) return null
    return (await res.json()) as AutomationHealth
  } catch {
    return null
  }
}

async function pollHealth(retries: number, delayMs: number): Promise<AutomationHealth | null> {
  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, delayMs))
    const health = await readHealth()
    if (health) return health
  }
  return null
}

/** Kills any process listening on `port` (macOS only, best-effort). */
async function freePort(Command: typeof ShellCommand, port: number): Promise<void> {
  try {
    const lsof = await Command.create('lsof', ['-ti', `:${port}`]).execute()
    const pid = lsof.stdout.trim()
    if (pid) {
      await Command.create('kill', ['-9', pid]).execute()
      // Brief wait for the OS to release the port
      await new Promise((r) => setTimeout(r, 400))
    }
  } catch (e) {
    console.warn('[MCP] freePort error:', e)
  }
}

export async function getAutomationAuthToken(): Promise<string | null> {
  if (runtimeAutomationAuthToken) return runtimeAutomationAuthToken
  const health = await readHealth()
  runtimeAutomationAuthToken = health?.token ?? null
  return runtimeAutomationAuthToken
}

export async function spawnMCPIfNeeded(): Promise<AutomationServerHandle | null> {
  if (import.meta.env.DEV || !IS_TAURI) {
    return DEV_AUTOMATION_AUTH_TOKEN
      ? { disconnect: noop, authToken: DEV_AUTOMATION_AUTH_TOKEN }
      : null
  }

  // If an MCP server is already running, reuse it
  const existing = await readHealth()
  if (existing) {
    runtimeAutomationAuthToken = existing.token ?? null
    return {
      disconnect: noop,
      authToken: runtimeAutomationAuthToken
    }
  }

  const { Command } = await import('@tauri-apps/plugin-shell')

  // Kill any stale process occupying the MCP ports before spawning a fresh server.
  await freePort(Command, AUTOMATION_HTTP_PORT)
  await freePort(Command, AUTOMATION_HTTP_PORT + 1) // WS = HTTP + 1

  const authToken = randomHex(32)
  runtimeAutomationAuthToken = authToken
  const command = Command.sidecar('binaries/norka-mcp', [], {
    env: {
      NORKA_MCP_AUTH_TOKEN: authToken,
      NORKA_MCP_CORS_ORIGIN: window.location.origin
    }
  })

  let spawnLog = ''
  command.stdout.on('data', (raw: Uint8Array | number[] | string) => {
    spawnLog += decodeTauriStderr(raw)
  })
  command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
    spawnLog += decodeTauriStderr(raw)
  })

  const exitInfo = { code: null as number | null }
  command.on('close', (data: { code: number | null }) => {
    exitInfo.code = data.code ?? -1
    console.error(`[MCP] Server exited (code ${exitInfo.code})`)
  })

  const child = await command.spawn()

  // Give the bun sidecar up to 20 s to start — first run on macOS can be slow
  // due to Gatekeeper checks on the unsigned binary.
  const health = await pollHealth(20, 1000)

  if (health) {
    runtimeAutomationAuthToken = health.token ?? authToken
    return {
      disconnect: () => {
        void child.kill()
      },
      authToken: runtimeAutomationAuthToken
    }
  }

  await child.kill()
  const parts: string[] = []
  if (spawnLog.trim()) parts.push(`Output:\n${spawnLog.trim().slice(0, 600)}`)
  if (exitInfo.code !== null) parts.push(`Exit code: ${exitInfo.code}`)
  const detail = parts.length ? `\n\n${parts.join('\n')}` : '\n\nNo output from process.'
  throw new Error(`Failed to start the built-in MCP server.${detail}`)
}
