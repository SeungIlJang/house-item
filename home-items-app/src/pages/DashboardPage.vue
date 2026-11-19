<script setup lang="ts">
import { ref } from 'vue'
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
  onIonViewWillEnter,
} from '@ionic/vue'
import { addCircleOutline } from 'ionicons/icons'
import { itemApi } from '@/api'
import ItemCard from '@/components/ItemCard.vue'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Item } from '@/types/api'
import { syncExpiryReminders } from '@/services/expiryReminder'
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

async function load() {
  loading.value = true
  try {
    const expiresBefore = toLocalDateString(addDays(new Date(), EXPIRING_DAYS))
    const [page, expiring] = await Promise.all([
      itemApi.list(1, 5),
      itemApi.search({ expiresBefore, sort: 'expiration', size: 5 }),
    ])
    totalItems.value = page.totalElements
    recentItems.value = page.content
    expiringItems.value = expiring.content
    expiringTotal.value = expiring.totalElements
    void syncExpiryReminders()
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
              <ion-card class="stat-card" button @click="router.push('/tabs/add')">
                <ion-card-content class="quick-add">
                  <ion-icon :icon="addCircleOutline" size="large" color="primary" />
                  <div class="stat-label">빠른 등록</div>
                </ion-card-content>
              </ion-card>
            </ion-col>
          </ion-row>
        </ion-grid>

        <template v-if="expiringItems.length">
          <div class="ion-padding-horizontal section-head">
            <h2 class="section-title">⏰ 유통기한 임박</h2>
            <span class="section-sub">7일 이내 · {{ expiringTotal }}개</span>
          </div>
          <div class="ion-padding-horizontal">
            <ItemCard v-for="item in expiringItems" :key="item.id" :item="item" />
          </div>
        </template>

        <div class="ion-padding-horizontal">
          <h2 class="section-title">최근 등록한 물건</h2>
        </div>

        <div v-if="recentItems.length === 0" class="empty">
          <p>아직 등록한 물건이 없어요.</p>
          <ion-button @click="router.push('/tabs/add')">첫 물건 등록하기</ion-button>
        </div>

        <div v-else class="ion-padding-horizontal">
          <ItemCard v-for="item in recentItems" :key="item.id" :item="item" />
        </div>
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
.section-title {
  font-size: 17px;
  font-weight: 600;
  margin: 8px 0;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.section-sub {
  color: var(--ion-color-medium);
  font-size: 13px;
}
.empty {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 24px;
}
</style>
