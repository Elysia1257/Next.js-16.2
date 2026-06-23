// Minimal auto-auth helper for development
const AUTH_KEY = "cubex-auth";

interface AuthState {
  token: string;
  refreshToken: string;
  userId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

let _state: AuthState | null = null;

export function getToken(): string | null {
  if (_state) return _state.token;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    _state = JSON.parse(raw);
    return _state!.token;
  } catch { return null; }
}

export function getUserId(): string | null {
  if (_state) return _state.userId;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    _state = JSON.parse(raw);
    return _state!.userId;
  } catch { return null; }
}

function persist(state: AuthState) {
  _state = state;
  localStorage.setItem(AUTH_KEY, JSON.stringify(state));
}

export async function ensureAuth(): Promise<string> {
  const existing = getToken();
  if (existing) {
    // verify token is still valid
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${existing}` },
      });
      if (res.ok) {
        const data = await res.json();
        _state = { token: existing, refreshToken: _state?.refreshToken ?? "", userId: data.user_id };
        persist(_state);
        return existing;
      }
    } catch { /* fall through to try refresh or register */ }

    // try refresh
    if (_state?.refreshToken) {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: _state.refreshToken }),
        });
        if (res.ok) {
          const data = await res.json();
          _state = { token: data.access_token, refreshToken: data.refresh_token, userId: data.user_id };
          persist(_state);
          return data.access_token;
        }
      } catch { /* fall through to register */ }
    }
  }

  // auto-register
  const deviceId = getDeviceId();
  const email = `dev_${deviceId}@cubex.local`;
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "dev-mode" }),
  });
  if (!res.ok) {
    // maybe already registered, try login
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "dev-mode" }),
    });
    if (!loginRes.ok) throw new Error("Auth failed");
    const data = await loginRes.json();
    persist({ token: data.access_token, refreshToken: data.refresh_token, userId: data.user_id });
    return data.access_token;
  }
  const data = await res.json();
  persist({ token: data.access_token, refreshToken: data.refresh_token, userId: data.user_id });
  return data.access_token;
}

function getDeviceId(): string {
  const key = "cubex-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).substring(2, 10);
    localStorage.setItem(key, id);
  }
  return id;
}

export async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await ensureAuth();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
