import { createRouter, createWebHistory } from 'vue-router'

import { useProjects } from '@/composables/use-projects'
import { buildWorkspacePath } from '@/utils/workspace-route'

import WorkspaceLayout from './layouts/WorkspaceLayout.vue'
import EditorView from './views/EditorView.vue'

import type { NavigationGuard } from 'vue-router'

const { findFeature, context, setContext } = useProjects()

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

function redirectLegacyWorkspace(step: 'analytics' | 'design' | 'discussion' | 'handoff'): string {
  if (!context.value) return '/projects'
  return buildWorkspacePath(step, context.value)
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
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
          beforeEnter: ensureWorkspaceContext,
          component: () => import('./views/workspaces/DiscussionView.vue')
        },
        {
          path: ':productId/:screenId/:featureId/handoff',
          beforeEnter: ensureWorkspaceContext,
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

export default router
