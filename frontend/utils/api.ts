const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function request(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      errMsg = err.detail || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

export const api = {
  get: (path: string, token?: string) => request('GET', path, undefined, token),
  post: (path: string, body: any, token?: string) => request('POST', path, body, token),
  put: (path: string, body: any, token?: string) => request('PUT', path, body, token),
  delete: (path: string, token?: string) => request('DELETE', path, undefined, token),
};
