export function Modal({ title, subtitle, children, onClose, actions = null, feedback = null }) {
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal app-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-header-text">
            <h2>{title}</h2>
            {subtitle ? <p className="table-subtle">{subtitle}</p> : null}
          </div>
          <button className="icon-action-button" type="button" onClick={onClose} aria-label="Close modal" title="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {feedback}
          {children}
        </div>
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
