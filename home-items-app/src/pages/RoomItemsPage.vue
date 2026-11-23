<script setup lang="ts">
// 한 보관장소(방)에 있는 물건 전체. 내 물건에서 보관장소를 누르면 온다.
// 수납공간 칩으로 "붙박이장 > 서랍" 같은 하위 위치만 골라 볼 수 있다.
import { ref } from 'vue'
import { useRoute } from 'vue-router'
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
  IonChip,
  IonLabel,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  onIonViewWillEnter,
  useIonRouter,
} from '@ionic/vue'
import { arrowBackOutline } from 'ionicons/icons'
import { itemApi, roomApi, storageApi, imageUrl } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Item, StorageTreeNode } from '@/types/api'

const PAGE_SIZE = 30

const route = useRoute()
const ionRouter = useIonRouter()
const toast = useToast()
const roomId = Number(route.params.roomId)

const loading = ref(true)
const roomName = ref('')
const storages = ref<{ id: number; label: string }[]>([])
const activeStorageId = ref<number | null>(null)
const items = ref<Item[]>([])
const total = ref(0)
const page = ref(1)
const hasMore = ref(false)
// 칩을 빠르게 바꾸면 늦게 온 이전 응답이 새 결과를 덮어쓸 수 있어 요청마다 번호를 매긴다.
let requestSeq = 0

function flatten(nodes: StorageTreeNode[], prefix = ''): { id: number; label: string }[] {
  return nodes.flatMap((n) => {
    const label = prefix ? `${prefix} > ${n.name}` : n.name
    return [{ id: n.id, label }, ...flatten(n.children ?? [], label)]
  })
}

const fetchPage = (pageNo: number) =>
  itemApi.search({ roomId, storageLocationId: activeStorageId.value ?? undefined, page: pageNo, size: PAGE_SIZE })

async function reload() {
  const seq = ++requestSeq
  loading.value = true
  try {
    const result = await fetchPage(1)
    if (seq !== requestSeq) return
    items.value = result.content
    total.value = result.totalElements
    page.value = 1
    hasMore.value = result.page < result.totalPages
  } catch (e) {
    if (seq === requestSeq) toast.error(extractErrorMessage(e))
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadMore(ev: CustomEvent) {
  const seq = requestSeq
  try {
    const result = await fetchPage(page.value + 1)
    if (seq !== requestSeq) return
    const known = new Set(items.value.map((i) => i.id))
    items.value.push(...result.content.filter((i) => !known.has(i.id)))
    page.value = result.page
    hasMore.value = result.page < result.totalPages
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    await (ev.target as HTMLIonInfiniteScrollElement).complete()
  }
}

function toggleStorage(id: number) {
  activeStorageId.value = activeStorageId.value === id ? null : id
  void reload()
}

function goBack() {
  if (ionRouter.canGoBack()) ionRouter.back()
  else ionRouter.navigate('/tabs/box', 'back', 'replace')
}

// 이름이 없으면 수납 위치의 마지막 단계를 보여 준다(방 이름은 이미 제목에 있다).
const caption = (item: Item) => item.name || item.storageFullPath?.split(' > ').pop() || '이름 없음'

onIonViewWillEnter(async () => {
  try {
    const [room, tree] = await Promise.all([roomApi.get(roomId), storageApi.tree(roomId)])
    roomName.value = room.name
    storages.value = flatten(tree)
    if (!storages.value.some((s) => s.id === activeStorageId.value)) activeStorageId.value = null
  } catch (e) {
    toast.error(extractErrorMessage(e))
  }
  await reload()
})
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
        <ion-title>{{ roomName || '내 물건' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="storages.length" class="chips">
        <ion-chip
          v-for="s in storages"
          :key="s.id"
          :color="activeStorageId === s.id ? 'primary' : 'medium'"
          :outline="activeStorageId !== s.id"
          @click="toggleStorage(s.id)"
        >
          <ion-label>{{ s.label }}</ion-label>
        </ion-chip>
      </div>

      <div v-if="loading" class="center"><ion-spinner /></div>

      <template v-else>
        <p class="count">물건 {{ total }}개</p>
        <div v-if="items.length === 0" class="empty">여기에 보관한 물건이 없어요.</div>
        <div v-else class="photo-grid">
          <router-link v-for="item in items" :key="item.id" :to="`/items/${item.id}`" class="photo-cell">
            <img v-if="item.thumbnailUrl" :src="imageUrl(item.thumbnailUrl)" :alt="caption(item)" loading="lazy" />
            <div v-else class="photo-empty">📦</div>
            <span class="photo-caption">{{ caption(item) }}</span>
          </router-link>
        </div>
        <ion-infinite-scroll :disabled="!hasMore" @ion-infinite="loadMore">
          <ion-infinite-scroll-content loading-text="더 불러오는 중..." />
        </ion-infinite-scroll>
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
.chips {
  padding: 8px 12px 0;
}
.count {
  margin: 10px 16px;
  font-size: 13px;
  color: var(--ion-color-medium);
}
.empty {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 24px;
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 4px;
  padding: 0 12px;
}
.photo-cell {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 8px;
  background: var(--ion-color-light);
  text-decoration: none;
}
.photo-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.photo-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}
.photo-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14px 6px 4px;
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.65));
}
</style>
