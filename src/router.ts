import { createRouter, createWebHistory } from 'vue-router'

import EditorView from './views/EditorView.vue'
import WorkspaceLayout from './layouts/WorkspaceLayout.vue'

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
    { path: '/library',   redirect: '/libraries' },
    { path: '/library/:id', component: () => import('./views/workspaces/LibraryWorkspaceView.vue') },

    // Workspace pipeline (4 steps)
    {
      path: '/workspace',
      component: WorkspaceLayout,
      children: [
        { path: '', redirect: '/home' },
        {
          path: 'analytics',
          component: () => import('./views/workspaces/AnalyticsView.vue'),
        },
        {
          path: 'design',
          component: () => import('./views/workspaces/DesignWorkspaceView.vue'),
        },
        {
          path: 'discussion',
          component: () => import('./views/workspaces/DiscussionView.vue'),
        },
        {
          path: 'handoff',
          component: () => import('./views/workspaces/HandoffView.vue'),
        },
      ],
    },
  ],
})

export default router
