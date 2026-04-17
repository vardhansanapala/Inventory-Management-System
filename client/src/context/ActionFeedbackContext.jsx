import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ActionFeedback } from "../components/ActionFeedback";

const ActionFeedbackContext = createContext(null);

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ActionFeedbackProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const dismissNotification = useCallback((id) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const pushNotification = useCallback((type, message, options = {}) => {
    if (!message) return "";

    const id = createId();
    const entry = {
      id,
      type,
      message,
      autoDismissMs: options.autoDismissMs ?? (type === "error" ? 4000 : 3500),
    };

    setNotifications((current) => [...current, entry].slice(-2));
    return id;
  }, []);

  const value = useMemo(
    () => ({
      pushNotification,
      dismissNotification,
    }),
    [pushNotification, dismissNotification]
  );

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            <div className="action-feedback-stack" aria-live="polite" aria-atomic="false">
              {notifications.map((entry) => (
                <ActionFeedback
                  key={entry.id}
                  type={entry.type}
                  message={entry.message}
                  autoDismissMs={entry.type === "loading" ? 0 : entry.autoDismissMs}
                  onClose={() => dismissNotification(entry.id)}
                />
              ))}
            </div>,
            document.body
          )
        : null}
    </ActionFeedbackContext.Provider>
  );
}

export function useActionFeedbackHost() {
  return useContext(ActionFeedbackContext);
}
