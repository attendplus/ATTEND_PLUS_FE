// API 클라이언트 - 백엔드 공통 응답 규격 { isSuccess, code, message, result }
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

// 토큰은 브라우저 저장소에 두지 않습니다. 서버가 HttpOnly 쿠키(ap_access 1시간, ap_refresh 12시간)로 관리합니다.
// CSRF 방어: 상태를 바꾸는 요청에는 사용자 정의 헤더(X-AttendPlus-Request: 1)를 붙입니다.
// 다른 사이트는 이 헤더를 붙여 요청할 수 없으므로(CORS 사전 요청에서 차단) 쿠키를 도용한 위조 요청이 서버에서 거부됩니다.
const CSRF_HEADERS = { "X-AttendPlus-Request": "1" };
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(`http://11.23.82.137:8000/api/v1${path}`);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, String(v));
  });
  return url.toString();
}

// 액세스 토큰이 만료되면(AUTH401) 리프레시 토큰으로 한 번만 갱신하고 원래 요청을 다시 보냅니다.
// 동시에 여러 요청이 만료되어도 갱신 요청은 하나만 보냅니다.
let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(buildUrl("/auth/refresh"), { method: "POST", credentials: "same-origin", headers: CSRF_HEADERS })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

const NO_REFRESH = new Set(["/auth/login", "/auth/refresh", "/auth/logout"]);

async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query; form?: FormData } = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { ...CSRF_HEADERS };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      credentials: "same-origin",
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
  } catch {
    throw new ApiError("NETWORK", "서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", 0);
  }

  let payload: { isSuccess?: boolean; code?: string; message?: string; result?: T } = {};
  try { payload = await res.json(); } catch { /* empty body */ }

  if (!res.ok || payload.isSuccess === false) {
    if (res.status === 401 && !NO_REFRESH.has(path)) {
      if (!retried && await refreshSession()) return request<T>(method, path, opts, true);
      onUnauthorized?.();
    }
    throw new ApiError(payload.code ?? String(res.status), payload.message ?? "요청을 처리하지 못했습니다.", res.status);
  }
  return payload.result as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body: body ?? {} }),
  del: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { form }),
};
