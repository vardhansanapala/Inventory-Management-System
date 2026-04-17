import { useEffect, useRef } from "react";

export function InlineBanner({
  variant = "success",
  message,
  onClose,
  autoDismissMs = 4000,
  dismissible = true,
  id,
}) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    if (!message) {
      return () => window.clearTimeout(timeoutRef.current);
    }

    if (!autoDismissMs || autoDismissMs <= 0 || typeof onClose !== "function") {
      return () => window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      onClose?.();
    }, autoDismissMs);

    return () => window.clearTimeout(timeoutRef.current);
  }, [id, message, autoDismissMs, onClose]);

  if (!message) return null;

  return (
    <div className={`inline-banner inline-banner-${variant}`} role={variant === "error" ? "alert" : "status"}>
      <div className="inline-banner-body">{message}</div>
      {dismissible && typeof onClose === "function" ? (
        <button className="inline-banner-close" type="button" onClick={onClose} aria-label="Dismiss message" title="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}

