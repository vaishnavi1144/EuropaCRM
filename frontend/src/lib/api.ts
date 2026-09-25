const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const browserHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_URL = configuredApiUrl || `http://${browserHost || 'localhost'}:4000/api`;
const TOKEN_KEY = 'europa_auth_token';

export type ApiListResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type ListOptions = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, string>;
};

export type AuthUser = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: string;
  permissions?: string[] | null;
  avatarUrl?: string | null;
  dashboardType?: string | null;
};

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  const token = getAuthToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? controller.signal,
  });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('The server is taking too long to respond. Please try again.');
    throw new Error('Unable to reach the Europa CRM server. Check that the backend is running.');
  } finally { window.clearTimeout(timeout); }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: response.statusText }));
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      setAuthToken(null);
      window.dispatchEvent(new Event('europa:unauthorized'));
    }
    throw new Error(payload.message ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (username: string, password: string, rememberMe = true) => request<{ token: string; expiresAt: string; user: AuthUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, rememberMe }) }),
  googleLogin: (credential: string, rememberMe = true) => request<{ token: string; expiresAt: string; user: AuthUser }>('/auth/google', { method: 'POST', body: JSON.stringify({ credential, rememberMe }) }),
  me: () => request<{ user: AuthUser }>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  list: <T>(resource: string, options: ListOptions = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(options.page ?? 1));
    params.set('limit', String(options.limit ?? 1000));
    if (options.search) params.set('search', options.search);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortOrder) params.set('sortOrder', options.sortOrder);
    Object.entries(options.filters ?? {}).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request<ApiListResponse<T>>(`/${resource}?${params.toString()}`);
  },
  get: <T>(resource: string, id: string) => request<T>(`/${resource}/${id}`),
  create: <T>(resource: string, data: Record<string, unknown>) => request<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
  update: <T>(resource: string, id: string, data: Record<string, unknown>) => request<T>(`/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (resource: string, id: string) => request<{ success: boolean }>(`/${resource}/${id}`, { method: 'DELETE' }),
  bulkRemove: (resource: string, ids: string[]) => request<{ success: boolean; deleted: number }>(`/${resource}`, { method: 'DELETE', body: JSON.stringify({ ids }) }),
  importRows: <T>(resource: string, rows: Record<string, unknown>[]) => request<{ inserted: T[]; errors: { row: number; message: string }[] }>(`/${resource}/import`, { method: 'POST', body: JSON.stringify({ rows }) }),
  sendEmail: (payload: { module: 'sales' | 'it' | 'bench' | 'ai'; from?: string; to?: string | string[]; cc?: string | string[]; subject: string; body: string; attachments?: { filename: string; content: string; contentType?: string }[]; submissionId?: string; groupId?: string; members?: { entityType: string; entityId: string }[]; excludedMembers?: { entityType: string; entityId: string }[] }) => request<{ success: boolean; messageId?: string }>('/email/send', { method: 'POST', body: JSON.stringify(payload) }),
  checkEmail: (module: 'sales' | 'it' | 'bench' | 'ai') => request<{ success: boolean; sender?: string }>(`/email/check/${module}`),
  listEmailMessages: <T>(module: 'sales' | 'it' | 'bench' | 'ai', folder = 'inbox', search = '') => request<{ data: T[]; counts: { inbox: number; inboxUnread: number; sent: number; starred?: number; drafts?: number; archive?: number; trash?: number; spam?: number } }>(`/email/messages?module=${module}&folder=${folder}&search=${encodeURIComponent(search)}`),
  getEmailMessage: <T>(id: string) => request<T>(`/email/messages/${id}`),
  starEmailMessage: <T>(id: string) => request<T>(`/email/messages/${id}/star`, { method: 'POST' }),
  moveEmailFolder: <T>(id: string, folder: string) => request<T>(`/email/messages/${id}/folder`, { method: 'PATCH', body: JSON.stringify({ folder }) }),
  bulkMoveEmailFolder: (ids: string[], folder: string) => request<{ success: boolean; count: number }>('/email/messages/bulk-folder', { method: 'POST', body: JSON.stringify({ ids, folder }) }),
  saveEmailDraft: <T>(data: { id?: string; module: 'sales' | 'it' | 'bench' | 'ai'; to?: string; cc?: string; subject?: string; body?: string; attachments?: { filename: string; content: string; contentType?: string; sizeText?: string }[] }) => request<T>('/email/drafts', { method: 'POST', body: JSON.stringify(data) }),
  deleteEmailMessage: (id: string, permanent = false) => request<{ success: boolean; permanent?: boolean; movedToTrash?: boolean }>(`/email/messages/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' }),
  bulkDeleteEmailMessages: (ids: string[], permanent = false) => request<{ success: boolean; permanent?: boolean; count: number }>('/email/messages/bulk-delete', { method: 'POST', body: JSON.stringify({ ids, permanent }) }),
  receiveSimulatedEmail: <T>(payload: { module: 'sales' | 'it' | 'bench' | 'ai'; fromEmail: string; fromName: string; subject: string; body: string }) => request<T>('/email/receive-simulated', { method: 'POST', body: JSON.stringify(payload) }),
  listMailGroups: <T>(module: 'sales' | 'it' | 'bench' | 'ai', search = '') => request<{ data: T[] }>(`/email/groups?module=${module}&search=${encodeURIComponent(search)}`),
  getMailGroup: <T>(id: string) => request<T>(`/email/groups/${id}`),
  createMailGroup: <T>(data: Record<string, unknown>) => request<T>('/email/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateMailGroup: <T>(id: string, data: Record<string, unknown>) => request<T>(`/email/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMailGroup: (id: string) => request<{ success: boolean }>(`/email/groups/${id}`, { method: 'DELETE' }),
  duplicateMailGroup: <T>(id: string) => request<T>(`/email/groups/${id}/duplicate`, { method: 'POST' }),
  searchMailRecipients: <T>(module: 'sales' | 'it' | 'bench' | 'ai', entityType: string, q: string) => request<{ data: T[] }>(`/email/recipients/search?module=${module}&entityType=${entityType}&q=${encodeURIComponent(q)}`),
  report: <T>(type: string) => request<T>(`/reports/${type}`),
  overview: <T>() => request<T>('/reports/overview'),
  benchDashboard: <T>(filters?: Record<string, string>) => {
    const params = new URLSearchParams();
    Object.entries(filters ?? {}).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request<T>(`/reports/bench-dashboard?${params.toString()}`);
  },
  globalSearch: <T>(query: string) => request<T>(`/search?q=${encodeURIComponent(query)}`),
  getSettings: <T>() => request<T>('/settings'),
  saveSettings: <T>(data: Record<string, unknown>) => request<T>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  workflow: <T>(path: string, data: Record<string, unknown> = {}) => request<T>(`/workflows/${path}`, { method: 'POST', body: JSON.stringify(data) }),
  notifications: <T>() => request<T>('/workflows/notifications'),
  uploadLocal: (filename: string, base64Data: string) => request<{ publicUrl: string; key: string }>('/uploads/local', { method: 'POST', body: JSON.stringify({ filename, base64Data }) }),
  parseResume: (filename: string, base64Data: string) => request<{ publicUrl: string; key: string; originalFilename: string; extractedText: string; parsed: Record<string, unknown> | null; parseSucceeded: boolean; warning?: string }>('/uploads/resume/parse', { method: 'POST', body: JSON.stringify({ filename, base64Data }) }),
  getEmailAccounts: () => request<{ data: Array<{ id: string; provider: string; emailAddress: string; isActive: boolean; createdAt: string }> }>('/email-accounts'),
  getGoogleConnectUrl: () => request<{ url: string }>('/email-accounts/google/connect'),
  disconnectGoogleAccount: () => request<{ success: boolean; message: string }>('/email-accounts/google/disconnect', { method: 'POST' }),
};
