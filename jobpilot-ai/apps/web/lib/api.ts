// Server-side (SSR / RSC): Vercel injects the api service's internal URL via the binding as API_URL.
// Client-side (browser): NEXT_PUBLIC_API_URL is baked into the bundle at build time; when unset it
// defaults to a same-origin relative path, which Vercel's /api/* rewrite forwards to the api service.
const BASE =
  typeof window === 'undefined'
    ? `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1`
    : (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1');
const KEY = 'jobpilot.token';

// NOTE: a localStorage token is a development shortcut. Production should use an httpOnly cookie session.
export const token = {
  get: () => (typeof window === 'undefined' ? null : window.localStorage.getItem(KEY)),
  set: (t: string) => window.localStorage.setItem(KEY, t),
  clear: () => window.localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: { path: string; message: string }[]) { super(message); }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const t = token.get();
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/')) {
    token.clear(); window.location.href = '/login';
  }
  if (!res.ok) throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`, data?.issues);
  return data as T;
}

/** Authenticated file fetch (the token lives in localStorage, so a plain link cannot carry it). */
export async function apiBlob(path: string): Promise<Blob> {
  const t = token.get();
  const res = await fetch(`${BASE}${path}`, { headers: t ? { authorization: `Bearer ${t}` } : {} });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(res.status, d?.message ?? `Request failed (${res.status})`); }
  return res.blob();
}

export const errText = (e: unknown) =>
  e instanceof ApiError ? (e.issues?.length ? `${e.message}: ${e.issues.map((i) => `${i.path} ${i.message}`).join('; ')}` : e.message)
    : 'Could not reach the server. Is the API running?';
