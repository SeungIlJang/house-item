<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
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
import { addOutline, chevronForward } from 'ionicons/icons'
import { homeApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Home } from '@/types/api'
import { tr } from '@/i18n'

const router = useRouter()
const toast = useToast()

const loading = ref(true)
const homes = ref<Home[]>([])

async function load() {
  loading.value = true
  try {
    homes.value = await homeApi.list()
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function promptCreate() {
  const alert = await alertController.create({
    header: tr('집 등록', 'Add home'),
    inputs: [{ name: 'name', placeholder: tr('집 이름 (예: 우리 집)', 'Home name (e.g. My home)') }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('등록', 'Add'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await homeApi.create(data.name.trim())
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

async function promptEdit(home: Home) {
  const alert = await alertController.create({
    header: tr('집 수정', 'Edit home'),
    inputs: [{ name: 'name', value: home.name }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('저장', 'Save'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await homeApi.update(home.id, data.name.trim())
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

async function confirmDelete(home: Home) {
  const alert = await alertController.create({
    header: tr('집 삭제', 'Delete home'),
    message: tr(
      `'${home.name}'을 삭제하면 보관장소·수납공간·해당 물건도 함께 삭제됩니다.`,
      `Deleting '${home.name}' also deletes its places, storage spots and items.`,
    ),
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('삭제', 'Delete'),
        role: 'destructive',
        handler: async () => {
          try {
            await homeApi.remove(home.id)
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
        <ion-title>{{ tr('보관 장소 관리', 'Manage places') }}</ion-title>
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
        <div v-if="homes.length === 0" class="empty">
          <p>{{ tr('등록된 집이 없어요.', 'No homes yet.') }}</p>
          <ion-button @click="promptCreate">{{ tr('집 등록하기', 'Add a home') }}</ion-button>
        </div>
        <ion-list v-else>
          <ion-item-sliding v-for="h in homes" :key="h.id">
            <ion-item button @click="router.push(`/homes/${h.id}/rooms`)">
              <ion-label>
                <h2>{{ h.name }}</h2>
                <p v-if="h.description">{{ h.description }}</p>
              </ion-label>
              <ion-icon slot="end" :icon="chevronForward" />
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="promptEdit(h)">{{ tr('수정', 'Edit') }}</ion-item-option>
              <ion-item-option color="danger" @click="confirmDelete(h)">{{ tr('삭제', 'Delete') }}</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
        <p class="hint">{{ tr('항목을 왼쪽으로 밀면 수정/삭제할 수 있어요.', 'Swipe a row left to edit or delete it.') }}</p>
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
.hint {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 12px;
  padding: 8px;
}
</style>
