import { useState } from "preact/hooks";
import { captures as capRepo, tags as tagRepo } from "../../data/repositories";

interface CaptureEditModalProps {
  capture: any;
  onSave: (updated: { user_note: string | null; tags: string[]; content_text: string | null }) => void;
  onClose: () => void;
}

export function CaptureEditModal({ capture, onSave, onClose }: CaptureEditModalProps) {
  const [userNote, setUserNote] = useState<string>(capture.user_note || "");
  const [tagsInput, setTagsInput] = useState<string>((capture.tags || []).join(", "));
  const [contentText, setContentText] = useState<string>(capture.content_text || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const updates: any = {
      user_note: userNote.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (capture.type !== "screenshot") {
      updates.content_text = contentText.trim() || null;
    }

    await capRepo.update(capture.capture_id, updates);

    // Update tags: unlink all existing, re-link new ones
    const existingTags = await tagRepo.getTagsForCapture(capture.capture_id);
    for (const et of existingTags) {
      await tagRepo.unlinkFromCapture(capture.capture_id, et.tag_id);
    }
    for (const t of tags) {
      const tag = await tagRepo.getOrCreate(t);
      await tagRepo.linkToCapture(capture.capture_id, tag.tag_id);
    }

    onSave({
      user_note: updates.user_note,
      tags,
      content_text: capture.type !== "screenshot" ? updates.content_text : capture.content_text,
    });
    setSaving(false);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--surface, #fff)",
          borderRadius: 12,
          padding: 20,
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 15 }}>Edit Capture</strong>
          <button
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {capture.type !== "screenshot" && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
              Content
            </label>
            <textarea
              class="input"
              rows={5}
              value={contentText}
              onInput={(e) => setContentText(e.currentTarget.value)}
              style={{ width: "100%", resize: "vertical", fontSize: 13 }}
            />
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
            Note
          </label>
          <textarea
            class="input"
            rows={3}
            value={userNote}
            onInput={(e) => setUserNote(e.currentTarget.value)}
            placeholder="Add a personal note..."
            style={{ width: "100%", resize: "vertical", fontSize: 13 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>
            Tags (comma-separated)
          </label>
          <input
            class="input"
            value={tagsInput}
            onInput={(e) => setTagsInput(e.currentTarget.value)}
            placeholder="research, important, follow-up"
            style={{ width: "100%", fontSize: 13 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button class="btn" onClick={onClose}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
