<script setup lang="ts">
import { IonCard, IonCardContent, IonChip, IonLabel, IonThumbnail } from '@ionic/vue'
import { imageUrl } from '@/api'
import type { Item } from '@/types/api'

defineProps<{ item: Item }>()
</script>

<template>
  <ion-card button @click="$router.push(`/items/${item.id}`)">
    <ion-card-content class="card-body">
      <ion-thumbnail class="thumb">
        <img v-if="item.thumbnailUrl" :src="imageUrl(item.thumbnailUrl)" :alt="item.name" />
        <div v-else class="thumb-placeholder">📦</div>
      </ion-thumbnail>
      <div class="info">
        <div class="name">{{ item.name || '(이름 없음)' }}</div>
        <div class="meta">
          <ion-chip v-if="item.categoryName" color="primary" class="mini-chip">
            <ion-label>{{ item.categoryName }}</ion-label>
          </ion-chip>
          <span class="qty">수량 {{ item.quantity }}</span>
        </div>
        <div v-if="item.storageFullPath" class="path">📍 {{ item.storageFullPath }}</div>
        <div v-else-if="item.roomName" class="path">📍 {{ item.roomName }}</div>
      </div>
    </ion-card-content>
  </ion-card>
</template>

<style scoped>
.card-body {
  display: flex;
  gap: 12px;
  align-items: center;
}
.thumb {
  --size: 64px;
  flex-shrink: 0;
}
.thumb img {
  object-fit: cover;
  border-radius: 8px;
}
.thumb-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}
.info {
  min-width: 0;
  flex: 1;
}
.name {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 2px;
}
.meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mini-chip {
  height: 22px;
  font-size: 12px;
}
.qty {
  color: var(--ion-color-medium);
  font-size: 13px;
}
.path {
  margin-top: 4px;
  font-size: 13px;
  color: var(--ion-color-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
