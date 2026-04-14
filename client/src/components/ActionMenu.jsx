import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function ActionMenu({ label = "Actions", items = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  const visibleItems = useMemo(() => items.filter((item) => !item.hidden), [items]);

  if (!visibleItems.length) {
    return <span className="table-subtle">—</span>;
  }

  function closeMenu() {
    setOpen(false);
    setMenuStyle(null);
  }

  function computePosition() {
    const buttonEl = buttonRef.current;
    const menuEl = menuRef.current;
    if (!buttonEl || !menuEl) return;

    const rect = buttonEl.getBoundingClientRect();
    const gap = 8;

    // Measure after render
    const menuHeight = menuEl.offsetHeight || 0;
    const menuWidth = menuEl.offsetWidth || 0;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldFlipUp = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow;

    const top = shouldFlipUp ? rect.top - menuHeight - gap : rect.bottom + gap;
    const left = Math.max(8, rect.right - menuWidth);

    setMenuStyle({
      position: "fixed",
      top: Math.max(8, top),
      left,
      zIndex: 9999,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    computePosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visibleItems.length]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event) {
      const target = event.target;
      const buttonEl = buttonRef.current;
      const menuEl = menuRef.current;
      if (!buttonEl || !menuEl) return;
      if (buttonEl.contains(target) || menuEl.contains(target)) return;
      closeMenu();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    function handleScroll() {
      // simplest + most reliable for nested scroll containers
      closeMenu();
    }

    function handleResize() {
      closeMenu();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="actions-dropdown" ref={rootRef}>
      <button
        className="icon-action-button"
        type="button"
        title={label}
        aria-label={label}
        ref={buttonRef}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open
        ? createPortal(
            <div ref={menuRef} className="actions-menu actions-menu-portal" style={menuStyle || undefined} role="menu">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`actions-menu-item ${item.danger ? "danger" : ""}`}
                  title={item.label}
                  onClick={() => {
                    closeMenu();
                    item.onClick?.();
                  }}
                >
                  {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

