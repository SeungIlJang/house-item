<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonLabel,
  IonSpinner,
  IonIcon,
  IonAccordion,
  IonAccordionGroup,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue'
import { trashOutline, chevronDownOutline, cameraOutline, imagesOutline } from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { homeApi, roomApi, storageApi, categoryApi, tagApi, itemApi, imageUrl } from '@/api'
import { extractErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import type {
  Category,
  Home,
  Item,
  ItemImage,
  Room,
  StorageTreeNode,
  Tag,
} from '@/types/api'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const itemId = computed(() =>
  route.params.id ? Number(route.params.id) : null,
)
const isEdit = computed(() => itemId.value !== null)

const loading = ref(false)
const saving = ref(false)
const savingText = ref('저장 중...')
const photoLoading = ref(false)
const busy = computed(() => saving.value || photoLoading.value)
const busyText = computed(() => (saving.value ? savingText.value : '사진 불러오는 중...'))

// 오버레이(로딩바)를 실제 화면에 먼저 그린 뒤 다음 작업을 진행
async function paintNow() {
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}

const homes = ref<Home[]>([])
const rooms = ref<Room[]>([])
const storages = ref<{ id: number; label: string }[]>([])
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const images = ref<ItemImage[]>([])
// 새로 추가한 사진. previewUrl 로 썸네일 표시, 저장 시 file(없으면 fetchUrl 로 변환) 업로드.
interface PendingPhoto {
  previewUrl: string // <img> 표시용 (촬영: object URL, 갤러리: webPath)
  file: File | null // 있으면 그대로 업로드
  fetchUrl?: string // 저장 시 여기서 파일을 가져옴(갤러리 webPath)
}
const pendingPhotos = ref<PendingPhoto[]>([])

const form = ref({
  name: '',
  quantity: 1,
  description: '',
  purchaseDate: '',
  expirationDate: '',
  homeId: null as number | null,
  roomId: null as number | null,
  storageLocationId: null as number | null,
  categoryId: null as number | null,
  tagIds: [] as number[],
})

function flattenTree(nodes: StorageTreeNode[], depth = 0): { id: number; label: string }[] {
  const out: { id: number; label: string }[] = []
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'  '.repeat(depth)}${depth > 0 ? '└ ' : ''}${n.name}` })
    if (n.children?.length) out.push(...flattenTree(n.children, depth + 1))
  }
  return out
}

async function loadRooms(homeId: number | null) {
  rooms.value = homeId ? await roomApi.listByHome(homeId) : []
}

async function loadStorages(roomId: number | null) {
  storages.value = roomId ? flattenTree(await storageApi.tree(roomId)) : []
}

async function onHomeChange() {
  // 집을 바꾸면 장소는 다시 '선택' 상태로 (사용자가 직접 고르도록)
  form.value.roomId = null
  form.value.storageLocationId = null
  await loadRooms(form.value.homeId)
  storages.value = []
}

const selectedHomeName = computed(
  () => homes.value.find((h) => h.id === form.value.homeId)?.name ?? '집 선택',
)

async function changeHome() {
  const alert = await alertController.create({
    header: '집 선택',
    inputs: homes.value.map((h) => ({
      type: 'radio' as const,
      label: h.name,
      value: h.id,
      checked: h.id === form.value.homeId,
    })),
    buttons: [
      { text: '취소', role: 'cancel' },
      {
        text: '선택',
        handler: async (value: number) => {
          if (value && value !== form.value.homeId) {
            form.value.homeId = value
            await onHomeChange()
          }
        },
      },
    ],
  })
  await alert.present()
}

async function onRoomChange() {
  form.value.storageLocationId = null
  await loadStorages(form.value.roomId)
}

// 웹(브라우저)에서만 파일 input 사용, 앱(네이티브)에서는 카메라 플러그인 사용
const isNative = Capacitor.isNativePlatform()

function isUserCancel(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : ''
  return /cancel/i.test(msg)
}

// 웹(브라우저)용 파일 입력
const fileInput = ref<HTMLInputElement | null>(null)

function onFilesSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files) {
    for (const file of Array.from(input.files)) {
      pendingPhotos.value.push({ previewUrl: URL.createObjectURL(file), file })
    }
  }
  input.value = ''
}

// base64 → File (촬영 시 사용: fetch 없이 빠르고 안정적)
function base64ToFile(base64: string, format?: string): File {
  const type = `image/${format || 'jpeg'}`
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], `photo_${Date.now()}.${format || 'jpg'}`, { type })
}

// 촬영 → 사진 1장 추가 (썸네일 즉시 표시)
async function addFromCamera() {
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Base64,
      quality: 90,
      correctOrientation: true,
    })
    if (photo.base64String) {
      const file = base64ToFile(photo.base64String, photo.format)
      pendingPhotos.value.push({ previewUrl: URL.createObjectURL(file), file })
    }
  } catch (e) {
    if (!isUserCancel(e)) toast.error('사진을 가져오지 못했습니다.')
  }
}

// webPath 이미지를 미리 로드(클라우드 다운로드 포함). 성공/실패 상관없이 완료되면 resolve.
function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

// 갤러리 → 여러 장 선택. 완료 후 썸네일 준비되는 동안 로딩 표시.
async function openGallery() {
  if (!isNative) {
    fileInput.value?.click()
    return
  }
  let result
  try {
    result = await Camera.pickImages({ quality: 90 })
  } catch (e) {
    if (!isUserCancel(e)) toast.error('갤러리를 열지 못했습니다.')
    return
  }
  if (!result.photos.length) return

  photoLoading.value = true
  await paintNow() // 로딩바를 먼저 그린 뒤 사진 로드 시작
  try {
    // 준비되면 한꺼번에 추가 → 썸네일이 즉시 표시됨
    await Promise.all(result.photos.map((photo) => preloadImage(photo.webPath)))
    for (const photo of result.photos) {
      pendingPhotos.value.push({ previewUrl: photo.webPath, file: null, fetchUrl: photo.webPath })
    }
  } finally {
    photoLoading.value = false
  }
}

function revokeIfBlob(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

function removePendingPhoto(index: number) {
  revokeIfBlob(pendingPhotos.value[index].previewUrl)
  pendingPhotos.value.splice(index, 1)
}

function clearPendingPhotos() {
  pendingPhotos.value.forEach((p) => revokeIfBlob(p.previewUrl))
  pendingPhotos.value = []
}

async function deleteExistingImage(imageId: number) {
  if (!itemId.value) return
  try {
    await itemApi.removeImage(itemId.value, imageId)
    images.value = images.value.filter((i) => i.id !== imageId)
  } catch (e) {
    toast.error(extractErrorMessage(e))
  }
}

async function load() {
  loading.value = true
  try {
    homes.value = await homeApi.list()
    categories.value = await categoryApi.list()
    tags.value = await tagApi.list()

    if (isEdit.value && itemId.value) {
      const item: Item = await itemApi.get(itemId.value)
      form.value = {
        name: item.name,
        quantity: item.quantity,
        description: item.description ?? '',
        purchaseDate: item.purchaseDate ?? '',
        expirationDate: item.expirationDate ?? '',
        homeId: item.homeId,
        roomId: item.roomId,
        storageLocationId: item.storageLocationId,
        categoryId: item.categoryId,
        tagIds: item.tags.map((t) => t.id),
      }
      images.value = item.images
      await loadRooms(item.homeId)
      await loadStorages(item.roomId)
    } else if (homes.value.length > 0) {
      form.value.homeId = homes.value[0].id
      await loadRooms(form.value.homeId)
      // 장소는 최초에 '선택' 상태 — 사용자가 직접 선택
    }
  } catch (e) {
    toast.error(extractErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function reset() {
  form.value = {
    name: '',
    quantity: 1,
    description: '',
    purchaseDate: '',
    expirationDate: '',
    homeId: homes.value[0]?.id ?? null,
    roomId: null,
    storageLocationId: null,
    categoryId: null,
    tagIds: [],
  }
  clearPendingPhotos()
  images.value = []
}

// 등록 취소 → 홈 화면으로 (작성 중 내용이 있으면 확인)
async function cancelForm() {
  const hasInput = form.value.name.trim() || pendingPhotos.value.length > 0
  if (hasInput) {
    const alert = await alertController.create({
      header: '등록 취소',
      message: '작성 중인 내용이 사라집니다. 취소할까요?',
      buttons: [
        { text: '계속 작성', role: 'cancel' },
        {
          text: '취소하기',
          role: 'destructive',
          handler: () => {
            reset()
            router.push('/tabs/home')
          },
        },
      ],
    })
    await alert.present()
    return
  }
  reset()
  router.push('/tabs/home')
}

async function save() {
  if (!form.value.homeId) {
    toast.error('집을 선택해주세요. 먼저 보관 장소에서 집을 등록하세요.')
    return
  }
  if (!form.value.roomId) {
    const alert = await alertController.create({
      header: '보관장소를 선택해주세요',
      message: '물건을 등록하려면 보관장소를 먼저 선택해야 합니다.',
      buttons: ['확인'],
    })
    await alert.present()
    return
  }
  savingText.value =
    pendingPhotos.value.length > 0
      ? `저장 중... (사진 ${pendingPhotos.value.length}장 업로드)`
      : '저장 중...'
  saving.value = true
  await paintNow() // 오버레이를 먼저 그린 뒤 무거운 작업 시작
  try {
    const payload = {
      name: form.value.name.trim(),
      quantity: form.value.quantity,
      description: form.value.description || null,
      purchaseDate: form.value.purchaseDate || null,
      expirationDate: form.value.expirationDate || null,
      homeId: form.value.homeId,
      roomId: form.value.roomId,
      storageLocationId: form.value.storageLocationId,
      categoryId: form.value.categoryId,
      tagIds: form.value.tagIds,
    }
    const saved = isEdit.value
      ? await itemApi.update(itemId.value as number, payload)
      : await itemApi.create(payload)

    for (const p of pendingPhotos.value) {
      let file = p.file
      if (!file && p.fetchUrl) {
        const blob = await (await fetch(p.fetchUrl)).blob()
        file = new File([blob], `photo_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' })
      }
      if (file) await itemApi.uploadImage(saved.id, file)
    }

    toast.success(isEdit.value ? '수정되었습니다.' : '등록되었습니다.')
    if (isEdit.value) {
      router.back()
    } else {
      reset()
      router.push(`/items/${saved.id}`)
    }
  } catch (e) {
    toast.error(extractErrorMessage(e, '저장에 실패했습니다.'))
  } finally {
    saving.value = false
  }
}

