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
import { categoryApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Category } from '@/types/api'
import { tr } from '@/i18n'

const toast = useToast()
const loading = ref(true)
const categories = ref<Category[]>([])

async function load() {
  loading.value = true
  try {
    categories.value = await categoryApi.list()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function promptCreate() {
  const alert = await alertController.create({
    header: tr('카테고리 추가', 'Add category'),
    inputs: [{ name: 'name', placeholder: tr('예: 전자제품', 'e.g. Electronics') }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('추가', 'Add'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await categoryApi.create(data.name.trim())
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

async function promptEdit(c: Category) {
  const alert = await alertController.create({
    header: tr('카테고리 수정', 'Edit category'),
    inputs: [{ name: 'name', value: c.name }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('저장', 'Save'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await categoryApi.update(c.id, data.name.trim())
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

async function confirmDelete(c: Category) {
  const alert = await alertController.create({
    header: tr('카테고리 삭제', 'Delete category'),
    message: tr(`'${c.name}'을 삭제할까요?`, `Delete '${c.name}'?`),
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('삭제', 'Delete'),
        role: 'destructive',
        handler: async () => {
          try {
            await categoryApi.remove(c.id)
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
        <ion-title>{{ tr('카테고리 관리', 'Manage categories') }}</ion-title>
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
        <div v-if="categories.length === 0" class="empty">
          <p>{{ tr('카테고리가 없어요.', 'No categories yet.') }}</p>
          <ion-button @click="promptCreate">{{ tr('추가하기', 'Add') }}</ion-button>
        </div>
        <ion-list v-else>
          <ion-item-sliding v-for="c in categories" :key="c.id">
            <ion-item>
              <ion-label>{{ c.name }}</ion-label>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="promptEdit(c)">{{ tr('수정', 'Edit') }}</ion-item-option>
              <ion-item-option color="danger" @click="confirmDelete(c)">{{ tr('삭제', 'Delete') }}</ion-item-option>
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
