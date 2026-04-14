/**
 * library-github — GitHub publishing for design libraries.
 *
 * Uses the GitHub Contents API to upload .fig files to a public repo
 * (default: beresta-libraries). The raw download URL is shareable
 * so teammates can subscribe via library-url.
 *
 * Flow:
 *   1. User enters a Personal Access Token (repo scope).
 *   2. We validate it and fetch the GitHub username.
 *   3. We ensure the repo exists (create if not).
 *   4. On publish: base64-encode the .fig buffer, PUT to Contents API.
 *   5. Return the raw.githubusercontent.com URL.
 */

import { shallowRef } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubConfig {
  token: string
  owner: string // GitHub username
  repo: string  // repository name
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const CONFIG_KEY = 'beresta:github'

function loadConfig(): GitHubConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as GitHubConfig) : null
  } catch {
    return null
  }
}

function saveConfig(cfg: GitHubConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  } catch {
    console.warn('[library-github] Failed to save config')
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const _config = shallowRef<GitHubConfig | null>(loadConfig())
const _connecting = shallowRef(false)
const _publishing = shallowRef(false)
const _error = shallowRef<string | null>(null)
const _lastPublishedUrl = shallowRef<string | null>(null)

// Map libraryId → published URL (in-memory cache for current session)
const _publishedUrls = new Map<string, string>()

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

const GH_API = 'https://api.github.com'
const DEFAULT_REPO = 'beresta-libraries'

async function ghFetch<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const resp = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string>),
    },
  })
  if (!resp.ok) {
    let msg = `GitHub API ${resp.status}`
    try {
      const data = (await resp.json()) as { message?: string }
      if (data.message) msg = data.message
    } catch (parseErr) { console.warn('[library-github] Could not parse error body:', parseErr) }
    throw new Error(msg)
  }
  return resp.json() as Promise<T>
}

async function getOwner(token: string): Promise<string> {
  const user = await ghFetch<{ login: string }>('/user', token)
  return user.login
}

async function ensureRepo(token: string, owner: string, repo: string): Promise<void> {
  try {
    await ghFetch(`/repos/${owner}/${repo}`, token)
    return // repo exists
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('404')) throw err
  }
  // Create the repo
  await ghFetch('/user/repos', token, {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      description: 'Nork — shared design libraries',
      private: false,
      auto_init: true,
    }),
  })
  // Wait briefly for GitHub to initialise the default branch
  await new Promise<void>((r) => setTimeout(r, 1500))
}

interface GhFileResponse {
  sha?: string
  content?: { download_url?: string }
  download_url?: string
}

async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const file = await ghFetch<{ sha: string }>(`/repos/${owner}/${repo}/contents/${path}`, token)
    return file.sha
  } catch {
    return null // file doesn't exist yet
  }
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Validate a GitHub token and save the config.
 */
export async function connectGitHub(token: string, repo = DEFAULT_REPO): Promise<void> {
  _connecting.value = true
  _error.value = null
  try {
    const owner = await getOwner(token)
    const cfg: GitHubConfig = { token, owner, repo }
    _config.value = cfg
    saveConfig(cfg)
  } catch (err) {
    _error.value = err instanceof Error ? err.message : String(err)
    console.error('[library-github] Failed to connect:', err)
  } finally {
    _connecting.value = false
  }
}

/**
 * Publish a library buffer to GitHub. Returns the raw download URL.
 */
export async function publishLibrary(
  libraryId: string,
  name: string,
  buf: ArrayBuffer
): Promise<string> {
  const cfg = _config.value
  if (!cfg) throw new Error('GitHub не подключён')

  _publishing.value = true
  _error.value = null
  try {
    await ensureRepo(cfg.token, cfg.owner, cfg.repo)

    const filename = `${libraryId}.fig`
    const sha = await getFileSha(cfg.token, cfg.owner, cfg.repo, filename)

    const body: Record<string, string> = {
      message: `Update library: ${name}`,
      content: bufToBase64(buf),
    }
    if (sha) body['sha'] = sha

    await ghFetch<GhFileResponse>(`/repos/${cfg.owner}/${cfg.repo}/contents/${filename}`, cfg.token, {
      method: 'PUT',
      body: JSON.stringify(body),
    })

    const rawUrl = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/main/${filename}`
    _publishedUrls.set(libraryId, rawUrl)
    _lastPublishedUrl.value = rawUrl
    return rawUrl
  } catch (err) {
    _error.value = err instanceof Error ? err.message : String(err)
    console.error('[library-github] Failed to publish:', err)
    throw err
  } finally {
    _publishing.value = false
  }
}

export function getPublishedUrl(libraryId: string): string | null {
  return _publishedUrls.get(libraryId) ?? null
}

export function disconnectGitHub(): void {
  _config.value = null
  _error.value = null
  _lastPublishedUrl.value = null
  localStorage.removeItem(CONFIG_KEY)
}

export function clearError(): void {
  _error.value = null
}

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

export interface LibraryGitHubStore {
  config: typeof _config
  connecting: typeof _connecting
  publishing: typeof _publishing
  error: typeof _error
  lastPublishedUrl: typeof _lastPublishedUrl
  connectGitHub: typeof connectGitHub
  publishLibrary: typeof publishLibrary
  getPublishedUrl: typeof getPublishedUrl
  disconnectGitHub: typeof disconnectGitHub
  clearError: typeof clearError
}

const store: LibraryGitHubStore = {
  config: _config,
  connecting: _connecting,
  publishing: _publishing,
  error: _error,
  lastPublishedUrl: _lastPublishedUrl,
  connectGitHub,
  publishLibrary,
  getPublishedUrl,
  disconnectGitHub,
  clearError,
}

export function useLibraryGitHubStore(): LibraryGitHubStore {
  return store
}
