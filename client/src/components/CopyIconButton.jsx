import { useEffect, useState } from "react";

export function CopyIconButton({ value, onCopied, disabled = false, className = "" }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timeoutId = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function handleCopy() {
    if (busy || disabled || !value || !navigator?.clipboard?.writeText) return;

    setBusy(true);
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      onCopied?.(value);
    } finally {
      window.setTimeout(() => setBusy(false), 500);
    }
  }

  const title = copied ? "Copied!" : "Copy";
  const finalClassName = `copy-icon-button${copied ? " is-copied" : ""}${className ? ` ${className}` : ""}`;
  const icon = copied ? (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10l4 4 8-8" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="7" y="3" width="10" height="12" rx="2" />
      <path d="M5 7H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" />
    </svg>
  );

  return (
    <button
      type="button"
      className={finalClassName}
      onClick={handleCopy}
      disabled={disabled || busy || !value}
      title={title}
      aria-label="Copy to clipboard"
    >
      {icon}
    </button>
  );
}
