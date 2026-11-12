import { DEFAULT_SETTINGS } from "../shared/constants";

export interface SettingsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
  resetToDefaults(): Promise<void>;
}

export class ChromeSettingsStore implements SettingsStore {
  async get(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get([key]);
    if (result[key] === undefined) {
      return DEFAULT_SETTINGS[key] ?? null;
    }
    return result[key] as string;
  }

  async set(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async getAll(): Promise<Record<string, string>> {
    const result = await chrome.storage.local.get(null);
    const all: Record<string, string> = {};
    for (const [k, v] of Object.entries(result)) {
      all[k] = String(v);
    }
    return all;
  }

  async resetToDefaults(): Promise<void> {
    await chrome.storage.local.set(DEFAULT_SETTINGS);
  }
}

export const settingsStore = new ChromeSettingsStore();

/** Ensure a device_id is set on first install (used for future sync conflict resolution). */
export async function ensureDeviceId(): Promise<string> {
  const existing = await settingsStore.get("device_id");
  if (existing) return existing;
  const id = crypto.randomUUID();
  await settingsStore.set("device_id", id);
  return id;
}
