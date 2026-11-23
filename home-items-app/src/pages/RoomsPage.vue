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
import { roomApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Room } from '@/types/api'
import { rememberPickedRoom } from '@/services/placePicker'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const homeId = Number(route.params.homeId)
const loading = ref(true)
const rooms = ref<Room[]>([])

// 물건 등록 화면에서 "보관장소 등록"으로 들어온 경우: 등록 창을 바로 열고, 등록하면 물건 등록으로 돌아간다.
const fromItemForm = route.query.returnTo === 'item'
let autoCreateOpened = false

async function load() {
  loading.value = true
  try {
    rooms.value = await roomApi.listByHome(homeId)
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function promptCreate() {
  const alert = await alertController.create({
    header: '보관장소 등록',
    inputs: [{ name: 'name', placeholder: '보관장소 이름 (예: 거실)' }],
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '등록',
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            const room = await roomApi.create(homeId, data.name.trim())
            if (fromItemForm) {
              rememberPickedRoom({ homeId, roomId: room.id })
              toast.success(`'${room.name}' 보관장소를 등록했어요.`)
              router.back()
              return
            }
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

async function promptEdit(room: Room) {
  const alert = await alertController.create({
    header: '보관장소 수정',
    inputs: [{ name: 'name', value: room.name }],
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '저장',
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await roomApi.update(room.id, data.name.trim(), undefined, room.sortOrder)
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

async function confirmDelete(room: Room) {
  const alert = await alertController.create({
    header: '보관장소 삭제',
    message: `'${room.name}'을 삭제하면 하위 수납공간도 함께 삭제됩니다.`,
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
        role: 'destructive',
        handler: async () => {
          try {
            await roomApi.remove(room.id)
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

onIonViewWillEnter(async () => {
  await load()
  // 물건 등록에서 넘어왔다면 등록 창을 바로 띄운다(한 번만).
  if (route.query.create === '1' && !autoCreateOpened) {
    autoCreateOpened = true
    await promptCreate()
  }
})
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/places" />
        </ion-buttons>
        <ion-title>보관장소 관리</ion-title>
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
        <div v-if="rooms.length === 0" class="empty">
          <p>등록된 보관장소가 없어요.</p>
          <ion-button @click="promptCreate">보관장소 등록하기</ion-button>
        </div>
        <ion-list v-else>
          <ion-item-sliding v-for="r in rooms" :key="r.id">
            <ion-item button @click="router.push(`/rooms/${r.id}/storage`)">
              <ion-label>
                <h2>{{ r.name }}</h2>
              </ion-label>
              <ion-icon slot="end" :icon="chevronForward" />
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="promptEdit(r)">수정</ion-item-option>
              <ion-item-option color="danger" @click="confirmDelete(r)">삭제</ion-item-option>
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
