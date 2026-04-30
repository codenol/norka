import { createRouter, createWebHistory } from 'vue-router'

import { useProjects } from '@/composables/use-projects'
import { useWorkspaceUser } from '@/composables/use-workspace-user'
import {
  readFeatureComments,
  readFeatureVersions,
  workspacePath as workspaceRoot
} from '@/composables/use-workspace-fs'
import { buildWorkspacePath } from '@/utils/workspace-route'

import WorkspaceLayout from './layouts/WorkspaceLayout.vue'
import EditorView from './views/EditorView.vue'

import type { NavigationGuard } from 'vue-router'

const { findFeature, context, setContext, consumeHandoffAccess } = useProjects()
const { isAuthenticated } = useWorkspaceUser()

const ensureWorkspaceContext: NavigationGuard = (to) => {
  const productId = typeof to.params.productId === 'string' ? to.params.productId : null
  const screenId = typeof to.params.screenId === 'string' ? to.params.screenId : null
  const featureId = typeof to.params.featureId === 'string' ? to.params.featureId : null
  if (!productId || !screenId || !featureId) return '/projects'

  const feature = findFeature(productId, screenId, featureId)
  if (!feature) return '/projects'

  setContext(productId, screenId, featureId)
  return true
}

const ensureHandoffAccess: NavigationGuard = async (to) => {
  const productId = typeof to.params.productId === 'string' ? to.params.productId : null
  const screenId = typeof to.params.screenId === 'string' ? to.params.screenId : null
  const featureId = typeof to.params.featureId === 'string' ? to.params.featureId : null
  if (!productId || !screenId || !featureId) return '/projects'
  const versionId = consumeHandoffAccess(productId, screenId, featureId)
  if (!versionId) {
    return buildWorkspacePath('discussion', { productId, screenId, featureId })
  }

  const root = workspaceRoot.value ?? 'browser'
  const [versions, comments] = await Promise.all([
    readFeatureVersions(root, productId, screenId, featureId),
    readFeatureComments(root, productId, screenId, featureId)
  ])
  const targetVersion = versions.find((version) => version.id === versionId)
  if (!targetVersion) {
    return buildWorkspacePath('discussion', { productId, screenId, featureId })
  }
  if (targetVersion.status !== 'ready_for_handoff' && targetVersion.status !== 'handed_off') {
    return buildWorkspacePath('discussion', { productId, screenId, featureId })
  }
  const unresolved = comments.some(
    (comment) =>
      comment.versionId === targetVersion.id &&
      !(
        comment.status === 'resolved' ||
        comment.statuses?.includes('resolved') ||
        comment.statuses?.includes('wont_do')
      )
  )
  if (unresolved) {
    return buildWorkspacePath('discussion', { productId, screenId, featureId })
  }
  return true
}

const ensureDiscussionAccess: NavigationGuard = async (to) => {
  const productId = typeof to.params.productId === 'string' ? to.params.productId : null
  const screenId = typeof to.params.screenId === 'string' ? to.params.screenId : null
  const featureId = typeof to.params.featureId === 'string' ? to.params.featureId : null
  if (!productId || !screenId || !featureId) return '/projects'
  const versions = await readFeatureVersions(workspaceRoot.value ?? 'browser', productId, screenId, featureId)
  if (!versions.some((version) => !version.isArchived)) {
    return buildWorkspacePath('design', { productId, screenId, featureId })
  }
  return true
}

function redirectLegacyWorkspace(step: 'analytics' | 'design' | 'discussion' | 'handoff'): string {
  if (!context.value) return '/projects'
  return buildWorkspacePath(step, context.value)
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/editor', component: EditorView },
    { path: '/demo', component: EditorView, meta: { demo: true } },
    { path: '/share/:roomId', component: EditorView },

    // Hub
    { path: '/home', component: () => import('./views/HomeView.vue') },

    // Top-level: Project Navigator
    { path: '/projects', component: () => import('./views/ProjectNavigatorView.vue') },

    // Top-level: Libraries
    { path: '/libraries', component: () => import('./views/LibrariesView.vue') },
    { path: '/library', redirect: '/libraries' },
    {
      path: '/library/:id',
      component: () => import('./views/workspaces/LibraryWorkspaceView.vue')
    },

    // Workspace pipeline (4 steps)
    {
      path: '/workspace',
      component: WorkspaceLayout,
      children: [
        { path: '', redirect: '/home' },
        {
          path: ':productId/:screenId/:featureId/analytics',
          beforeEnter: ensureWorkspaceContext,
          component: () => import('./views/workspaces/AnalyticsView.vue')
        },
        {
          path: ':productId/:screenId/:featureId/design',
          beforeEnter: ensureWorkspaceContext,
          component: () => import('./views/workspaces/DesignWorkspaceView.vue')
        },
        {
          path: ':productId/:screenId/:featureId/discussion',
          beforeEnter: [ensureWorkspaceContext, ensureDiscussionAccess],
          component: () => import('./views/workspaces/DiscussionView.vue')
        },
        {
          path: ':productId/:screenId/:featureId/handoff',
          beforeEnter: [ensureWorkspaceContext, ensureHandoffAccess],
          component: () => import('./views/workspaces/HandoffView.vue')
        },
        { path: 'analytics', redirect: () => redirectLegacyWorkspace('analytics') },
        { path: 'design', redirect: () => redirectLegacyWorkspace('design') },
        { path: 'discussion', redirect: () => redirectLegacyWorkspace('discussion') },
        { path: 'handoff', redirect: () => redirectLegacyWorkspace('handoff') }
      ]
    }
  ]
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  if (isAuthenticated.value) return true
  return {
    path: '/login',
    query: to.fullPath === '/' ? undefined : { redirect: to.fullPath }
  }
})

export default router
