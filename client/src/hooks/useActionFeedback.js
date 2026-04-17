import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActionFeedbackHost } from "../context/ActionFeedbackContext";

function normalizeErrorMessage(error, fallback) {
  return error?.message || fallback || "Something went wrong.";
}

export function useActionFeedback(options = {}) {
  const {
    successAutoDismissMs = 3500,
    errorAutoDismissMs = 4000,
    preferGlobal = false,
  } = options;
  const host = useActionFeedbackHost();
  const timeoutRef = useRef(null);
  const [feedback, setFeedback] = useState(null);

  const clear = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setFeedback(null);
  }, []);

  const showLocalFeedback = useCallback((type, message, autoDismissMs) => {
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    const nextFeedback = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      autoDismissMs,
    };

    setFeedback(nextFeedback);

    if (autoDismissMs && autoDismissMs > 0 && type !== "loading") {
      timeoutRef.current = window.setTimeout(() => {
        setFeedback(null);
      }, autoDismissMs);
    }

    return nextFeedback;
  }, []);

  const pushGlobal = useCallback((type, message, autoDismissMs) => {
    host?.pushNotification?.(type, message, { autoDismissMs });
  }, [host]);

  const showSuccess = useCallback((message, opts = {}) => {
    const autoDismissMs = opts.autoDismissMs ?? successAutoDismissMs;
    if (opts.global || preferGlobal) {
      pushGlobal("success", message, autoDismissMs);
    }
    return showLocalFeedback("success", message, autoDismissMs);
  }, [preferGlobal, pushGlobal, showLocalFeedback, successAutoDismissMs]);

  const showError = useCallback((message, opts = {}) => {
    const autoDismissMs = opts.autoDismissMs ?? errorAutoDismissMs;
    if (opts.global || preferGlobal) {
      pushGlobal("error", message, autoDismissMs);
    }
    return showLocalFeedback("error", message, autoDismissMs);
  }, [errorAutoDismissMs, preferGlobal, pushGlobal, showLocalFeedback]);

  const showLoading = useCallback((message = "Working...") => {
    return showLocalFeedback("loading", message, 0);
  }, [showLocalFeedback]);

  const handleAsyncAction = useCallback(async (fn, config = {}) => {
    const {
      loadingMsg = "Working...",
      successMsg,
      errorMsg,
      onSuccess,
      onError,
      globalSuccess = false,
      globalError = false,
      clearOnSuccess = false,
      rethrow = false,
    } = config;

    showLoading(loadingMsg);

    try {
      const result = await fn();

      if (successMsg) {
        const nextMessage = typeof successMsg === "function" ? successMsg(result) : successMsg;
        showSuccess(nextMessage, { global: globalSuccess });
      } else if (clearOnSuccess) {
        clear();
      }

      onSuccess?.(result);
      return result;
    } catch (error) {
      const fallback = typeof errorMsg === "function" ? errorMsg(error) : errorMsg;
      const nextMessage = normalizeErrorMessage(error, fallback);
      showError(nextMessage, { global: globalError });
      onError?.(error);
      if (rethrow) throw error;
      return null;
    }
  }, [clear, showError, showLoading, showSuccess]);

  useEffect(() => () => {
    window.clearTimeout(timeoutRef.current);
  }, []);

  return useMemo(
    () => ({
      feedback,
      isLoading: feedback?.type === "loading",
      clear,
      showSuccess,
      showError,
      showLoading,
      handleAsyncAction,
    }),
    [feedback, clear, showSuccess, showError, showLoading, handleAsyncAction]
  );
}
