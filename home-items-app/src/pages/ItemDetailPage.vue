<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonChip,
  IonLabel,
  IonList,
  IonItem,
  IonSpinner,
  IonModal,
  alertController,
  onIonViewWillEnter,
  onIonViewDidEnter,
  onIonViewWillLeave,
  useBackButton,
  useIonRouter,
} from '@ionic/vue'
import { arrowBackOutline, createOutline, trashOutline, closeOutline } from 'ionicons/icons'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/zoom'
import { itemApi, imageUrl } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import { syncExpiryReminders } from '@/services/expiryReminder'
import { refreshItemCount } from '@/services/itemCount'
import { daysUntil, expiryLabel, expiryTone } from '@/utils/expiry'
import type { Item } from '@/types/api'
import { handleExpiredItem, isExpired } from '@/services/expiredActions'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const ionRouter = useIonRouter()

// 뒤로가기: 목록에서 들어왔으면 그 목록으로, 등록 직후·알림·직접 주소로 들어왔으면 물건 목록(찾기 탭)으로 간다.
// (등록 직후 그냥 뒤로 가면 비어 있는 등록 화면으로 돌아가기 때문)
const ITEM_LIST_PATH = '/tabs/search'
function goBack() {
  if (route.query.from !== 'add' && ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  ionRouter.navigate(ITEM_LIST_PATH, 'back', 'replace')
}

// 안드로이드 하드웨어 뒤로가기도 같은 규칙을 따른다. 이 화면이 보일 때만 등록한다.
let hardwareBack: { unregister: () => void } | null = null
onIonViewDidEnter(() => {
  hardwareBack = useBackButton(10, goBack)
})
onIonViewWillLeave(() => {
  hardwareBack?.unregister()
  hardwareBack = null
})

const loading = ref(true)
const item = ref<Item | null>(null)

// 전체화면 사진 뷰어
const viewerOpen = ref(false)
const viewerIndex = ref(0)

function openViewer(index: number) {
  viewerIndex.value = index
  viewerOpen.value = true
}

async function load() {
  loading.value = true
  try {
    item.value = await itemApi.get(Number(route.params.id))
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function confirmDelete() {
  const alert = await alertController.create({
    header: '물건 삭제',
    message: '이 물건을 삭제할까요? 되돌릴 수 없습니다.',
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: async () => {
          try {
            await itemApi.remove(Number(route.params.id))
            void syncExpiryReminders()
            void refreshItemCount()
            toast.success('삭제되었습니다.')
            goBack()
          } catch (e) {
            toast.error(extractErrorMessage(e))
          }
        },
      },
    ],
  })
  await alert.present()
}

// 유통기한이 지난 물건 처리: 지웠으면 목록으로 돌아가고, 날짜를 바꿨으면 화면에 바로 반영한다.
async function onHandleExpired() {
  if (!item.value) return
  const result = await handleExpiredItem(item.value)
  if (result?.kind === 'deleted') goBack()
  else if (result?.kind === 'updated') item.value = result.item
}

onIonViewWillEnter(load)
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button aria-label="뒤로" @click="goBack">
            <ion-icon slot="icon-only" :icon="arrowBackOutline" />
          </ion-button>
        </ion-buttons>
        <ion-title>물건 상세</ion-title>
        <ion-buttons slot="end" v-if="item">
          <ion-button @click="router.push(`/items/${item.id}/edit`)">
            <ion-icon slot="icon-only" :icon="createOutline" />
          </ion-button>
          <ion-button color="danger" @click="confirmDelete">
            <ion-icon slot="icon-only" :icon="trashOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="center"><ion-spinner /></div>
      <div v-else-if="!item" class="center">물건을 찾을 수 없습니다.</div>
      <template v-else>
        <div v-if="item.images.length" class="gallery">
          <img
            v-for="(img, idx) in item.images"
            :key="img.id"
            :src="imageUrl(img.imageUrl)"
            :alt="item.name"
            @click="openViewer(idx)"
          />
        </div>
        <div v-else class="no-image">📦</div>

        <div class="ion-padding">
          <h1 class="name">{{ item.name || '(이름 없음)' }}</h1>
          <div class="chips">
            <ion-chip v-if="item.categoryName" color="primary">
              <ion-label>{{ item.categoryName }}</ion-label>
            </ion-chip>
            <ion-chip v-for="t in item.tags" :key="t.id" color="medium">
              <ion-label>{{ t.name }}</ion-label>
            </ion-chip>
          </div>
        </div>

        <ion-list>
          <ion-item>
            <ion-label>
              <p>보관 위치</p>
              <h3>{{ item.storageFullPath || item.roomName || '위치 미지정' }}</h3>
            </ion-label>
          </ion-item>
          <ion-item>
            <ion-label>
              <p>수량</p>
              <h3>{{ item.quantity }}</h3>
            </ion-label>
          </ion-item>
          <ion-item v-if="item.description">
            <ion-label>
              <p>설명</p>
              <h3 class="wrap">{{ item.description }}</h3>
            </ion-label>
          </ion-item>
          <ion-item v-if="item.memo">
            <ion-label>
              <p>메모</p>
              <h3 class="wrap">{{ item.memo }}</h3>
            </ion-label>
          </ion-item>
          <ion-item v-if="item.purchaseDate">
            <ion-label>
              <p>구매일</p>
              <h3>{{ item.purchaseDate }}</h3>
            </ion-label>
          </ion-item>
          <ion-item v-if="item.expirationDate">
            <ion-label>
              <p>유효기간</p>
              <h3>{{ item.expirationDate }}</h3>
            </ion-label>
            <ion-chip slot="end" :color="expiryTone(daysUntil(item.expirationDate))">
              <ion-label>{{ expiryLabel(daysUntil(item.expirationDate)) }}</ion-label>
            </ion-chip>
          </ion-item>
        </ion-list>

        <div v-if="isExpired(item)" class="ion-padding">
          <ion-button expand="block" fill="outline" color="danger" @click="onHandleExpired">
            유통기한 지난 물건 처리
          </ion-button>
        </div>
      </template>

      <!-- 전체화면 사진 뷰어 (핀치/더블탭 확대, 좌우 넘김) -->
      <ion-modal :is-open="viewerOpen" @did-dismiss="viewerOpen = false">
        <div class="viewer">
          <ion-button class="viewer-close" fill="clear" @click="viewerOpen = false">
            <ion-icon slot="icon-only" :icon="closeOutline" />
          </ion-button>
          <swiper
            v-if="item"
            class="viewer-swiper"
            :modules="[Zoom]"
            :zoom="true"
            :initial-slide="viewerIndex"
          >
            <swiper-slide v-for="img in item.images" :key="img.id">
              <div class="swiper-zoom-container">
                <img :src="imageUrl(img.imageUrl)" :alt="item.name" />
              </div>
            </swiper-slide>
          </swiper>
        </div>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding: 40px;
}
.gallery {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  background: #000;
}
.gallery img {
  flex: 0 0 100%;
  scroll-snap-align: center;
  width: 100%;
  height: 60vh;
  object-fit: contain;
  cursor: pointer;
}

/* 전체화면 뷰어 */
.viewer {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}
.viewer-swiper {
  width: 100%;
  height: 100%;
}
.viewer-swiper .swiper-zoom-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.viewer-swiper img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.viewer-close {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 8px);
  right: 8px;
  z-index: 10;
  --color: #fff;
}
.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 160px;
  font-size: 56px;
  background: var(--ion-color-light);
}
.name {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.wrap {
  white-space: pre-wrap;
}
</style>