onIonViewWillEnter(load)
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button v-if="isEdit" default-href="/tabs/home" />
          <ion-button v-else @click="cancelForm">취소</ion-button>
        </ion-buttons>
        <ion-title>{{ isEdit ? '물건 수정' : '물건 등록' }}</ion-title>
        <ion-buttons slot="end" v-if="homes.length > 0">
          <ion-button @click="changeHome">
            {{ selectedHomeName }}
            <ion-icon slot="end" :icon="chevronDownOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding-bottom">
      <!-- 저장/사진 로딩 오버레이 -->
      <div v-if="busy" class="saving-overlay">
        <ion-spinner name="crescent" />
        <p>{{ busyText }}</p>
      </div>

      <div v-if="loading" class="center"><ion-spinner /></div>
      <template v-else>
        <div v-if="homes.length === 0" class="empty">
          <p>먼저 집을 등록해야 물건을 추가할 수 있어요.</p>
          <ion-button @click="router.push('/tabs/places')">보관 장소로 이동</ion-button>
        </div>

        <ion-list v-else>
          <ion-item>
            <ion-select
              label="보관장소 *"
              label-placement="stacked"
              v-model="form.roomId"
              placeholder="보관장소를 선택하세요"
              @ion-change="onRoomChange"
            >
              <ion-select-option v-for="r in rooms" :key="r.id" :value="r.id">
                {{ r.name }}
              </ion-select-option>
            </ion-select>
          </ion-item>
          <ion-item>
            <ion-input
              label="이름"
              label-placement="stacked"
              v-model="form.name"
              placeholder="예: 휴대전화 충전기 (선택)"
            />
          </ion-item>
          <ion-item>
            <ion-input
              label="수량"
              label-placement="stacked"
              type="number"
              min="0"
              v-model.number="form.quantity"
            />
          </ion-item>
          <ion-item>
            <ion-textarea label="설명" label-placement="stacked" v-model="form.description" :auto-grow="true" />
          </ion-item>
        </ion-list>

        <!-- 상세 정보: 기본은 접혀 있고 필요할 때 펼쳐서 입력 -->
        <ion-accordion-group>
          <ion-accordion value="detail">
            <ion-item slot="header">
              <ion-label>상세 정보 (선택)</ion-label>
            </ion-item>
            <div slot="content">
              <ion-list>
                <ion-item v-if="storages.length">
                  <ion-select
                    label="수납 위치"
                    label-placement="stacked"
                    v-model="form.storageLocationId"
                    placeholder="선택 안 함"
                  >
                    <ion-select-option :value="null">선택 안 함</ion-select-option>
                    <ion-select-option v-for="s in storages" :key="s.id" :value="s.id">
                      {{ s.label }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select
                    label="카테고리"
                    label-placement="stacked"
                    v-model="form.categoryId"
                    placeholder="선택 안 함"
                  >
                    <ion-select-option :value="null">선택 안 함</ion-select-option>
                    <ion-select-option v-for="c in categories" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-select
                    label="태그"
                    label-placement="stacked"
                    :multiple="true"
                    v-model="form.tagIds"
                    placeholder="선택 안 함"
                  >
                    <ion-select-option v-for="t in tags" :key="t.id" :value="t.id">
                      {{ t.name }}
                    </ion-select-option>
                  </ion-select>
                </ion-item>
                <ion-item>
                  <ion-input
                    label="구매일"
                    label-placement="stacked"
                    type="date"
                    v-model="form.purchaseDate"
                  />
                </ion-item>
                <ion-item>
                  <ion-input
                    label="유효기간"
                    label-placement="stacked"
                    type="date"
                    v-model="form.expirationDate"
                  />
                </ion-item>
              </ion-list>
            </div>
          </ion-accordion>
        </ion-accordion-group>

        <div v-if="homes.length > 0" class="ion-padding-horizontal">
          <ion-label class="section">사진</ion-label>

          <div v-if="images.length || pendingPhotos.length" class="images">
            <!-- 이미 저장된 사진(수정 화면) -->
            <div v-for="img in images" :key="img.id" class="img-box">
              <img :src="imageUrl(img.imageUrl)" alt="" />
              <ion-icon :icon="trashOutline" class="del" @click="deleteExistingImage(img.id)" />
            </div>
            <!-- 새로 추가한 사진 미리보기 -->
            <div v-for="(p, idx) in pendingPhotos" :key="'p' + idx" class="img-box">
              <img :src="p.previewUrl" alt="" />
              <ion-icon :icon="trashOutline" class="del" @click="removePendingPhoto(idx)" />
            </div>
          </div>

          <div class="photo-actions">
            <ion-button v-if="isNative" fill="outline" size="default" @click="addFromCamera">
              <ion-icon slot="start" :icon="cameraOutline" />
              사진 촬영
            </ion-button>
            <ion-button fill="outline" size="default" @click="openGallery">
              <ion-icon slot="start" :icon="imagesOutline" />
              갤러리
            </ion-button>
          </div>

          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            hidden
            @change="onFilesSelected"
          />
        </div>

        <div v-if="homes.length > 0" class="ion-padding">
          <ion-button expand="block" :disabled="saving" @click="save">
            {{ saving ? '저장 중...' : isEdit ? '수정 완료' : '등록하기' }}
          </ion-button>
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
.section {
  display: block;
  font-weight: 600;
  margin: 12px 0 8px;
}
.images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.photo-actions {
  display: flex;
  gap: 8px;
}
.photo-actions ion-button {
  flex: 1;
}
.img-box {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ion-color-light);
}
.img-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.del {
  position: absolute;
  top: 2px;
  right: 2px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  padding: 2px;
  font-size: 18px;
}
.pending-count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--ion-color-medium);
  font-size: 14px;
}
.saving-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
}
.saving-overlay ion-spinner {
  width: 44px;
  height: 44px;
  --color: #fff;
}
</style>
