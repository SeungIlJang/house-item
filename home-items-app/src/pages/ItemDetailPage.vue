<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
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
} from '@ionic/vue'
import { createOutline, trashOutline, closeOutline } from 'ionicons/icons'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Zoom } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/zoom'
import { itemApi, imageUrl } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Item } from '@/types/api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

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
            toast.success('삭제되었습니다.')
            router.back()
          } catch (e) {
            toast.error(extractErrorMessage(e))
          }
        },
      },
    ],
  })
  await alert.present()
}

onIonViewWillEnter(load)
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/home" />
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
          </ion-item>
        </ion-list>
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
  gap: 8px;
  overflow-x: auto;
  padding: 12px;
}
.gallery img {
  height: 200px;
  border-radius: 12px;
  object-fit: cover;
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
