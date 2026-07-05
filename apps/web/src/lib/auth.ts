export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthResponse = {
  success: boolean;
  data: {
    user: AuthUser;
  };
};

function getApiBase() {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  if (import.meta.env.PROD) {
    throw new Error('Missing required frontend environment variable: VITE_API_URL');
  }
  return 'http://localhost:4000';
}

export const API_BASE = getApiBase();

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (
    !(init?.body instanceof FormData) &&
    init?.method &&
    ['POST', 'PUT', 'PATCH'].includes(init.method)
  ) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  const response = await globalThis.fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Request failed');
  }
  return payload as T;
}

export async function register(input: { name: string; email: string; password: string }) {
  const payload = await requestJson<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.data.user;
}

export async function login(input: { email: string; password: string }) {
  const payload = await requestJson<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.data.user;
}

export async function logout() {
  await requestJson('/api/auth/logout', { method: 'POST' });
}

export async function getCurrentUser() {
  const payload = await requestJson<AuthResponse>('/api/auth/me');
  return payload.data.user;
}
