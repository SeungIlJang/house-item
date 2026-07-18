// 도메인별 API 호출 모음. 응답 래퍼(ApiResponse)에서 data 를 꺼내 반환한다.
import client from './client'
import type {
  ApiResponse,
  Category,
  Home,
  Item,
  ItemImage,
  ItemPayload,
  PageData,
  Room,
  StorageLocation,
  StorageTreeNode,
  Tag,
  TokenData,
  User,
} from '@/types/api'

function unwrap<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data as T
}

// ----- 인증 -----
export const authApi = {
  async signup(email: string, password: string, name: string): Promise<User> {
    return unwrap<User>(await client.post('/auth/signup', { email, password, name }))
  },
  async login(email: string, password: string): Promise<TokenData> {
    return unwrap<TokenData>(await client.post('/auth/login', { email, password }))
  },
  async me(): Promise<User> {
    return unwrap<User>(await client.get('/users/me'))
  },
}

// ----- 집 -----
export const homeApi = {
  async list(): Promise<Home[]> {
    return unwrap<Home[]>(await client.get('/homes'))
  },
  async create(name: string, description?: string): Promise<Home> {
    return unwrap<Home>(await client.post('/homes', { name, description }))
  },
  async update(id: number, name: string, description?: string): Promise<Home> {
    return unwrap<Home>(await client.put(`/homes/${id}`, { name, description }))
  },
  async remove(id: number): Promise<void> {
    await client.delete(`/homes/${id}`)
  },
}

// ----- 보관장소(방) -----
export const roomApi = {
  async listByHome(homeId: number): Promise<Room[]> {
    return unwrap<Room[]>(await client.get(`/homes/${homeId}/rooms`))
  },
  async create(homeId: number, name: string, description?: string, sortOrder = 0): Promise<Room> {
    return unwrap<Room>(
      await client.post(`/homes/${homeId}/rooms`, { name, description, sortOrder }),
    )
  },
  async update(id: number, name: string, description?: string, sortOrder = 0): Promise<Room> {
    return unwrap<Room>(await client.put(`/rooms/${id}`, { name, description, sortOrder }))
  },
  async remove(id: number): Promise<void> {
    await client.delete(`/rooms/${id}`)
  },
}

// ----- 수납공간 -----
export const storageApi = {
  async tree(roomId: number): Promise<StorageTreeNode[]> {
    return unwrap<StorageTreeNode[]>(await client.get(`/rooms/${roomId}/storage-locations`))
  },
  async create(
    roomId: number,
    name: string,
    parentId?: number | null,
    description?: string,
  ): Promise<StorageLocation> {
    return unwrap<StorageLocation>(
      await client.post(`/rooms/${roomId}/storage-locations`, { name, parentId, description }),
    )
  },
  async get(id: number): Promise<StorageLocation> {
    return unwrap<StorageLocation>(await client.get(`/storage-locations/${id}`))
  },
  async update(id: number, name: string, parentId?: number | null): Promise<StorageLocation> {
    return unwrap<StorageLocation>(await client.put(`/storage-locations/${id}`, { name, parentId }))
  },
  async remove(id: number): Promise<void> {
    await client.delete(`/storage-locations/${id}`)
  },
}

// ----- 카테고리 -----
export const categoryApi = {
  async list(): Promise<Category[]> {
    return unwrap<Category[]>(await client.get('/categories'))
  },
  async create(name: string): Promise<Category> {
    return unwrap<Category>(await client.post('/categories', { name }))
  },
  async update(id: number, name: string): Promise<Category> {
    return unwrap<Category>(await client.put(`/categories/${id}`, { name }))
  },
  async remove(id: number): Promise<void> {
    await client.delete(`/categories/${id}`)
  },
}

// ----- 태그 -----
export const tagApi = {
  async list(): Promise<Tag[]> {
    return unwrap<Tag[]>(await client.get('/tags'))
  },
  async create(name: string): Promise<Tag> {
    return unwrap<Tag>(await client.post('/tags', { name }))
  },
  async update(id: number, name: string): Promise<Tag> {
    return unwrap<Tag>(await client.put(`/tags/${id}`, { name }))
  },
  async remove(id: number): Promise<void> {
    await client.delete(`/tags/${id}`)
  },
}

export interface ItemSearchParams {
  keyword?: string
  homeId?: number
  roomId?: number
  storageLocationId?: number
  categoryId?: number
  tagId?: number
  sort?: string
  page?: number
  size?: number
}

// ----- 물건 -----
export const itemApi = {
  async search(params: ItemSearchParams): Promise<PageData<Item>> {
    // 백엔드 검색 쿼리는 snake_case
    const query: Record<string, string | number> = {}
    if (params.keyword) query.keyword = params.keyword
    if (params.homeId) query.home_id = params.homeId
    if (params.roomId) query.room_id = params.roomId
    if (params.storageLocationId) query.storage_location_id = params.storageLocationId
    if (params.categoryId) query.category_id = params.categoryId
    if (params.tagId) query.tag_id = params.tagId
    if (params.sort) query.sort = params.sort
    query.page = params.page ?? 1
    query.size = params.size ?? 20
    return unwrap<PageData<Item>>(await client.get('/items/search', { params: query }))
  },
  async list(page = 1, size = 20): Promise<PageData<Item>> {
    return unwrap<PageData<Item>>(await client.get('/items', { params: { page, size } }))
  },
  async get(id: number): Promise<Item> {
    return unwrap<Item>(await client.get(`/items/${id}`))
  },
  async create(payload: ItemPayload): Promise<Item> {
    return unwrap<Item>(await client.post('/items', payload))
  },
  async update(id: number, payload: ItemPayload): Promise<Item> {
    return unwrap<Item>(await client.put(`/items/${id}`, payload))
  },
  async remove(id: number): Promise<void> {
    await client.delete(`/items/${id}`)
  },
  async uploadImage(itemId: number, file: File): Promise<ItemImage> {
    const form = new FormData()
    form.append('file', file)
    return unwrap<ItemImage>(
      await client.post(`/items/${itemId}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    )
  },
  async removeImage(itemId: number, imageId: number): Promise<void> {
    await client.delete(`/items/${itemId}/images/${imageId}`)
  },
}

// 이미지 절대 URL (백엔드 정적 경로)
export function imageUrl(path: string | null): string | undefined {
  if (!path) return undefined
  const base = import.meta.env.VITE_API_BASE_URL.replace(/\/api\/v1$/, '')
  return `${base}${path}`
}
