import { useEffect, useRef, useState } from "react";

export function ActionMenu({ label = "Actions", items = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const visibleItems = items.filter((item) => !item.hidden);

  if (!visibleItems.length) {
    return <span className="table-subtle">—</span>;
  }

  return (
    <div className="actions-dropdown" ref={rootRef}>
      <button
        className="icon-action-button"
        type="button"
        title={label}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open ? (
        <div className="actions-menu" role="menu">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`actions-menu-item ${item.danger ? "danger" : ""}`}
              title={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              {item.icon ? <span aria-hidden>{item.icon}</span> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

