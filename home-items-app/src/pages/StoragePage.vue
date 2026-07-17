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
import { storageApi } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type { StorageTreeNode } from '@/types/api'

interface FlatNode {
  id: number
  name: string
  depth: number
}

const route = useRoute()
const toast = useToast()

const roomId = Number(route.params.roomId)
const loading = ref(true)
const nodes = ref<FlatNode[]>([])

function flatten(tree: StorageTreeNode[], depth = 0): FlatNode[] {
  const out: FlatNode[] = []
  for (const n of tree) {
    out.push({ id: n.id, name: n.name, depth })
    if (n.children?.length) out.push(...flatten(n.children, depth + 1))
  }
  return out
}

async function load() {
  loading.value = true
  try {
    nodes.value = flatten(await storageApi.tree(roomId))
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function promptCreate(parentId: number | null, headerText: string) {
  const alert = await alertController.create({
    header: headerText,
    inputs: [{ name: 'name', placeholder: '이름 (예: 붙박이장, 두 번째 서랍)' }],
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '등록',
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

async function confirmDelete(node: FlatNode) {
  const alert = await alertController.create({
    header: '수납공간 삭제',
    message: `'${node.name}'과 그 하위 수납공간이 함께 삭제됩니다.`,
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '삭제',
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
          <ion-back-button default-href="/tabs/places" />
        </ion-buttons>
        <ion-title>수납공간</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="promptCreate(null, '수납공간 등록')">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div v-if="loading" class="center"><ion-spinner /></div>
      <template v-else>
        <div v-if="nodes.length === 0" class="empty">
          <p>수납공간이 없어요. 붙박이장, 서랍 등을 추가해보세요.</p>
          <ion-button @click="promptCreate(null, '수납공간 등록')">추가하기</ion-button>
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
                @click="promptCreate(n.id, `'${n.name}' 하위 추가`)"
              >
                <ion-icon slot="icon-only" :icon="addCircleOutline" />
              </ion-button>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="danger" @click="confirmDelete(n)">삭제</ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </ion-list>
        <p class="hint">＋ 아이콘으로 하위 수납공간을 추가할 수 있어요.</p>
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
