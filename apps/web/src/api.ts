import type { AidStatus, AidType, DamageLevel, DamageSuggestion, PropertyType, ReportStatus, Role } from '@damage/shared'

export type SessionUser = {
  id: string
  fullName: string
  email: string
  phone: string
  role: Role
  organizationId: string | null
  isActive: boolean
  organization: { id: string; name: string } | null
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

async function parseError(response: Response) {
  const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null
  const message = Array.isArray(body?.message) ? body?.message.join('، ') : body?.message
  return new ApiError(message || 'تعذر إكمال الطلب', response.status)
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(path, { ...options, headers, credentials: 'include' })
  if (response.status === 401 && retry && !path.startsWith('/api/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed) return api<T>(path, options, false)
  }
  if (!response.ok) throw await parseError(response)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function refreshSession() {
  const response = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  if (!response.ok) {
    setAccessToken(null)
    return null
  }
  const data = (await response.json()) as { accessToken: string; user: SessionUser }
  setAccessToken(data.accessToken)
  return data
}

export async function apiBlob(path: string) {
  const load = async (retry: boolean): Promise<Blob> => {
    const headers = new Headers()
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetch(path, { headers, credentials: 'include' })
    if (response.status === 401 && retry) {
      const refreshed = await refreshSession()
      if (refreshed) return load(false)
    }
    if (!response.ok) throw await parseError(response)
    return response.blob()
  }
  return load(true)
}

export type ReportListItem = {
  id: string
  referenceCode: string
  description: string
  damageLevel: DamageLevel
  status: ReportStatus
  createdAt: string
  submittedAt: string | null
  imageCount: number
  property: { address: string; lat: number; lng: number; propertyType: PropertyType }
  submittedBy: { id: string; fullName: string; role: Role }
}

export type ReportDetail = {
  id: string
  referenceCode: string
  description: string
  damageLevel: DamageLevel
  status: ReportStatus
  rejectionReason: string | null
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string
  property: { id: string; address: string; lat: number; lng: number; propertyType: PropertyType }
  images: { id: string; originalName: string; mimeType: string; sizeBytes: number; url: string }[]
  submittedBy: { id: string; fullName: string; role: Role; email?: string; phone?: string }
  reviewedBy: { id: string; fullName: string } | null
  reviewLogs: {
    id: string
    action: 'APPROVE' | 'REJECT' | 'EDIT'
    note: string
    createdAt: string
    actor: { id: string; fullName: string }
  }[]
  aidRecords?: {
    id: string
    aidType: AidType
    status: AidStatus
    notes: string
    scheduledAt?: string | null
    deliveredAt?: string | null
    createdAt?: string
    organization: { id: string; name: string }
  }[]
  assessment: {
    status: 'READY' | 'UNAVAILABLE' | 'FAILED'
    modelName: string
    suggestedLevel: DamageLevel | null
    confidence: number | null
    coverageRatio: number | null
    summary: string
    totals: DamageSuggestion['totals']
    images: DamageSuggestion['images']
  } | null
}

export type MapFeatureCollection = {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] }
    properties: { id: string; referenceCode: string; damageLevel: DamageLevel; status: ReportStatus }
  }[]
}

export type ListFilters = {
  status?: string
  damageLevel?: string
  propertyType?: string
  q?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

function queryString(filters: ListFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  const text = params.toString()
  return text ? `?${text}` : ''
}

export const reportsApi = {
  list: (filters: ListFilters) =>
    api<{ items: ReportListItem[]; total: number; page: number; pageSize: number }>(`/api/reports${queryString(filters)}`),
  map: (filters: ListFilters & { west: number; south: number; east: number; north: number }) =>
    api<MapFeatureCollection>(`/api/reports/map${queryString(filters)}`),
  get: (id: string) => api<ReportDetail>(`/api/reports/${id}`),
  create: (body: FormData) => api<ReportDetail>('/api/reports', { method: 'POST', body }),
  update: (id: string, body: unknown) => api<ReportDetail>(`/api/reports/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  submit: (id: string) => api<ReportDetail>(`/api/reports/${id}/submit`, { method: 'POST' }),
  review: (id: string, body: unknown) =>
    api<ReportDetail>(`/api/reports/${id}/review`, { method: 'POST', body: JSON.stringify(body) }),
  addImages: (id: string, body: FormData) => api<ReportDetail>(`/api/reports/${id}/images`, { method: 'POST', body }),
  removeImage: (id: string, imageId: string) =>
    api<{ ok: boolean }>(`/api/reports/${id}/images/${imageId}`, { method: 'DELETE' }),
  assess: (id: string) => api<ReportDetail>(`/api/reports/${id}/assess`, { method: 'POST' }),
  preview: (body: FormData) =>
    api<{
      status: 'READY' | 'UNAVAILABLE' | 'FAILED'
      suggestedLevel: DamageLevel | null
      confidence: number | null
      coverageRatio: number | null
      summary: string
      totals: DamageSuggestion['totals']
    }>('/api/reports/preview', { method: 'POST', body }),
}

export type Org = {
  id: string
  name: string
  description: string
  contactEmail: string
  contactPhone: string
  isActive: boolean
}

export type ManagedUser = {
  id: string
  fullName: string
  email: string
  phone: string
  role: Role
  organizationId: string | null
  isActive: boolean
  organization: { id: string; name: string } | null
}

export type AidRow = {
  id: string
  aidType: AidType
  status: AidStatus
  notes: string
  scheduledAt: string | null
  deliveredAt: string | null
  organization: { id: string; name: string }
  report: { id: string; referenceCode: string; damageLevel: DamageLevel; status: ReportStatus; property?: { address: string } }
}

export type StatsOverview = {
  reportsByStatus: { status: ReportStatus; count: number }[]
  reportsByDamage: { damageLevel: DamageLevel; count: number }[]
  reportsByPropertyType: { propertyType: PropertyType; count: number }[]
  pendingReview: number
  series: { day: string; count: number }[]
  aidByStatus: { status: AidStatus; count: number }[]
}
