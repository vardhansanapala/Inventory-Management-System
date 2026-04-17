import { useEffect, useRef } from "react";

export function ActionFeedback({
  type = "success",
  message,
  onClose,
  autoDismissMs,
  dismissible = true,
  compact = false,
  className = "",
}) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    if (!message || !autoDismissMs || autoDismissMs <= 0 || typeof onClose !== "function") {
      return () => window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      onClose?.();
    }, autoDismissMs);

    return () => window.clearTimeout(timeoutRef.current);
  }, [message, autoDismissMs, onClose]);

  if (!message) return null;

  const role = type === "error" ? "alert" : "status";

  return (
    <div
      className={[
        "action-feedback",
        `action-feedback-${type}`,
        compact ? "is-compact" : "",
        className,
      ].filter(Boolean).join(" ")}
      role={role}
    >
      <div className="action-feedback-body">
        {type === "loading" ? <span className="button-spinner" aria-hidden /> : null}
        <span>{message}</span>
      </div>
      {dismissible && typeof onClose === "function" && type !== "loading" ? (
        <button className="action-feedback-close" type="button" onClick={onClose} aria-label="Dismiss message" title="Dismiss">
          x
        </button>
      ) : null}
    </div>
  );
}
