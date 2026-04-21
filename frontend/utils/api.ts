import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getBaseUrl(): string {
  // On web: use EXPO_PUBLIC_API_BASE_URL (proxied by Expo dev server or set explicitly)
  if (Platform.OS === 'web') {
    return process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
  }
  // On native (Expo Go / APK): derive backend host from the Metro bundler address.
  // Both Metro and Spring Boot run on the same machine — only the port differs.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(':')[0]; // strip port, keep IP
    return `http://${host}:8080`;
  }
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
}

const BASE_URL = getBaseUrl();

async function request(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      errMsg = err.message || err.detail || errMsg;
    } catch {}
    const error = Object.assign(new Error(errMsg), { status: res.status });
    throw error;
  }
  // 204 No Content
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  get:    (path: string, token?: string)              => request('GET',    path, undefined, token),
  post:   (path: string, body: any, token?: string)   => request('POST',   path, body,      token),
  put:    (path: string, body: any, token?: string)   => request('PUT',    path, body,      token),
  delete: (path: string, token?: string)              => request('DELETE', path, undefined, token),
};
