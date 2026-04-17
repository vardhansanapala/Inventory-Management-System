import { useCallback, useMemo, useRef, useState } from "react";

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePageFeedback({ maxActivities = 5 } = {}) {
  const [banner, setBanner] = useState(null);
  const bannerIdRef = useRef(null);
  const [activity, setActivity] = useState([]);

  const clearBanner = useCallback(() => {
    bannerIdRef.current = null;
    setBanner(null);
  }, []);

  const showBanner = useCallback((variant, message, options = {}) => {
    const id = createId();
    bannerIdRef.current = id;
    setBanner({
      id,
      variant,
      message,
      autoDismissMs: options.autoDismissMs ?? 4000,
      dismissible: options.dismissible ?? true,
    });
  }, []);

  const pushActivity = useCallback(
    (entry) => {
      const normalized = {
        id: entry?.id || createId(),
        at: entry?.at || Date.now(),
        label: String(entry?.label || "Action"),
        status: entry?.status === "failed" ? "failed" : "success",
        detail: entry?.detail ? String(entry.detail) : "",
      };

      setActivity((current) => [normalized, ...current].slice(0, Math.max(1, maxActivities)));
    },
    [maxActivities]
  );

  return useMemo(
    () => ({
      banner,
      showBanner,
      clearBanner,
      activity,
      pushActivity,
    }),
    [banner, showBanner, clearBanner, activity, pushActivity]
  );
}

