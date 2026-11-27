<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
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
import { addOutline, addCircleOutline } from 'ionicons/icons'
import { roomApi, storageApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { StorageTreeNode } from '@/types/api'
import { tr } from '@/i18n'

interface FlatNode {
  id: number
  name: string
  depth: number
  parentId: number | null
}

const route = useRoute()
const toast = useToast()

const roomId = Number(route.params.roomId)
const loading = ref(true)
const nodes = ref<FlatNode[]>([])

function flatten(tree: StorageTreeNode[], depth = 0): FlatNode[] {
  const out: FlatNode[] = []
  for (const n of tree) {
    out.push({ id: n.id, name: n.name, depth, parentId: n.parentId })
    if (n.children?.length) out.push(...flatten(n.children, depth + 1))
  }
  return out
}

// 화면 제목으로 쓸 보관장소 이름. 불러오기 전에는 '수납공간'으로 보인다.
const roomName = ref('')

async function load() {
  loading.value = true
  try {
    const [room, tree] = await Promise.all([roomApi.get(roomId), storageApi.tree(roomId)])
    roomName.value = room.name
    nodes.value = flatten(tree)
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function promptCreate(parentId: number | null, headerText: string) {
  const alert = await alertController.create({
    header: headerText,
    inputs: [{ name: 'name', placeholder: tr('이름 (예: 붙박이장, 두 번째 서랍)', 'Name (e.g. Closet, Second drawer)') }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('등록', 'Add'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            await storageApi.create(roomId, data.name.trim(), parentId)
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

async function promptEdit(node: FlatNode) {
  const alert = await alertController.create({
    header: tr('수납공간 수정', 'Edit storage spot'),
    inputs: [{ name: 'name', value: node.name }],
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('저장', 'Save'),
        handler: async (data) => {
          if (!data.name?.trim()) return
          try {
            // 이름만 변경하고 상위 위치(parentId)는 그대로 유지
            await storageApi.update(node.id, data.name.trim(), node.parentId)
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

async function confirmDelete(node: FlatNode) {
  const alert = await alertController.create({
    header: tr('수납공간 삭제', 'Delete storage spot'),
    message: tr(
      `'${node.name}'과 그 하위 수납공간이 함께 삭제됩니다.`,
      `'${node.name}' and the storage spots inside it will be deleted.`,
    ),
    buttons: [
      { text: tr('취소', 'Cancel'), role: 'cancel' },
      {
        text: tr('삭제', 'Delete'),
        role: 'destructive',
        handler: async () => {
          try {
            await storageApi.remove(node.id)
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
          <ion-back-button default-href="/places" />
        </ion-buttons>
        <ion-title>{{ roomName || tr('수납공간', 'Storage spots') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="promptCreate(null, tr('수납공간 등록', 'Add storage spot'))">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="center"><ion-spinner /></div>
      <template v-else>
        <div v-if="nodes.length === 0" class="empty">
          <p>{{ tr('수납공간이 없어요. 붙박이장, 서랍 등을 추가해보세요.', 'No storage spots yet. Add a closet, a drawer and more.') }}</p>
          <ion-button @click="promptCreate(null, tr('수납공간 등록', 'Add storage spot'))">{{ tr('추가하기', 'Add') }}</ion-button>
        </div>
        <ion-list v-else>
          <ion-item-sliding v-for="n in nodes" :key="n.id">
            <ion-item>
              <ion-label :style="{ paddingLeft: n.depth * 20 + 'px' }">
                <span v-if="n.depth > 0">└ </span>{{ n.name }}
              </ion-label>
              <ion-button
                slot="end"
                fill="clear"
                @click="promptCreate(n.id, tr(`'${n.name}' 하위 추가`, `Add inside '${n.name}'`))"
              >
                <ion-icon slot="icon-only" :icon="addCircleOutline" />
              </ion-button>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option @click="promptEdit(n)">{{ tr('수정', 'Edit') }}</ion-item-option>
              <ion-item-option color="danger" @click="confirmDelete(n)">{{ tr('삭제', 'Delete') }}</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
        <p class="hint">{{ tr('＋ 아이콘으로 하위 수납공간을 추가할 수 있어요.', 'Tap the ＋ icon to add a storage spot inside another.') }}</p>
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
