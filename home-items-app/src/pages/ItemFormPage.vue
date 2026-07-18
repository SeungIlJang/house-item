<script setup lang="ts">
import { ref, computed } from 'vue'
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
  IonModal,
  alertController,
  onIonViewWillEnter,
} from '@ionic/vue'
import {
  trashOutline,
  chevronDownOutline,
  cameraOutline,
  imagesOutline,
  refreshOutline,
} from 'ionicons/icons'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
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

const homes = ref<Home[]>([])
const rooms = ref<Room[]>([])
const storages = ref<{ id: number; label: string }[]>([])
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const images = ref<ItemImage[]>([])
interface PendingPhoto {
  file: File
  source: CameraSource | null
  url: string // 미리보기용 object URL
}
const pendingPhotos = ref<PendingPhoto[]>([])

function makePhoto(file: File, source: CameraSource | null): PendingPhoto {
  return { file, source, url: URL.createObjectURL(file) }
}

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

function onFilesSelected(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files) {
    for (const file of Array.from(input.files)) {
      pendingPhotos.value.push(makePhoto(file, null))
    }
  }
  input.value = ''
}

// 카메라/갤러리에서 사진 1장을 가져와 File 로 변환 (편집 없이 원본 그대로)
async function capturePhoto(source: CameraSource): Promise<File | null> {
  const photo = await Camera.getPhoto({
    source, // Camera(촬영) 또는 Photos(갤러리)
    resultType: CameraResultType.Base64,
    quality: 90,
    correctOrientation: true,
    allowEditing: false,
  })
  if (!photo.base64String) return null
  const format = photo.format || 'jpeg'
  const dataUrl = `data:image/${format};base64,${photo.base64String}`
  const blob = await (await fetch(dataUrl)).blob()
  return new File([blob], `photo_${Date.now()}.${format}`, { type: `image/${format}` })
}

function isUserCancel(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : ''
  return /cancel/i.test(msg)
}

function removePendingFile(index: number) {
  URL.revokeObjectURL(pendingPhotos.value[index].url)
  pendingPhotos.value.splice(index, 1)
}

// ----- 앱 내장 사진 편집기(자르기/회전) -----
// 흐름: 촬영/선택 → 편집 화면(선택 사항으로 편집) → [선택] 눌러 확정
const editorOpen = ref(false)
const editMode = ref<'add' | 'replace'>('add')
const editIndex = ref(-1)
const editSource = ref<CameraSource | null>(null)
const editSrc = ref('') // 편집기에 보여줄 임시 object URL
const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

// 편집 화면을 기본 크롭 영역을 이미지 전체로 설정 → 그냥 [선택] 하면 원본 그대로
function defaultFullSize({ imageSize }: { imageSize: { width: number; height: number } }) {
  return { width: imageSize.width, height: imageSize.height }
}

// 촬영(카메라) → 1장 촬영 후 편집 화면 열기 (아직 목록에 추가하지 않음)
async function pickPhoto(source: CameraSource) {
  try {
    const file = await capturePhoto(source)
    if (!file) return
    editMode.value = 'add'
    editSource.value = source
    editSrc.value = URL.createObjectURL(file)
    editorOpen.value = true
  } catch (e) {
    if (!isUserCancel(e)) toast.error('사진을 가져오지 못했습니다.')
  }
}

// 갤러리 → 표준 파일 선택창으로 여러 장 선택 (실제 File 을 바로 받아 미리보기·업로드가 안정적)
const fileInput = ref<HTMLInputElement | null>(null)
function openGallery() {
  fileInput.value?.click()
}

// 이미 추가한 사진을 다시 편집
function editPhoto(index: number) {
  editMode.value = 'replace'
  editIndex.value = index
  editSource.value = pendingPhotos.value[index].source
  editSrc.value = pendingPhotos.value[index].url
  editorOpen.value = true
}

function rotateEditor() {
  cropperRef.value?.rotate(90)
}

function closeEditor() {
  // add 모드에서 임시로 만든 object URL 정리 (replace 모드는 목록 url 을 재사용하므로 유지)
  if (editMode.value === 'add' && editSrc.value) URL.revokeObjectURL(editSrc.value)
  editorOpen.value = false
  editIndex.value = -1
}

// [선택] — 현재 편집 상태(자르기/회전 반영)를 확정
function applyEdit() {
  const canvas = cropperRef.value?.getResult()?.canvas
  if (!canvas) {
    closeEditor()
    return
  }
  canvas.toBlob(
    (blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = URL.createObjectURL(file)
        if (editMode.value === 'replace' && editIndex.value >= 0) {
          const old = pendingPhotos.value[editIndex.value]
          URL.revokeObjectURL(old.url)
          pendingPhotos.value[editIndex.value] = { file, source: old.source, url }
        } else {
          pendingPhotos.value.push({ file, source: editSource.value, url })
        }
      }
      closeEditor()
    },
    'image/jpeg',
    0.92,
  )
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
  pendingPhotos.value.forEach((p) => URL.revokeObjectURL(p.url))
  pendingPhotos.value = []
  images.value = []
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
  saving.value = true
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

    for (const photo of pendingPhotos.value) {
      await itemApi.uploadImage(saved.id, photo.file)
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
        <ion-buttons slot="start" v-if="isEdit">
          <ion-back-button default-href="/tabs/home" />
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
          <div class="images">
            <div v-for="img in images" :key="img.id" class="img-box">
              <img :src="imageUrl(img.imageUrl)" alt="" />
              <ion-icon :icon="trashOutline" class="del" @click="deleteExistingImage(img.id)" />
            </div>
            <div v-for="(p, idx) in pendingPhotos" :key="'p' + idx" class="img-box pending">
              <img :src="p.url" alt="" />
              <ion-icon :icon="trashOutline" class="del" @click="removePendingFile(idx)" />
              <button type="button" class="edit-btn" @click="editPhoto(idx)">편집</button>
            </div>
          </div>

          <div class="photo-actions">
            <!-- 촬영은 네이티브 카메라 사용 -->
            <ion-button
              v-if="isNative"
              fill="outline"
              size="default"
              @click="pickPhoto(CameraSource.Camera)"
            >
              <ion-icon slot="start" :icon="cameraOutline" />
              사진 촬영
            </ion-button>
            <!-- 갤러리는 표준 파일 선택창(여러 장 선택) -->
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

      <!-- 앱 내장 사진 편집기: 촬영/선택 후 (원하면) 자르기·회전 → [선택]으로 확정 -->
      <ion-modal :is-open="editorOpen" @did-dismiss="closeEditor">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closeEditor">취소</ion-button>
            </ion-buttons>
            <ion-title>사진 편집</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="rotateEditor">
                <ion-icon slot="icon-only" :icon="refreshOutline" />
              </ion-button>
              <ion-button strong @click="applyEdit">선택</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content :scroll-y="false" class="editor-content">
          <cropper
            ref="cropperRef"
            class="cropper"
            :src="editSrc"
            :default-size="defaultFullSize"
            image-restriction="fit-area"
          />
          <p class="editor-hint">필요하면 자르거나 회전하고, [선택]을 눌러 추가하세요.</p>
        </ion-content>
      </ion-modal>
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
.edit-btn {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  border: none;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  font-size: 12px;
  padding: 3px 0;
  cursor: pointer;
}
.editor-content {
  --background: #000;
}
.cropper {
  width: 100%;
  height: 80vh;
  background: #000;
}
.editor-hint {
  color: #bbb;
  text-align: center;
  font-size: 13px;
  margin: 8px;
}
</style>
