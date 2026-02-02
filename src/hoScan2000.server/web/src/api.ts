const API_BASE = '/api/v1';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  // Stores
  getStores: () => fetchApi<{ stores: Store[] }>('/stores'),
  createStore: (data: CreateStoreInput) =>
    fetchApi<{ store: Store }>('/stores', { method: 'POST', body: JSON.stringify(data) }),
  deleteStore: (id: string) => fetchApi(`/stores/${id}`, { method: 'DELETE' }),

  // Stocktakes
  getStocktakes: (status?: string) =>
    fetchApi<{ stocktakes: Stocktake[] }>(`/stocktakes${status ? `?status=${status}` : ''}`),
  getStocktake: (id: string) => fetchApi<{ stocktake: Stocktake }>(`/stocktakes/${id}`),
  createStocktake: (data: CreateStocktakeInput) =>
    fetchApi<{ stocktake: Stocktake }>('/stocktakes', { method: 'POST', body: JSON.stringify(data) }),
  startStocktake: (id: string) =>
    fetchApi<{ stocktake: Stocktake }>(`/stocktakes/${id}/start`, { method: 'POST' }),
  pauseStocktake: (id: string) =>
    fetchApi<{ stocktake: Stocktake }>(`/stocktakes/${id}/pause`, { method: 'POST' }),
  completeStocktake: (id: string) =>
    fetchApi<{ stocktake: Stocktake }>(`/stocktakes/${id}/complete`, { method: 'POST' }),
  deleteStocktake: (id: string) => fetchApi(`/stocktakes/${id}`, { method: 'DELETE' }),

  // Areas
  createArea: (stocktakeId: string, data: CreateAreaInput) =>
    fetchApi<{ area: Area }>(`/stocktakes/${stocktakeId}/areas`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteArea: (stocktakeId: string, areaId: string) =>
    fetchApi(`/stocktakes/${stocktakeId}/areas/${areaId}`, { method: 'DELETE' }),

  // Scans
  getScans: (stocktakeId: string, params?: { areaId?: string; limit?: number }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return fetchApi<{ scans: Scan[]; total: number }>(
      `/stocktakes/${stocktakeId}/scans${query ? `?${query}` : ''}`
    );
  },
  getScansSummary: (stocktakeId: string) =>
    fetchApi<ScansSummary>(`/stocktakes/${stocktakeId}/scans/summary`),
  exportCsv: (stocktakeId: string) => `${API_BASE}/stocktakes/${stocktakeId}/export/csv`,

  // Master File
  getMasterInfo: (storeId: string) =>
    fetchApi<{ storeId: string; version: string; count: number }>(`/stores/${storeId}/master`),
  uploadMaster: (storeId: string, items: MasterItem[]) =>
    fetchApi(`/stores/${storeId}/master`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Devices
  getDevices: () => fetchApi<{ devices: Device[] }>('/devices'),
};

// Types
export interface Store {
  id: string;
  name: string;
  code: string;
  address?: string;
  timezone: string;
  createdAt: string;
}

export interface CreateStoreInput {
  name: string;
  code: string;
  address?: string;
}

export interface Stocktake {
  id: string;
  storeId: string;
  name: string;
  pin?: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  scheduledDate?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  store?: { id: string; name: string; code: string };
  areas?: Area[];
  sessions?: Session[];
  _count?: { areas: number; scans: number; sessions: number };
}

export interface CreateStocktakeInput {
  storeId: string;
  name: string;
  pin: string;
  scheduledDate?: string;
  notes?: string;
}

export interface Area {
  id: string;
  stocktakeId: string;
  name: string;
  code: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';
  sortOrder: number;
  claimedBy?: { device: { id: string; name: string } };
  _count?: { scans: number };
}

export interface CreateAreaInput {
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
}

export interface Session {
  id: string;
  deviceId: string;
  status: string;
  scansCount: number;
  device: { id: string; name: string };
}

export interface Scan {
  id: string;
  barcode: string;
  quantity: number;
  isValid: boolean;
  scannedAt: string;
  area: { code: string; name: string };
  device: { name: string };
}

export interface ScansSummary {
  totalScans: number;
  uniqueBarcodes: number;
  invalidScans: number;
  byArea: { id: string; name: string; code: string; status: string; scanCount: number }[];
}

export interface MasterItem {
  barcode: string;
  sku: string;
  description?: string;
  category?: string;
}

export interface Device {
  id: string;
  deviceIdentifier: string;
  name: string;
  platform: string;
  lastSeenAt?: string;
  createdAt: string;
  _count: { sessions: number; scans: number };
}
