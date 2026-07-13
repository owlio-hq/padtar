const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export const authApi = {
  login: (password: string) => api.post<{ ok: boolean }>('/auth/login', { password }),
  verifyEdit: (password: string) => api.post<{ ok: boolean }>('/auth/verify-edit', { password }),
  changePassword: (which: 'login' | 'edit', currentEdit: string, newPassword: string) =>
    api.post<{ ok: boolean }>('/auth/change-password', {
      which,
      current_edit: currentEdit,
      new_password: newPassword,
    }),
}
