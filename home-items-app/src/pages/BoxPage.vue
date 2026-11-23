<script setup lang="ts">
// 내 물건: 저장한 물건을 보관장소(방)별로 모아 보여 준다. "이 방에 뭐가 있지?"에 답하는 화면.
// 보관장소 자체를 만들고 고치는 화면은 [내 정보 → 보관 장소 관리]에 있다.
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue'
import { chevronDownOutline, chevronForward } from 'ionicons/icons'
import { homeApi, roomApi, itemApi, imageUrl } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import { getLastPlace } from '@/services/lastPlace'
import type { Home, Item, Room } from '@/types/api'

// 보관장소마다 미리 보여 줄 물건 수. 더 있으면 "+N" 칸으로 전체 화면에 간다.
const PREVIEW_COUNT = 8

const router = useRouter()
const toast = useToast()

const loading = ref(true)
const homes = ref<Home[]>([])
const homeId = ref<number | null>(null)
const sections = ref<{ room: Room; items: Item[]; total: number }[]>([])

const homeName = computed(() => homes.value.find((h) => h.id === homeId.value)?.name ?? '')
const totalItems = computed(() => sections.value.reduce((sum, s) => sum + s.total, 0))

async function loadSections() {
  if (!homeId.value) {
    sections.value = []
    return
  }
  const rooms = await roomApi.listByHome(homeId.value)
  // 보관장소별로 최근 물건 몇 개와 전체 개수를 함께 받는다.
  const pages = await Promise.all(rooms.map((room) => itemApi.search({ roomId: room.id, size: PREVIEW_COUNT })))
  sections.value = rooms.map((room, i) => ({ room, items: pages[i].content, total: pages[i].totalElements }))
}

async function load() {
  loading.value = true
  try {
    homes.value = await homeApi.list()
    // 고른 집이 없으면 마지막으로 물건을 등록한 집, 그것도 없으면 첫 번째 집.
    if (!homes.value.some((h) => h.id === homeId.value)) {
      const last = getLastPlace()
      homeId.value = homes.value.find((h) => h.id === last?.homeId)?.id ?? homes.value[0]?.id ?? null
    }
    await loadSections()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function changeHome() {
  const alert = await alertController.create({
    header: '집 선택',
    inputs: homes.value.map((h) => ({ type: 'radio' as const, label: h.name, value: h.id, checked: h.id === homeId.value })),
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '선택',
        handler: (value: number | undefined) => {
          if (value && value !== homeId.value) {
            homeId.value = value
            void load()
          }
        },
      },
    ],
  })
  await alert.present()
}

const caption = (item: Item) => item.name || item.storageFullPath || '이름 없음'

onIonViewWillEnter(load)
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>내 물건</ion-title>
        <ion-buttons v-if="homes.length > 1" slot="end">
          <ion-button @click="changeHome">
            {{ homeName }}
            <ion-icon slot="end" :icon="chevronDownOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="center"><ion-spinner /></div>

      <template v-else>
        <div v-if="homes.length === 0" class="empty">
          <p>아직 등록된 집이 없어요.</p>
          <ion-button @click="router.push('/places')">보관 장소 만들기</ion-button>
        </div>

        <div v-else-if="sections.length === 0" class="empty">
          <p>'{{ homeName }}'에 보관장소가 없어요.</p>
          <ion-button @click="router.push(`/homes/${homeId}/rooms`)">보관장소 추가</ion-button>
        </div>

        <template v-else>
          <p class="summary">{{ homeName }} · 물건 {{ totalItems }}개</p>

          <div v-if="totalItems === 0" class="empty">
            <p>아직 보관한 물건이 없어요.</p>
            <ion-button @click="router.push({ path: '/tabs/add', query: { quick: '1' } })">사진으로 등록</ion-button>
          </div>

          <section v-for="s in sections" :key="s.room.id" class="room">
            <button type="button" class="room-head" @click="router.push(`/rooms/${s.room.id}/items`)">
              <span class="room-name">{{ s.room.name }}</span>
              <span class="room-count">{{ s.total }}개</span>
              <ion-icon :icon="chevronForward" class="room-arrow" />
            </button>

            <div v-if="s.items.length" class="strip">
              <router-link v-for="item in s.items" :key="item.id" :to="`/items/${item.id}`" class="cell">
                <img v-if="item.thumbnailUrl" :src="imageUrl(item.thumbnailUrl)" :alt="caption(item)" loading="lazy" />
                <div v-else class="cell-empty">📦</div>
                <span class="cell-caption">{{ caption(item) }}</span>
              </router-link>
              <router-link v-if="s.total > s.items.length" :to="`/rooms/${s.room.id}/items`" class="cell more">
                +{{ s.total - s.items.length }}
              </router-link>
            </div>
          </section>
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
.empty {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 24px;
}
.summary {
  margin: 12px 16px 4px;
  font-size: 13px;
  color: var(--ion-color-medium);
}
.room {
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--ion-color-light);
}
.room-head {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 16px 8px;
  background: none;
  border: 0;
  text-align: left;
  color: inherit;
  font: inherit;
}
.room-name {
  font-size: 16px;
  font-weight: 600;
}
.room-count {
  margin-left: 8px;
  font-size: 13px;
  color: var(--ion-color-medium);
}
.room-arrow {
  margin-left: auto;
  color: var(--ion-color-medium);
}
/* 가로로 넘겨 보는 사진 줄 */
.strip {
  display: flex;
  gap: 6px;
  padding: 0 16px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.strip::-webkit-scrollbar {
  display: none;
}
.cell {
  position: relative;
  flex: 0 0 92px;
  height: 92px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ion-color-light);
  text-decoration: none;
}
.cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cell-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.cell-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 5px 3px;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
}
.cell.more {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--ion-color-primary);
}
</style>
