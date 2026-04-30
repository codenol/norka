import { computed, ref, watch } from 'vue'

import type { FeatureCommentRole } from './use-workspace-fs'

export interface WorkspaceUser {
  id: string
  login: string
  name: string
  role: FeatureCommentRole
}

const USER_STORAGE_KEY = 'norka:workspace-user-id'
const AUTH_STORAGE_KEY = 'norka:workspace-authenticated'

export const WORKSPACE_USERS: WorkspaceUser[] = [
  { id: 'designer-vika', login: 'v.petrova', name: 'Вика Петрова', role: 'designer' },
  { id: 'analyst-anna', login: 'a.smirnova', name: 'Анна Смирнова', role: 'analyst' },
  { id: 'frontend-fedor', login: 'f.ivanov', name: 'Фёдор Иванов', role: 'frontend' },
  { id: 'backend-boris', login: 'b.orlov', name: 'Борис Орлов', role: 'backend' }
]

const DEFAULT_WORKSPACE_USER: WorkspaceUser = WORKSPACE_USERS[0] ?? {
  id: 'designer-vika',
  login: 'v.petrova',
  name: 'Вика Петрова',
  role: 'designer'
}
const storedUserId =
  typeof localStorage === 'undefined' ? null : localStorage.getItem(USER_STORAGE_KEY)
const currentUserId = ref(storedUserId ?? DEFAULT_WORKSPACE_USER.id)
const authenticated = ref(
  typeof localStorage === 'undefined' ? false : localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
)

watch(currentUserId, (userId) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(USER_STORAGE_KEY, userId)
})

watch(authenticated, (value) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(AUTH_STORAGE_KEY, String(value))
})

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return (parts[0]?.slice(0, 2) ?? '').toUpperCase()
}

export function roleLabel(role?: FeatureCommentRole): string {
  switch (role) {
    case 'analyst':
      return 'Аналитик'
    case 'frontend':
      return 'Фронт'
    case 'backend':
      return 'Бэк'
    case 'designer':
    default:
      return 'Дизайнер'
  }
}

export function roleTitle(role?: FeatureCommentRole): string {
  switch (role) {
    case 'analyst':
      return 'Системный аналитик'
    case 'frontend':
      return 'Frontend разработчик'
    case 'backend':
      return 'Backend разработчик'
    case 'designer':
    default:
      return 'Продуктовый дизайнер'
  }
}

export function useWorkspaceUser() {
  const currentUser = computed(
    () => WORKSPACE_USERS.find((user) => user.id === currentUserId.value) ?? DEFAULT_WORKSPACE_USER
  )

  function selectUser(userId: string) {
    if (!WORKSPACE_USERS.some((user) => user.id === userId)) return
    currentUserId.value = userId
  }

  function login(userId: string) {
    selectUser(userId)
    authenticated.value = true
  }

  function logout() {
    authenticated.value = false
  }

  return {
    currentUser,
    currentUserId,
    isAuthenticated: authenticated,
    users: WORKSPACE_USERS,
    selectUser,
    login,
    logout
  }
}
