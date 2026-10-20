import { Platform } from 'react-native';

import { API_URL } from './config';
import type { Photo } from './types';

let token: string | null = null;
export function setApiToken(t: string | null) {
  token = t;
}

/** A failure the app can explain: `code` matches a key under "errors" in the translations. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body: any = {},
  ) {
    super(code);
  }
}

let onUnauthorized: (() => void) | undefined;
export function setOnUnauthorized(fn: () => void) {
  onUnauthorized = fn;
}

type Query = Record<string, string | number | boolean | undefined | null | (string | number)[]>;

function qs(query?: Query) {
  if (!query) return '';
  const parts = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v.join(',') : String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export async function api<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; query?: Query; form?: FormData } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}${qs(opts.query)}`, {
      method,
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, data.error ?? 'generic', data);
  }
  return data as T;
}

export const get = <T = any>(path: string, query?: Query) => api<T>('GET', path, { query });
export const post = <T = any>(path: string, body?: unknown) => api<T>('POST', path, { body: body ?? {} });
export const put = <T = any>(path: string, body?: unknown) => api<T>('PUT', path, { body: body ?? {} });
export const patch = <T = any>(path: string, body?: unknown) => api<T>('PATCH', path, { body: body ?? {} });
export const del = <T = any>(path: string) => api<T>('DELETE', path);

/** Photos are sent one at a time as a form upload. */
export async function uploadImage(path: string, localUri: string, method: 'POST' | 'PUT' = 'POST') {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    form.append('photo', blob, 'photo.jpg');
  } else {
    // React Native's FormData takes a file description instead of a Blob.
    form.append('photo', { uri: localUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  return api<any>(method, path, { form });
}

export const uploadPhoto = (localUri: string) => uploadImage('/photos', localUri) as Promise<Photo>;

/** The server sends absolute photo links when it knows its public address, relative ones otherwise. */
export function mediaUri(url: string | null | undefined) {
  if (!url) return undefined;
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}
