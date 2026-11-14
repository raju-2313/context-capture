import { settingsStore } from "../../data/settings";

export interface GatewayQuota {
  plan: string;
  usedToday: number;
  dailyLimit: number;
  remaining: number;
  resetAt?: string;
  upgradeUrl?: string;
}

interface Session {
  access_token: string;
  refresh_token?: string;
}

const SESSION_KEY = "supabase_auth_session";

function configured(key: string): Promise<string> {
  return settingsStore.get(key).then((value) => value?.trim() || "");
}

async function getSession(): Promise<Session | null> {
  const raw = await settingsStore.get(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    await settingsStore.set(SESSION_KEY, "");
    return null;
  }
}

async function ensureAnonymousSession(): Promise<Session> {
  const existing = await getSession();
  if (existing?.access_token) return existing;

  const supabaseUrl = await configured("supabase_url");
  const anonKey = await configured("supabase_anon_key");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Managed transcription is not configured. Add the Supabase URL and anonymous key in Settings.");
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error("Could not create a managed transcription session.");
  const session = await response.json() as Session;
  if (!session.access_token) throw new Error("Managed transcription authentication did not return a session.");
  await settingsStore.set(SESSION_KEY, JSON.stringify(session));
  return session;
}

export interface ManagedTranscriptionResult {
  text: string;
  quota?: GatewayQuota;
}

export async function transcribeThroughGateway(
  audio: Blob,
  language?: string,
  requestId = crypto.randomUUID(),
): Promise<ManagedTranscriptionResult> {
  const gatewayUrl = await configured("transcription_gateway_url");
  if (!gatewayUrl) throw new Error("Managed transcription is not configured. Add the gateway URL in Settings.");
  const session = await ensureAnonymousSession();
  const form = new FormData();
  form.append("file", audio, "voice.webm");
  if (language) form.append("language", language);
  const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/transcribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "X-Request-Id": requestId,
    },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as {
    text?: string;
    error?: string;
    quota?: GatewayQuota;
  };
  if (!response.ok) {
    const error = new Error(payload.error || `Transcription gateway returned ${response.status}`) as Error & {
      code?: string;
      quota?: GatewayQuota;
      upgradeUrl?: string;
    };
    error.code = response.status === 429 ? "quota-exceeded" : response.status === 401 ? "unauthorized" : "api";
    error.quota = payload.quota;
    error.upgradeUrl = payload.quota?.upgradeUrl || await configured("transcription_upgrade_url");
    throw error;
  }
  return { text: payload.text?.trim() || "", quota: payload.quota };
}
