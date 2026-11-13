import { useEffect } from "preact/hooks";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemCount?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  itemCount,
  confirmLabel = "Permanently Delete",
  cancelLabel = "Cancel",
  isDanger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onConfirm();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div class="confirm-modal-overlay" onClick={onCancel}>
      <div class="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div class="confirm-modal-header">
          <span class="confirm-modal-badge">
            <span class="confirm-modal-dot" />
            PERMANENT ACTION
          </span>
          <button class="confirm-modal-close" onClick={onCancel} aria-label="Cancel" title="Close (Esc)">
            ✕
          </button>
        </div>

        <div class="confirm-modal-body">
          <h3 class="confirm-modal-title">{title}</h3>
          <p class="confirm-modal-message">{message}</p>
          {typeof itemCount === "number" && itemCount > 0 && (
            <div class="confirm-modal-meta">
              <span>Selected items:</span>
              <strong style={{ color: "#ffffff" }}>{itemCount} item{itemCount === 1 ? "" : "s"}</strong>
            </div>
          )}
        </div>

        <div class="confirm-modal-actions">
          <button class="confirm-modal-cancel-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            class={isDanger ? "confirm-modal-danger-btn" : "confirm-modal-confirm-btn"}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

