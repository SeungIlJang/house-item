<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  onIonViewWillEnter,
} from '@ionic/vue'
import { cameraOutline } from 'ionicons/icons'
import { itemApi } from '@/api'
import ItemCard from '@/components/ItemCard.vue'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Item } from '@/types/api'
import { syncExpiryReminders } from '@/services/expiryReminder'
import { reportItemCount } from '@/services/itemCount'
import { readDashboardCache, saveDashboardCache, type DashboardData } from '@/services/dashboardCache'
import { addDays, toLocalDateString } from '@/utils/expiry'

// 홈에 보여 줄 유통기한 임박 기준(오늘부터 7일 안, 이미 지난 것 포함)
const EXPIRING_DAYS = 7

const router = useRouter()
const toast = useToast()

const loading = ref(true)
const totalItems = ref(0)
const recentItems = ref<Item[]>([])
const expiringItems = ref<Item[]>([])
const expiringTotal = ref(0)

// 목록 탭: 최근 등록한 물건 / 유통기한 임박.
// 유통기한이 임박한 물건이 있으면 그 탭을 첫 번째에 두고 먼저 보여 준다. 없으면 최근 등록이 첫 번째다.
type ListTab = 'expiry' | 'recent'
const TAB_LABEL: Record<ListTab, string> = { expiry: '유통기한 임박', recent: '최근 등록한 물건' }
const tabOrder = computed<ListTab[]>(() => (expiringTotal.value > 0 ? ['expiry', 'recent'] : ['recent', 'expiry']))
const activeTab = ref<ListTab>('recent')
// 사용자가 직접 탭을 고른 뒤에는 화면에 다시 들어와도 그 탭을 유지한다.
let tabPicked = false
function pickTab(value: unknown) {
  if (value !== 'expiry' && value !== 'recent') return
  activeTab.value = value
  tabPicked = true
}

// 화면에 내용을 채운다(서버 응답이든, 기기에 저장해 둔 지난번 내용이든).
let shown = false
function show(data: DashboardData) {
  totalItems.value = data.totalItems
  reportItemCount(data.totalItems) // 하단 탭 숫자와 광고 유예 판정에 쓴다
  recentItems.value = data.recentItems
  expiringItems.value = data.expiringItems
  expiringTotal.value = data.expiringTotal
  if (!tabPicked) activeTab.value = tabOrder.value[0]
  shown = true
  loading.value = false
}

// 홈에 들어올 때마다 알림을 다시 맞추면 그때마다 목록 요청이 하나 더 나간다. 한 시간에 한 번이면 충분하다.
// (물건을 저장·삭제할 때는 그 화면에서 바로 다시 맞춘다)
const REMINDER_SYNC_INTERVAL_MS = 60 * 60 * 1000
let lastReminderSync = 0

async function load() {
  // 서버 응답을 기다리는 동안 지난번에 본 내용을 먼저 보여 준다. 보여 줄 것이 전혀 없을 때만 로딩 표시를 띄운다.
  if (!shown) {
    const cached = readDashboardCache()
    if (cached) show(cached)
  }
  loading.value = !shown
  try {
    const expiresBefore = toLocalDateString(addDays(new Date(), EXPIRING_DAYS))
    const [page, expiring] = await Promise.all([
      itemApi.list(1, 5),
      itemApi.search({ expiresBefore, sort: 'expiration', size: 5 }),
    ])
    const data: DashboardData = {
      totalItems: page.totalElements,
      recentItems: page.content,
      expiringItems: expiring.content,
      expiringTotal: expiring.totalElements,
    }
    show(data)
    saveDashboardCache(data)
    if (Date.now() - lastReminderSync > REMINDER_SYNC_INTERVAL_MS) {
      lastReminderSync = Date.now()
      void syncExpiryReminders()
    }
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch(ev: CustomEvent) {
  const keyword = (ev.detail.value ?? '').trim()
  router.push({ path: '/tabs/search', query: keyword ? { keyword } : {} })
}

onIonViewWillEnter(load)
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>집안의모든것</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding-horizontal ion-padding-top">
        <ion-searchbar
          placeholder="물건 이름으로 검색"
          :debounce="0"
          search-icon="search"
          @keyup.enter="onSearch"
        />
      </div>

      <div v-if="loading" class="center">
        <ion-spinner />
      </div>

      <template v-else>
        <ion-grid>
          <ion-row>
            <ion-col size="6">
              <ion-card class="stat-card">
                <ion-card-content>
                  <div class="stat-value">{{ totalItems }}</div>
                  <div class="stat-label">전체 물건</div>
                </ion-card-content>
              </ion-card>
            </ion-col>
            <ion-col size="6">
              <ion-card class="stat-card" button @click="router.push({ path: '/tabs/add', query: { quick: '1' } })">
                <ion-card-content class="quick-add">
                  <ion-icon :icon="cameraOutline" size="large" color="primary" />
                  <div class="stat-label">사진으로 등록</div>
                </ion-card-content>
              </ion-card>
            </ion-col>
          </ion-row>
        </ion-grid>

        <div class="ion-padding-horizontal list-tabs">
          <ion-segment :value="activeTab" @ion-change="pickTab($event.detail.value)">
            <ion-segment-button v-for="tab in tabOrder" :key="tab" :value="tab">
              <ion-label>
                {{ TAB_LABEL[tab] }}
                <span v-if="tab === 'expiry' && expiringTotal > 0" class="tab-count">{{ expiringTotal }}</span>
              </ion-label>
            </ion-segment-button>
          </ion-segment>
        </div>

        <!-- 유통기한 임박: 오늘부터 7일 안에 만료되거나 이미 지난 물건, 가까운 순 -->
        <template v-if="activeTab === 'expiry'">
          <div v-if="expiringItems.length === 0" class="empty">
            <p>7일 안에 유통기한이 임박한 물건이 없어요.</p>
          </div>
          <template v-else>
            <p class="ion-padding-horizontal section-sub">7일 이내 · {{ expiringTotal }}개 (지난 것 포함)</p>
            <div class="ion-padding-horizontal">
              <ItemCard v-for="item in expiringItems" :key="item.id" :item="item" expired-action @handled="load" />
            </div>
          </template>
        </template>

        <!-- 최근 등록한 물건 -->
        <template v-else>
          <div v-if="recentItems.length === 0" class="empty">
            <p>아직 등록한 물건이 없어요.</p>
            <ion-button @click="router.push('/tabs/add')">첫 물건 등록하기</ion-button>
          </div>
          <div v-else class="ion-padding-horizontal">
            <ItemCard v-for="item in recentItems" :key="item.id" :item="item" />
          </div>
        </template>
      </template>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding: 40px;
}
.stat-card {
  margin: 4px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-label {
  color: var(--ion-color-medium);
  font-size: 13px;
}
.quick-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.list-tabs {
  margin: 4px 0 8px;
}
.tab-count {
  display: inline-block;
  min-width: 18px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ion-color-danger);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.section-sub {
  margin: 0 0 6px;
  color: var(--ion-color-medium);
  font-size: 13px;
}
.empty {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 24px;
}
</style>
