// ============================================================
// Environment-agnostic HTTP client for backend interaction
// (Appwrite / Cloudflare Functions / any REST backend).
//
// Core rules:
//  - No `fetch`, no `XMLHttpRequest`, no `window`/`localStorage` here.
//  - The transport is INJECTED by the app layer (web injects global
//    fetch, React Native injects fetch from react-native).
//    This keeps core testable in Node and portable to Swift.
// ============================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequest {
  method?: HttpMethod;
  /** Absolute or relative URL */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

/** Minimal transport contract - the ONLY environment dependency of core. */
export interface HttpClient {
  request<T = unknown>(req: ApiRequest): Promise<ApiResponse<T>>;
}

// Structural subset of the global `fetch` API. Core declares its own types so
// it never depends on DOM lib types - web can pass `fetch`, RN can pass
// `fetch` from react-native, Swift can implement the same shape later.
export interface FetcherInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface FetcherResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type Fetcher = (url: string, init: FetcherInit) => Promise<FetcherResponse>;

export interface CreateApiClientOptions {
  /** e.g. 'https://cloud.appwrite.io/v1' */
  baseUrl: string;
  /** Injected transport. Apps pass `fetch` (web / RN) - it is structurally compatible. */
  fetch: Fetcher;
  /** Default headers, e.g. `{ 'X-Appwrite-Project': projectId }` */
  defaultHeaders?: Record<string, string>;
  /** e.g. `new (crypto.subtle || undefined)` providers... left to apps */
  onError?: (req: ApiRequest, error: unknown) => void;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: ApiRequest['query'],
): string {
  // Manual URL building - no `URL` global, works everywhere (web / RN / Node / Swift port)
  const base = path.startsWith('http') ? path : `${baseUrl}${path}`;
  if (!query) return base;
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return pairs.length > 0 ? `${base}?${pairs.join('&')}` : base;
}

/**
 * Creates an environment-agnostic API client.
 * Usage:
 *   const client = createApiClient({ baseUrl, fetch });
 *   const { data } = await client.get('/recipes', { target: '#FF0000' });
 */
export function createApiClient(options: CreateApiClientOptions): HttpClient {
  const { baseUrl, defaultHeaders = {} } = options;

  return {
    async request<T = unknown>(req: ApiRequest): Promise<ApiResponse<T>> {
      const { method = 'GET', path, query, body, headers } = req;
      const init: FetcherInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...defaultHeaders,
          ...headers,
        },
      };
      if (body !== undefined) {
        init.body = JSON.stringify(body);
      }

      try {
        const res = await options.fetch(buildUrl(baseUrl, path, query), init);
        const text = await res.text();
        const data = text ? (JSON.parse(text) as T) : (undefined as T);
        if (!res.ok) {
          throw new Error(`API ${method} ${path} failed: ${res.status} ${text}`);
        }
        return { status: res.status, data };
      } catch (error) {
        options.onError?.(req, error);
        throw error;
      }
    },
  };
}

// Convenience helpers
export interface ApiClient extends HttpClient {
  get<T = unknown>(
    path: string,
    query?: ApiRequest['query'],
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>>;
  post<T = unknown>(
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>>;
}

export function createApiService(options: CreateApiClientOptions): ApiClient {
  const client = createApiClient(options);
  return {
    ...client,
    get: (path, query, headers) => client.request({ method: 'GET', path, query, headers }),
    post: (path, body, headers) => client.request({ method: 'POST', path, body, headers }),
  };
}
