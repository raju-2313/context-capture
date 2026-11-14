export const DEFAULT_SETTINGS: Record<string, string> = {
  capture_shortcut_text: "Ctrl+Shift+C",
  capture_shortcut_screenshot: "Ctrl+Shift+S",
  capture_shortcut_note: "Ctrl+Shift+N",
  capture_shortcut_panel: "Ctrl+Shift+P",
  domain_blocklist: "banking.com,chase.com,wellsofargo.com,1password.com,lastpass.com",
  strip_query_strings: "false",
  strip_fragments: "false",
  incognito_enabled: "false",
  screenshot_format: "png",
  screenshot_quality: "90",
  thumbnail_width: "320",
  max_selection_chars: "100000",
  undo_window_seconds: "10",
  purge_days: "30",
  storage_warning_percent: "80",
  stt_provider: "auto",
  groq_api_key: "",
};

export const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\/.*/,
  /^chrome-extension:\/\/.*/,
  /^edge:\/\/.*/,
  /^brave:\/\/.*/,
  /^view-source:.*/,
  /^chrome-web-store:\/\/.*/,
];

export function isRestrictedUrl(url: string): boolean {
  return RESTRICTED_URL_PATTERNS.some((p) => p.test(url));
}

export function isSensitiveDomain(domain: string | null, blocklist: string[]): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  return blocklist.some((b) => d.includes(b.toLowerCase()));
}

export function normaliseUrlForStorage(url: string, stripQuery: boolean, stripFragment: boolean): string {
  try {
    const u = new URL(url);
    if (stripQuery) u.search = "";
    if (stripFragment) u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function computeSha256(buffer: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest("SHA-256", buffer).then((hash) => {
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hex;
  });
}
