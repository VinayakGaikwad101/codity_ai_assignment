const API_HOST = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:4000`
  : 'http://localhost:4000';
const BASE_URL = `${API_HOST}/api/v1`;

export class ApiError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code = 'ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('djs_auth_token');
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization') && !headers.has('X-API-Key')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success) {
    const errorMsg = data?.error?.message || `HTTP ${response.status}: Request failed`;
    const errorCode = data?.error?.code || 'HTTP_ERROR';
    throw new ApiError(errorMsg, errorCode, data?.error?.details);
  }

  return data.data as T;
}
