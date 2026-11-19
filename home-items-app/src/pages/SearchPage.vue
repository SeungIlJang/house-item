<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonSearchbar,
  IonSpinner,
  IonChip,
  IonLabel,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  onIonViewWillEnter,
} from '@ionic/vue'
import { gridOutline, listOutline } from 'ionicons/icons'
import { itemApi, categoryApi, imageUrl } from '@/api'
import ItemCard from '@/components/ItemCard.vue'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Category, Item } from '@/types/api'

const route = useRoute()
const toast = useToast()

// 보기 방식: list = 이름·위치 카드, grid = 사진 격자(이름 없이 사진만 등록한 물건을 눈으로 찾기 좋다)
const VIEW_KEY = 'home_items_search_view'
const viewMode = ref<'list' | 'grid'>(localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list')
function toggleView() {
  viewMode.value = viewMode.value === 'list' ? 'grid' : 'list'
  localStorage.setItem(VIEW_KEY, viewMode.value)
}

const keyword = ref('')
const loading = ref(false)
const items = ref<Item[]>([])
const total = ref(0)
const categories = ref<Category[]>([])
const activeCategoryId = ref<number | null>(null)

// 한 번에 20개씩 불러오고, 아래로 내리면 다음 20개를 이어 붙인다.
const PAGE_SIZE = 20
const page = ref(1)
const hasMore = ref(false)
// 검색어를 빠르게 바꾸면 늦게 도착한 이전 응답이 새 결과를 덮어쓸 수 있어, 요청마다 번호를 매겨 최신 것만 반영한다.
let requestSeq = 0

const fetchPage = (pageNo: number) => itemApi.search({
  keyword: keyword.value.trim() || undefined,
  categoryId: activeCategoryId.value ?? undefined,
  page: pageNo,
  size: PAGE_SIZE,
})

async function runSearch() {
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
    if (seq !== requestSeq) return // 그 사이 검색 조건이 바뀌었다
    const known = new Set(items.value.map((i) => i.id))
    items.value.push(...result.content.filter((i) => !known.has(i.id)))
    total.value = result.totalElements
    page.value = result.page
    hasMore.value = result.page < result.totalPages
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    await (ev.target as HTMLIonInfiniteScrollElement).complete()
  }
}

function toggleCategory(id: number) {
  activeCategoryId.value = activeCategoryId.value === id ? null : id
  runSearch()
}

onIonViewWillEnter(async () => {
  const q = route.query.keyword
  keyword.value = typeof q === 'string' ? q : ''
  try {
    categories.value = await categoryApi.list()
  } catch {
    // 카테고리 로드 실패는 검색을 막지 않음
  }
  await runSearch()
})
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>찾기</ion-title>
        <ion-buttons slot="end">
          <ion-button :aria-label="viewMode === 'list' ? '사진으로 보기' : '목록으로 보기'" @click="toggleView">
            <ion-icon slot="icon-only" :icon="viewMode === 'list' ? gridOutline : listOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-padding-horizontal ion-padding-top">
        <ion-searchbar
          v-model="keyword"
          placeholder="이름, 설명, 메모로 검색"
          :debounce="300"
          @ion-input="runSearch"
        />
        <div v-if="categories.length" class="chips">
          <ion-chip
            v-for="c in categories"
            :key="c.id"
            :color="activeCategoryId === c.id ? 'primary' : 'medium'"
            :outline="activeCategoryId !== c.id"
            @click="toggleCategory(c.id)"
          >
            <ion-label>{{ c.name }}</ion-label>
          </ion-chip>
        </div>
      </div>

      <div v-if="loading" class="center"><ion-spinner /></div>

      <template v-else>
        <p class="count">검색 결과 {{ total }}건</p>
        <div v-if="items.length === 0" class="empty">조건에 맞는 물건이 없어요.</div>
        <div v-else-if="viewMode === 'grid'" class="photo-grid">
          <router-link v-for="item in items" :key="item.id" :to="`/items/${item.id}`" class="photo-cell">
            <img v-if="item.thumbnailUrl" :src="imageUrl(item.thumbnailUrl)" :alt="item.name || '물건 사진'" loading="lazy" />
            <div v-else class="photo-empty">📦</div>
            <span class="photo-caption">{{ item.name || item.storageFullPath || item.roomName || '이름 없음' }}</span>
          </router-link>
        </div>
        <div v-else class="ion-padding-horizontal">
          <ItemCard v-for="item in items" :key="item.id" :item="item" />
        </div>
        <ion-infinite-scroll :disabled="!hasMore" @ion-infinite="loadMore">
          <ion-infinite-scroll-content loading-text="더 불러오는 중..." />
        </ion-infinite-scroll>
      </template>
    </ion-content>
  </ion-page>
</template>

<style scoped>
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
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.center {
  display: flex;
  justify-content: center;
  padding: 40px;
}
.count {
  color: var(--ion-color-medium);
  font-size: 13px;
  padding: 0 16px;
}
.empty {
  text-align: center;
  color: var(--ion-color-medium);
  padding: 32px;
}
</style>
