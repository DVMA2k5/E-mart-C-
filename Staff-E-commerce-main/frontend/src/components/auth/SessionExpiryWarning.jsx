// src/components/auth/SessionExpiryWarning.jsx
//
// Warns 5 minutes before the login token expires, so nobody loses a half-filled form to a sudden logout.
// "Gia hạn phiên" renews the token (POST /api/me/session/refresh) without leaving the page.
// No polling: one timer waits for the warning time; a 1-second countdown runs only while the warning is shown.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAuthToken,
  getTokenExpiry,
  logout,
  refreshSession,
  subscribeAuthToken,
} from "../../api/apiClient";

const WARNING_BEFORE_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 2 ** 31 - 1; // setTimeout limit

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SessionExpiryWarning() {
  const navigate = useNavigate();
  const [expiresAt, setExpiresAt] = useState(() => getTokenExpiry(getAuthToken() || ""));
  const [now, setNow] = useState(() => Date.now());
  const [warning, setWarning] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState("");
  const [dismissedFor, setDismissedFor] = useState(null); // expiry time whose warning was closed ("Để sau")
  const visible = warning && Boolean(expiresAt) && dismissedFor !== expiresAt;

  // Follow token changes: login, renewal, logout, or another tab.
  useEffect(() => subscribeAuthToken((token) => {
    setExpiresAt(token ? getTokenExpiry(token) : null);
    setError("");
  }), []);

  const expire = useCallback(() => {
    logout();
    navigate("/login", { replace: true, state: { message: "Phiên làm việc đã hết hạn, vui lòng đăng nhập lại." } });
  }, [navigate]);

  // One timer to the warning moment, plus a re-check when the tab becomes visible (timers pause during sleep).
  useEffect(() => {
    if (!expiresAt) {
      setWarning(false);
      return undefined;
    }
    let timer = null;
    const evaluate = () => {
      window.clearTimeout(timer);
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expire();
        return;
      }
      if (remaining <= WARNING_BEFORE_MS) {
        setNow(Date.now());
        setWarning(true);
        timer = window.setTimeout(evaluate, remaining); // log out on time even if the warning was dismissed
        return;
      }
      setWarning(false);
      timer = window.setTimeout(evaluate, Math.min(remaining - WARNING_BEFORE_MS, MAX_TIMEOUT_MS));
    };
    const onVisible = () => { if (document.visibilityState === "visible") evaluate(); };
    evaluate();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [expiresAt, expire]);

  // Countdown only while the warning is on screen.
  useEffect(() => {
    if (!visible) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [visible]);

  const renew = async () => {
    if (renewing) return;
    setRenewing(true);
    setError("");
    try {
      await refreshSession(); // the token listener moves the timers to the new expiry
      setWarning(false);
    } catch (renewError) {
      setError(renewError.message || "Không gia hạn được phiên. Hãy lưu dữ liệu và đăng nhập lại.");
    } finally {
      setRenewing(false);
    }
  };

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-[1000] w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-lg"
    >
      <p className="font-semibold">Phiên làm việc sắp hết hạn</p>
      <p className="mt-1 text-sm">
        Còn <span className="font-mono font-semibold tabular-nums">{formatRemaining(expiresAt - now)}</span>.
        Hãy lưu dữ liệu đang nhập, hoặc gia hạn để tiếp tục làm việc.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={renew}
          disabled={renewing}
          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {renewing ? "Đang gia hạn..." : "Gia hạn phiên"}
        </button>
        <button
          type="button"
          onClick={() => setDismissedFor(expiresAt)}
          className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-100"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
