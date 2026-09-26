// src/api/patchAllRequests.js
import axios from "axios";
import { getAuthToken, getCurrentUserId } from "./apiClient";

// -------------------------
// Patch global fetch
// -------------------------
(function patchFetch() {
  const originalFetch = window.fetch;

  window.fetch = async function (url, options = {}) {
    options = { ...options };
    options.headers = { ...(options.headers || {}) };

    // gắn Authorization nếu chưa có
    if (!options.headers["Authorization"]) {
      const token = getAuthToken();
      if (token) options.headers["Authorization"] = `Bearer ${token}`;
    }

    // gắn X-User-Id nếu chưa có
    if (!options.headers["X-User-Id"]) {
      const uid = getCurrentUserId();
      if (uid) options.headers["X-User-Id"] = uid;
    }

    return originalFetch(url, options);
  };
})();

// -------------------------
// Patch axios global
// -------------------------
axios.interceptors.request.use((config) => {
  config.headers = config.headers || {};

  if (!config.headers["Authorization"]) {
    const token = getAuthToken();
    if (token) config.headers["Authorization"] = `Bearer ${token}`;
  }

  if (!config.headers["X-User-Id"]) {
    const uid = getCurrentUserId();
    if (uid) config.headers["X-User-Id"] = uid;
  }

  return config;
});
