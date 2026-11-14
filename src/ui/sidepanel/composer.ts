export function insertTranscriptAtCursor(
  value: string,
  transcript: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { value: string; cursor: number } {
  const text = transcript.trim();
  if (!text) return { value, cursor: selectionEnd ?? value.length };

  const start = Math.max(0, Math.min(selectionStart ?? value.length, value.length));
  const end = Math.max(start, Math.min(selectionEnd ?? start, value.length));
  const before = value.slice(0, start);
  const after = value.slice(end);
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const suffix = after && !/^\s/.test(after) ? " " : "";
  const inserted = `${prefix}${text}${suffix}`;
  return { value: `${before}${inserted}${after}`, cursor: start + inserted.length };
}
