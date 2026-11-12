import { TabBinding } from "../../shared/types";

export class SessionStore {
  async getBindings(): Promise<Record<number, TabBinding>> {
    const result = await chrome.storage.session.get("bindings");
    return (result as any).bindings || {};
  }

  async setBinding(tabId: number, binding: TabBinding): Promise<void> {
    const bindings = await this.getBindings();
    bindings[tabId] = binding;
    await chrome.storage.session.set({ bindings });
  }

  async removeBinding(tabId: number): Promise<void> {
    const bindings = await this.getBindings();
    delete bindings[tabId];
    await chrome.storage.session.set({ bindings });
  }

  async clearBindings(): Promise<void> {
    await chrome.storage.session.remove("bindings");
  }

  async getBinding(tabId: number): Promise<TabBinding | null> {
    const bindings = await this.getBindings();
    return bindings[tabId] ?? null;
  }
}

export const sessionStore = new SessionStore();