import { Capture } from "../../shared/types";

export class ClipboardIntegration {
  /**
   * Copies a capture to the clipboard with both rich HTML and fallback plain text.
   */
  async copyFormatted(capture: Capture): Promise<boolean> {
    const title = capture.source_title || capture.content_text?.slice(0, 50) || "Untitled Capture";
    const dateStr = new Date(capture.created_at).toLocaleDateString();

    const plainLines: string[] = [
      `[${capture.type.toUpperCase()}] ${title}`,
      capture.source_url ? `Source: ${capture.source_url}` : "",
      `Captured: ${dateStr}`,
      "",
      capture.content_text || "",
      capture.user_note ? `\nNote: ${capture.user_note}` : "",
      capture.tags && capture.tags.length > 0 ? `Tags: ${capture.tags.map((t) => `#${t}`).join(" ")}` : "",
    ].filter(Boolean);

    const plainText = plainLines.join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #1d1d1f; border-left: 3px solid #0071e3; padding-left: 12px; margin: 12px 0;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0071e3;">${capture.type}</div>
        <div style="font-size: 15px; font-weight: 600; margin: 4px 0;">
          ${capture.source_url ? `<a href="${capture.source_url}" style="color: #0071e3; text-decoration: none;">${title}</a>` : title}
        </div>
        <div style="font-size: 12px; color: #86868b; margin-bottom: 8px;">
          ${capture.source_domain ? `${capture.source_domain} • ` : ""}${dateStr}
        </div>
        ${capture.content_text ? `<blockquote style="margin: 8px 0; padding: 8px 12px; background: #f5f5f7; border-radius: 6px; font-size: 13px;">${capture.content_text}</blockquote>` : ""}
        ${capture.user_note ? `<p style="font-style: italic; font-size: 13px; color: #505050;"><strong>Note:</strong> ${capture.user_note}</p>` : ""}
      </div>
    `.trim();

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        });
        await navigator.clipboard.write([item]);
        return true;
      } else {
        await navigator.clipboard.writeText(plainText);
        return true;
      }
    } catch (e) {
      console.warn("Rich clipboard copy failed, falling back to text", e);
      try {
        await navigator.clipboard.writeText(plainText);
        return true;
      } catch {
        return false;
      }
    }
  }
}

export const clipboardIntegration = new ClipboardIntegration();
