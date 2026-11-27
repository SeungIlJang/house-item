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
import { addOutline, chevronForward, reorderThreeOutline } from 'ionicons/icons'
import { roomApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { Room } from '@/types/api'
import { rememberPickedRoom } from '@/services/placePicker'
import { tr } from '@/i18n'

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
    header: tr('보관장소 등록', 'Add place'),
    inputs: [{ name: 'name', placeholder: tr('보관장소 이름 (예: 거실)', 'Place name (e.g. Living room)') }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('등록', 'Add'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            const room = await roomApi.create(homeId, data.name.trim())
            if (fromItemForm) {
              rememberPickedRoom({ homeId, roomId: room.id })
              toast.success(tr(`'${room.name}' 보관장소를 등록했어요.`, `Added place '${room.name}'.`))
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

// ── 끌어서 놓기: 보관장소의 손잡이(≡)를 끌어 다른 보관장소 위에 놓으면 그 안의 수납공간으로 옮긴다 ──
// 예: "냉장고"를 "주방" 위에 놓으면 "주방 > 냉장고"가 된다.
const drag = ref<{ id: number; name: string; x: number; y: number; overId: number | null } | null>(null)

function roomIdAt(x: number, y: number): number | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const row = (el as HTMLElement).closest?.('[data-room-id]') as HTMLElement | null
    if (row) return Number(row.dataset.roomId)
  }
  return null
}

function onDragStart(ev: PointerEvent, room: Room) {
  // 손잡이가 포인터를 붙잡아, 손가락이 손잡이 밖으로 나가도 계속 따라온다.
  ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
  drag.value = { id: room.id, name: room.name, x: ev.clientX, y: ev.clientY, overId: null }
}
function onDragMove(ev: PointerEvent) {
  if (!drag.value) return
  const over = roomIdAt(ev.clientX, ev.clientY)
  drag.value = { ...drag.value, x: ev.clientX, y: ev.clientY, overId: over !== null && over !== drag.value.id ? over : null }
}
function onDragEnd() {
  const done = drag.value
  drag.value = null
  if (!done?.overId) return
  const source = rooms.value.find((r) => r.id === done.id)
  const target = rooms.value.find((r) => r.id === done.overId)
  if (source && target) void confirmMoveInto(source, target)
}

async function confirmMoveInto(source: Room, target: Room) {
  const alert = await alertController.create({
    header: tr('보관장소 옮기기', 'Move place'),
    message: tr(
      `'${source.name}'을(를) '${target.name}' 안으로 옮길까요? '${source.name}'에 있는 물건과 수납공간이 함께 옮겨지고, '${target.name} > ${source.name}'(으)로 정리됩니다.`,
      `Move '${source.name}' into '${target.name}'? The items and storage spots in '${source.name}' move with it, and it will appear as '${target.name} > ${source.name}'.`,
    ),
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('옮기기', 'Move'),
        handler: async () => {
          try {
            await roomApi.moveInto(source.id, target.id)
            toast.success(
              tr(`'${source.name}'을(를) '${target.name}' 안으로 옮겼어요.`, `Moved '${source.name}' into '${target.name}'.`),
            )
            await load()
          } catch (e) {
            toast.error(extractErrorMessage(e, tr('옮기지 못했습니다.', "Couldn't move it.")))
          }
        },
      },
    ],
  })
  await alert.present()
}

async function promptEdit(room: Room) {
  const alert = await alertController.create({
    header: tr('보관장소 수정', 'Edit place'),
    inputs: [{ name: 'name', value: room.name }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('저장', 'Save'),
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
    header: tr('보관장소 삭제', 'Delete place'),
    message: tr(
      `'${room.name}'을 삭제하면 하위 수납공간도 함께 삭제됩니다.`,
      `Deleting '${room.name}' also deletes the storage spots inside it.`,
    ),
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('삭제', 'Delete'),
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
        <ion-title>{{ tr('보관장소 관리', 'Manage places') }}</ion-title>
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
          <p>{{ tr('등록된 보관장소가 없어요.', 'No places yet.') }}</p>
          <ion-button @click="promptCreate">{{ tr('보관장소 등록하기', 'Add a place') }}</ion-button>
        </div>
        <ion-list v-else>
          <ion-item-sliding
            v-for="r in rooms"
            :key="r.id"
            :data-room-id="r.id"
            :class="{ 'drag-source': drag?.id === r.id, 'drop-target': drag?.overId === r.id }"
          >
            <ion-item button @click="router.push(`/rooms/${r.id}/storage`)">
              <!-- 손잡이: 끌어서 다른 보관장소 위에 놓는다. 누르기만 해서는 화면이 넘어가지 않는다. -->
              <div
                slot="start"
                class="drag-handle"
                :aria-label="tr('끌어서 옮기기', 'Drag to move')"
                @pointerdown.stop.prevent="onDragStart($event, r)"
                @pointermove="onDragMove"
                @pointerup="onDragEnd"
                @pointercancel="drag = null"
                @touchstart.stop
                @mousedown.stop
                @click.stop
              >
                <ion-icon :icon="reorderThreeOutline" />
              </div>
              <ion-label>
                <h2>{{ r.name }}</h2>
              </ion-label>
              <ion-icon slot="end" :icon="chevronForward" />
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="promptEdit(r)">{{ tr('수정', 'Edit') }}</ion-item-option>
              <ion-item-option color="danger" @click="confirmDelete(r)">{{ tr('삭제', 'Delete') }}</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
        <p v-if="rooms.length > 1" class="hint">
          {{
            tr(
              '≡ 를 끌어 다른 보관장소 위에 놓으면 그 안으로 옮길 수 있어요. (예: 냉장고 → 주방)',
              'Drag ≡ onto another place to move it inside. (e.g. Fridge → Kitchen)',
            )
          }}
        </p>
        <!-- 끌고 있는 동안 손가락을 따라다니는 표시 -->
        <div v-if="drag" class="drag-ghost" :style="{ left: drag.x + 'px', top: drag.y + 'px' }">
          {{ drag.name }}<template v-if="drag.overId"> → {{ tr('', 'into ') }}{{ rooms.find((r) => r.id === drag?.overId)?.name }}{{ tr(' 안으로', '') }}</template>
        </div>
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
  margin: 12px 16px;
  font-size: 13px;
  color: var(--ion-color-medium);
}
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 44px;
  margin-inline-end: 8px;
  font-size: 22px;
  color: var(--ion-color-medium);
  touch-action: none; /* 끄는 동안 화면이 스크롤되지 않게 */
  cursor: grab;
}
.drag-source {
  opacity: 0.4;
}
.drop-target ion-item {
  --background: rgba(var(--ion-color-primary-rgb), 0.14);
  outline: 2px solid var(--ion-color-primary);
  outline-offset: -2px;
}
.drag-ghost {
  position: fixed;
  z-index: 1000;
  transform: translate(-50%, -140%);
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--ion-color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}
</style>
