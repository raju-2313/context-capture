import { useState, useEffect } from "preact/hooks";

interface ToastProps {
  message: string;
  undoLabel?: string;
  durationMs?: number;
  onUndo?: () => void;
  onDismiss?: () => void;
}

export function Toast({ message, undoLabel = "Undo", durationMs = 10000, onUndo, onDismiss }: ToastProps) {
  const [remaining, setRemaining] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onDismiss?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1c1c1e",
        color: "#fff",
        borderRadius: 10,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        zIndex: 9999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        fontSize: 13,
        minWidth: 240,
        maxWidth: 340,
      }}
    >
      <span style={{ flex: 1 }}>
        {message} ({remaining}s)
      </span>
      {onUndo && (
        <button
          style={{
            background: "none",
            border: "1px solid #fff",
            color: "#fff",
            borderRadius: 6,
            padding: "3px 10px",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
          onClick={() => {
            onUndo();
          }}
        >
          {undoLabel}
        </button>
      )}
    </div>
  );
}
