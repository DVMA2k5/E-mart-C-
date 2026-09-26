let pendingRequests = 0;
const listeners = new Set();

function notify() {
  const isActive = pendingRequests > 0;
  listeners.forEach((listener) => {
    try {
      listener(isActive);
    } catch (err) {
      console.error("requestTracker listener error", err);
    }
  });
}

export function trackRequestStart() {
  pendingRequests += 1;
  notify();
}

export function trackRequestEnd() {
  pendingRequests = Math.max(0, pendingRequests - 1);
  notify();
}

export function subscribeRequestTracker(listener) {
  listeners.add(listener);
  listener(pendingRequests > 0);
  return () => listeners.delete(listener);
}

export function hasPendingRequests() {
  return pendingRequests > 0;
}
