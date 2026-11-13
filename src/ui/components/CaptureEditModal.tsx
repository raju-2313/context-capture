import { useState, useEffect } from "preact/hooks";
import { captures as capRepo, tags as tagRepo } from "../../data/repositories";
import { CheckIcon, CloseIcon } from "./Icons";

interface CaptureEditModalProps {
  capture: any;
  onSave: (updated: { user_note: string | null; tags: string[]; content_text: string | null }) => void;
  onClose: () => void;
}

const SUGGESTED_TAGS = ["research", "important", "review", "idea", "follow-up"];

export function CaptureEditModal({ capture, onSave, onClose }: CaptureEditModalProps) {
  const [userNote, setUserNote] = useState<string>(capture.user_note || "");
  const [tagsInput, setTagsInput] = useState<string>((capture.tags || []).join(", "));
  const [contentText, setContentText] = useState<string>(capture.content_text || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [userNote, tagsInput, contentText]);

  async function handleSave() {
    setSaving(true);
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    const updates: any = {
      user_note: userNote.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (capture.type !== "screenshot") {
      updates.content_text = contentText.trim() || null;
    }

    try {
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
    } catch (err) {
      console.error("Failed to save capture edits", err);
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function addSuggestedTag(tag: string) {
    const current = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!current.includes(tag)) {
      const next = current.length > 0 ? `${tagsInput.trim()}, ${tag}` : tag;
      setTagsInput(next);
    }
  }

  const contentLabel =
    capture.type === "question"
      ? "QUESTION PROMPT"
      : capture.type === "note"
      ? "NOTE CONTENT"
      : capture.type === "link"
      ? "TITLE / LINK"
      : "CAPTURE CONTENT";

  return (
    <div class="cem-overlay" onClick={handleBackdropClick}>
      <div class="cem-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class="cem-header">
          <div class="cem-title-group">
            <span class="cem-title">Edit Capture</span>
            <span class="cem-type-badge">{capture.type || "ITEM"}</span>
          </div>
          <button class="cem-close-btn" onClick={onClose} aria-label="Close" title="Close (Esc)">
            ✕
          </button>
        </div>

        {/* Content Field (if not screenshot) */}
        {capture.type !== "screenshot" && (
          <div class="cem-field">
            <div class="cem-field-header">
              <label class="cem-label">{contentLabel}</label>
              <span class="cem-count">{contentText.length} chars</span>
            </div>
            <textarea
              class="cem-textarea"
              rows={4}
              value={contentText}
              onInput={(e) => setContentText(e.currentTarget.value)}
              placeholder="Enter capture content..."
              autoFocus
            />
          </div>
        )}

        {/* Personal Note */}
        <div class="cem-field">
          <div class="cem-field-header">
            <label class="cem-label">PERSONAL NOTE</label>
            <span class="cem-count">{userNote.length > 0 ? `${userNote.length} chars` : ""}</span>
          </div>
          <textarea
            class="cem-textarea"
            rows={2}
            value={userNote}
            onInput={(e) => setUserNote(e.currentTarget.value)}
            placeholder="Add personal synthesis, thoughts, or memo..."
          />
        </div>

        {/* Tags */}
        <div class="cem-field">
          <div class="cem-field-header">
            <label class="cem-label">TAGS (COMMA-SEPARATED)</label>
          </div>
          <input
            class="cem-input"
            value={tagsInput}
            onInput={(e) => setTagsInput(e.currentTarget.value)}
            placeholder="research, important, follow-up"
          />
          <div class="cem-suggested-tags">
            {SUGGESTED_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                class="cem-tag-chip"
                onClick={() => addSuggestedTag(t)}
                title={`Add tag #${t}`}
              >
                +{t}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div class="cem-footer">
          <span class="cem-hint">⌘/Ctrl+↵ save · Esc close</span>
          <div class="cem-actions">
            <button class="cem-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button class="cem-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
