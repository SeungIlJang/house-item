// 백엔드 공통 응답 및 도메인 타입 정의 (camelCase, 백엔드와 일치)

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string | null
  errorCode?: string
}

export interface PageData<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface User {
  id: number
  email: string
  name: string
  createdAt: string
}

export interface TokenData {
  accessToken: string
  tokenType: string
  user: User
}

export interface Home {
  id: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface Room {
  id: number
  homeId: number
  name: string
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface StorageLocation {
  id: number
  roomId: number
  parentId: number | null
  name: string
  description: string | null
  sortOrder: number
  fullPath: string
  createdAt: string
  updatedAt: string
}

export interface StorageTreeNode {
  id: number
  roomId: number
  parentId: number | null
  name: string
  description: string | null
  sortOrder: number
  children: StorageTreeNode[]
}

export interface Category {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface ItemImage {
  id: number
  imageUrl: string
  originalFilename: string | null
  sortOrder: number
  createdAt: string
}

export interface Item {
  id: number
  name: string
  description: string | null
  quantity: number
  memo: string | null
  purchaseDate: string | null
  expirationDate: string | null
  homeId: number
  roomId: number | null
  storageLocationId: number | null
  categoryId: number | null
  categoryName: string | null
  roomName: string | null
  storageFullPath: string | null
  tags: Tag[]
  images: ItemImage[]
  thumbnailUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface ItemPayload {
  name: string
  description?: string | null
  quantity: number
  memo?: string | null
  purchaseDate?: string | null
  expirationDate?: string | null
  homeId: number
  roomId?: number | null
  storageLocationId?: number | null
  categoryId?: number | null
  tagIds: number[]
}
