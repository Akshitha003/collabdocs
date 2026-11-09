export type User = { id: number; name: string; email: string };
export type Document = { id: number; title: string; content: Record<string, unknown>; owner_id: number; owner_name: string; is_owner: boolean; updated_at: string; shared_with: (User & {role:string})[] };
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export async function api<T>(path: string, userId?: number, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (userId) headers.set('X-User-Id', String(userId));
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(`${BASE}${path}`, { ...options, headers }); }
  catch { throw new Error('Cannot connect to the server. Check the backend and API URL.'); }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { const data = await response.json(); message = typeof data.detail === 'string' ? data.detail : message; } catch { /* no JSON */ }
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
