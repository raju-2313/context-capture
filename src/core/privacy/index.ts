import { settingsStore } from "../../data/settings";
import { isRestrictedUrl, isSensitiveDomain, normaliseUrlForStorage } from "../../shared/constants";

export class PrivacyManager {
  async isRestricted(url: string): Promise<boolean> {
    return isRestrictedUrl(url);
  }

  async getBlocklist(): Promise<string[]> {
    const val = await settingsStore.get("domain_blocklist");
    if (!val) return [];
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }

  async isBlockedDomain(domain: string | null): Promise<boolean> {
    if (!domain) return false;
    const blocklist = await this.getBlocklist();
    return isSensitiveDomain(domain, blocklist);
  }

  async normaliseUrl(url: string): Promise<string> {
    const stripQuery = (await settingsStore.get("strip_query_strings")) === "true";
    const stripFragment = (await settingsStore.get("strip_fragments")) === "true";
    return normaliseUrlForStorage(url, stripQuery, stripFragment);
  }

  async isIncognitoEnabled(): Promise<boolean> {
    return (await settingsStore.get("incognito_enabled")) === "true";
  }
}

export const privacy = new PrivacyManager();