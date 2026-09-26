import React, { useEffect, useState } from "react";
import {
  subscribeRequestTracker,
  hasPendingRequests,
} from "../../utils/requestTracker";

export default function GlobalSpinner() {
  const [active, setActive] = useState(hasPendingRequests());

  useEffect(() => {
    const unsubscribe = subscribeRequestTracker(setActive);
    return unsubscribe;
  }, []);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    </div>
  );
}
