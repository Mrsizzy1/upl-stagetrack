/**
 * Client HTTP unique.
 *  - Jeton d'accès gardé en mémoire uniquement (jamais dans localStorage).
 *  - Jeton de rafraîchissement dans un cookie httpOnly, illisible par le JavaScript.
 *  - Sur une réponse 401, une seule tentative de rafraîchissement, partagée par les requêtes en cours.
 * Les erreurs suivent le format de l'API : { statusCode, code, message, details? }.
 */
import type { Role } from './types';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: Role;
  studentId: string | null;
  mustChangePassword: boolean;
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let handlers: { onSession: (user: SessionUser) => void; onExpired: () => void } = {
  onSession: () => undefined,
  onExpired: () => undefined,
};

export function setSessionHandlers(h: typeof handlers): void {
  handlers = h;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Tente d'obtenir un nouveau jeton d'accès à partir du cookie de session. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const body = (await res.json()) as { accessToken: string; user: SessionUser };
      accessToken = body.accessToken;
      handlers.onSession(body.user);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(path: string, init: RequestInit, retry: boolean): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, NETWORK_ERROR, 'Erreur de connexion : le serveur est injoignable.');
  }

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return send(path, init, false);
    handlers.onExpired();
  }
  if (!response.ok) {
    const text = await response.text();
    let body: Partial<{ code: string; message: string; details: unknown }> = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      /* réponse non JSON */
    }
    throw new ApiError(response.status, body.code ?? 'ERROR', body.message ?? `Erreur ${response.status}`, body.details);
  }
  return response;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init, true);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  return (await send(path, {}, true)).blob();
}

const json = (body: unknown) => (body === undefined ? undefined : JSON.stringify(body));

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body: json(body) }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PUT', body: json(body) }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body: json(body) }),
  del: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'DELETE', body: json(body) }),
  upload: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'POST', body: form }),
};

/** Construit une chaîne de requête en ignorant les valeurs vides. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Télécharge un fichier renvoyé par l'API (PDF, Excel, PNG). */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Ouvre un PDF renvoyé par l'API dans un nouvel onglet (impression de carte). */
export async function openFile(path: string): Promise<void> {
  const blob = await apiBlob(path);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
