import { createRouter, createWebHistory } from '@ionic/vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { getToken } from '@/api/client'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/tabs/home' },
  { path: '/login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
  // 웹 소셜 로그인 복귀. 로그인 전에 열리므로 공개, 이미 로그인돼 있어도 그대로 처리한다.
  { path: '/auth/callback', component: () => import('@/pages/AuthCallbackPage.vue'), meta: { public: true, callback: true } },
  // 스토어 등록에 쓰는 공개 문서. 로그인 여부와 상관없이 열린다.
  { path: '/terms', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, open: true, doc: 'terms' } },
  { path: '/privacy', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, open: true, doc: 'privacy' } },
  { path: '/account-deletion', component: () => import('@/pages/LegalPage.vue'), meta: { public: true, open: true, doc: 'account-deletion' } },
  {
    path: '/tabs',
    component: () => import('@/pages/TabsPage.vue'),
    children: [
      { path: '', redirect: '/tabs/home' },
      { path: 'home', component: () => import('@/pages/DashboardPage.vue') },
      { path: 'search', component: () => import('@/pages/SearchPage.vue') },
      { path: 'add', component: () => import('@/pages/ItemFormPage.vue') },
      { path: 'box', component: () => import('@/pages/BoxPage.vue') },
      // 예전 탭 주소. 보관 장소 관리는 내 정보 메뉴(/places)로 옮겼다.
      { path: 'places', redirect: '/places' },
      { path: 'profile', component: () => import('@/pages/ProfilePage.vue') },
    ],
  },
  { path: '/items/:id', component: () => import('@/pages/ItemDetailPage.vue') },
  { path: '/items/:id/edit', component: () => import('@/pages/ItemFormPage.vue') },
  // 보관 장소 관리(집 → 보관장소 → 수납공간). 내 정보 메뉴에서 들어온다.
  { path: '/places', component: () => import('@/pages/HomesPage.vue') },
  { path: '/homes/:homeId/rooms', component: () => import('@/pages/RoomsPage.vue') },
  // 보관함에서 보관장소를 눌렀을 때: 그 보관장소의 물건 전체
  { path: '/rooms/:roomId/items', component: () => import('@/pages/RoomItemsPage.vue') },
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
  if (to.meta.callback || to.meta.open) return true
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
