<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonSpinner,
  IonChip,
  IonLabel,
  onIonViewWillEnter,
} from '@ionic/vue'
import { itemApi, categoryApi } from '@/api'
import ItemCard from '@/components/ItemCard.vue'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Category, Item } from '@/types/api'

const route = useRoute()
const toast = useToast()

const keyword = ref('')
const loading = ref(false)
const items = ref<Item[]>([])
const total = ref(0)
const categories = ref<Category[]>([])
const activeCategoryId = ref<number | null>(null)

async function runSearch() {
  loading.value = true
  try {
    const page = await itemApi.search({
      keyword: keyword.value.trim() || undefined,
      categoryId: activeCategoryId.value ?? undefined,
    })
    items.value = page.content
    total.value = page.totalElements
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
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
        <div v-else class="ion-padding-horizontal">
          <ItemCard v-for="item in items" :key="item.id" :item="item" />
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<style scoped>
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
