import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getToken } from '@/api/client'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/home' },
  { path: '/login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  { path: '/signup', component: () => import('@/pages/SignupPage.vue'), meta: { public: true } },
  {
    path: '/tabs',
    component: () => import('@/pages/TabsPage.vue'),
    children: [
      { path: '', redirect: '/tabs/home' },
      { path: 'home', component: () => import('@/pages/DashboardPage.vue') },
      { path: 'search', component: () => import('@/pages/SearchPage.vue') },
      { path: 'add', component: () => import('@/pages/ItemFormPage.vue') },
      { path: 'places', component: () => import('@/pages/HomesPage.vue') },
      { path: 'profile', component: () => import('@/pages/ProfilePage.vue') },
    ],
  },
  { path: '/items/:id', component: () => import('@/pages/ItemDetailPage.vue') },
  { path: '/items/:id/edit', component: () => import('@/pages/ItemFormPage.vue') },
  { path: '/homes/:homeId/rooms', component: () => import('@/pages/RoomsPage.vue') },
  { path: '/rooms/:roomId/storage', component: () => import('@/pages/StoragePage.vue') },
  { path: '/categories', component: () => import('@/pages/CategoriesPage.vue') },
  { path: '/tags', component: () => import('@/pages/TagsPage.vue') },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// 인증 가드
router.beforeEach((to) => {
  const authed = !!getToken()
  if (!to.meta.public && !authed) {
    return '/login'
  }
  if (to.meta.public && authed) {
    return '/tabs/home'
  }
  return true
})

export default router
