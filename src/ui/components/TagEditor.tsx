import { useState } from "preact/hooks";

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      {editing ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            class="input"
            value={input}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { addTag(input); setInput(""); }
              if (e.key === "Escape") { setEditing(false); }
            }}
            placeholder="Add a tag..."
            autoFocus
          />
          <button class="btn" onClick={() => { addTag(input); setInput(""); }}>Add</button>
          <button class="btn" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <span key={tag} class="tag" style={{ cursor: "pointer" }} onClick={() => removeTag(tag)}>
              #{tag} &times;
            </span>
          ))}
          <button class="btn-icon" onClick={() => setEditing(true)}>+</button>
        </div>
      )}
    </div>
  );
}
