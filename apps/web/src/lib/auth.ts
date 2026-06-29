export const AUTH_TOKEN_KEY = "wa_agent_access_token";
export const AUTH_USER_KEY = "wa_agent_user";
export const AUTH_COOKIE_KEY = "wa_agent_token";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export type AuthUser = {
  id: string;
  username: string | null;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  emailVerifiedAt: string | null;
  licenseExpiresAt: string | null;
  licenseStatus: "ACTIVE" | "EXPIRED" | "UNLIMITED";
  licenseExpired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LoginResponse = {
  accessToken: string;
  tokenType: "Bearer";
  user: AuthUser;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readCookie(name: string) {
  if (!isBrowser()) {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
}

export function getAuthCookieToken() {
  return readCookie(AUTH_COOKIE_KEY);
}

export function setAuthCookie(token: string) {
  if (!isBrowser()) {
    return false;
  }

  document.cookie = `${AUTH_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax`;

  return getAuthCookieToken() === token;
}

export function clearAuthCookie() {
  if (!isBrowser()) {
    return;
  }

  document.cookie = `${AUTH_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAuthToken() {
  if (!isBrowser()) {
    return null;
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? getAuthCookieToken();
}

export function getAuthUser() {
  if (!isBrowser()) {
    return null;
  }

  const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function setAuthSession(session: LoginResponse) {
  if (!isBrowser()) {
    return false;
  }

  window.localStorage.setItem(AUTH_TOKEN_KEY, session.accessToken);
  setStoredAuthUser(session.user);

  return setAuthCookie(session.accessToken);
}

export function setStoredAuthUser(user: AuthUser) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  clearAuthCookie();
}
