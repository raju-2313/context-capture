import { settingsStore } from "../../data/settings";
import { Capture } from "../../shared/types";

export interface WebhookPayload {
  event: "capture.created" | "capture.exported";
  timestamp: string;
  capture: {
    id: string;
    type: string;
    title: string | null;
    content: string | null;
    source_url: string | null;
    source_domain: string | null;
    note: string | null;
    tags: string[];
    created_at: string;
  };
}

export class WebhookIntegration {
  async getWebhookUrl(): Promise<string | null> {
    return await settingsStore.get("webhook_url");
  }

  async setWebhookUrl(url: string): Promise<void> {
    await settingsStore.set("webhook_url", url.trim());
  }

  /**
   * Dispatches a capture payload to the user's configured webhook endpoint.
   */
  async sendCapture(capture: Capture): Promise<{ success: boolean; status?: number; error?: string }> {
    const url = await this.getWebhookUrl();
    if (!url) {
      return { success: false, error: "No webhook URL configured in Settings." };
    }

    const payload: WebhookPayload = {
      event: "capture.created",
      timestamp: new Date().toISOString(),
      capture: {
        id: capture.capture_id,
        type: capture.type,
        title: capture.source_title,
        content: capture.content_text,
        source_url: capture.source_url,
        source_domain: capture.source_domain,
        note: capture.user_note,
        tags: capture.tags || [],
        created_at: capture.created_at,
      },
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ContextCapture-Extension/1.0",
        },
        body: JSON.stringify(payload),
      });

      return { success: resp.ok, status: resp.status };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }
}

export const webhookIntegration = new WebhookIntegration();
