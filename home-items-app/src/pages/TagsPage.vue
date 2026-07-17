<script setup lang="ts">
import { ref } from 'vue'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue'
import { addOutline } from 'ionicons/icons'
import { tagApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Tag } from '@/types/api'

const toast = useToast()
const loading = ref(true)
const tags = ref<Tag[]>([])

async function load() {
  loading.value = true
  try {
    tags.value = await tagApi.list()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function promptCreate() {
  const alert = await alertController.create({
    header: '태그 추가',
    inputs: [{ name: 'name', placeholder: '예: 중요, 자주사용' }],
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '추가',
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await tagApi.create(data.name.trim())
            await load()
          } catch (e) {
            toast.error(extractErrorMessage(e))
          }
        },
      },
    ],
  })
  await alert.present()
}

async function promptEdit(t: Tag) {
  const alert = await alertController.create({
    header: '태그 수정',
    inputs: [{ name: 'name', value: t.name }],
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '저장',
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await tagApi.update(t.id, data.name.trim())
            await load()
          } catch (e) {
            toast.error(extractErrorMessage(e))
          }
        },
      },
    ],
  })
  await alert.present()
}

async function confirmDelete(t: Tag) {
  const alert = await alertController.create({
    header: '태그 삭제',
    message: `'${t.name}'을 삭제할까요?`,
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: async () => {
          try {
            await tagApi.remove(t.id)
            await load()
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
          <ion-back-button default-href="/tabs/profile" />
        </ion-buttons>
        <ion-title>태그 관리</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="promptCreate">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="center"><ion-spinner /></div>
      <template v-else>
        <div v-if="tags.length === 0" class="empty">
          <p>태그가 없어요.</p>
          <ion-button @click="promptCreate">추가하기</ion-button>
        </div>
        <ion-list v-else>
          <ion-item-sliding v-for="t in tags" :key="t.id">
            <ion-item>
              <ion-label>{{ t.name }}</ion-label>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="promptEdit(t)">수정</ion-item-option>
              <ion-item-option color="danger" @click="confirmDelete(t)">삭제</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
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
  padding: 32px;
}
</style>
