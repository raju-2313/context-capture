export function CaptureCard({ capture, onDelete, onEdit }: { capture: any; onDelete?: () => void; onEdit?: () => void }) {
  const typeLabel = capture.type.charAt(0).toUpperCase() + capture.type.slice(1);
  const typeColors: Record<string, string> = {
    text: "#0071e3",
    code: "#34c759",
    link: "#5ac8fa",
    question: "#ff9500",
    note: "#bf5af2",
    screenshot: "#ff3b30",
  };

  const tags: string[] = capture.tags || [];

  return (
    <div class="card" style={{ borderLeft: `3px solid ${typeColors[capture.type] || "#86868b"}` }}>
      <span class="card-type-badge">{typeLabel}</span>
      <div class="card-content">
        <div class="card-title">{capture.source_title || capture.content_text?.slice(0, 60) || "Untitled"}</div>
        <div class="card-meta">
          {capture.source_domain && <span class="domain">{capture.source_domain}</span>}
          <span>{new Date(capture.created_at).toLocaleDateString()}</span>
        </div>
        {capture.content_text && <div class="card-text">{capture.content_text}</div>}
        {capture.code_language && (
          <div class="code-block">{capture.content_text}</div>
        )}
        <div class="card-tags">
          {tags.map((tag: string) => (
            <span key={tag} class="tag">#{tag}</span>
          ))}
        </div>
        <div class="card-actions">
          {onEdit && <button class="btn-icon" onClick={onEdit} title="Edit">&#9998;</button>}
          {onDelete && <button class="btn-icon btn-danger" onClick={onDelete} title="Delete">&#10007;</button>}
        </div>
      </div>
    </div>
  );
}
