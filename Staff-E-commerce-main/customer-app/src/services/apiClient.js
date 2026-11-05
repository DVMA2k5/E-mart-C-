// Single entry point for every HTTP call of the customer app.
// A 401 on a request that carried a bearer token means the session expired or was revoked (password/role change,
// account locked). In that case the registered handler logs the customer out once, and the call rejects with a
// clear message instead of the generic "cannot reach the store" text.

export const SESSION_EXPIRED_MESSAGE = "Phiên làm việc đã hết hạn, vui lòng đăng nhập lại";

export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = "SessionExpiredError";
    this.sessionExpired = true;
  }
}

let sessionExpiredHandler = null;

/** Registers the app's logout-on-expiry callback. Returns an unsubscribe function. */
export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null;
  };
}

function bearerToken(headers) {
  if (!headers) return "";
  const value = typeof headers.get === "function"
    ? headers.get("Authorization")
    : Object.entries(headers).find(([name]) => name.toLowerCase() === "authorization")?.[1];
  return typeof value === "string" && value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);
  const token = bearerToken(options.headers);
  if (response.status === 401 && token) {
    // The handler compares the token with the current session, so a late answer to a request sent by a previous
    // session cannot log out the account that is signed in now.
    try { sessionExpiredHandler?.(token); } catch { /* logging out must never mask the original failure */ }
    throw new SessionExpiredError();
  }
  return response;
}
