export interface CCDatabaseSchema {
  contexts: {
    key: string;
    value: any;
    indexes: { "by-status": string; "by-last-active": string };
  };
  captures: {
    key: string;
    value: any;
    indexes: { "by-context": string; "by-type": string; "by-domain": string; "by-deleted": string; "by-created": string };
  };
  attachments: {
    key: string;
    value: any;
    indexes: { "by-sha256": string };
  };
  capture_attachments: {
    key: [string, string];
    value: any;
    indexes: { "by-capture": string };
  };
  tags: {
    key: string;
    value: any;
    indexes: { "by-name": string };
  };
  capture_tags: {
    key: [string, string];
    value: any;
    indexes: { "by-capture": string };
  };
  change_journal: {
    key: number;
    value: any;
    indexes: { "by-entity": string };
  };
  settings: {
    key: string;
    value: any;
    indexes: {};
  };
  meta: {
    key: string;
    value: any;
    indexes: {};
  };
  projects: {
    key: string;
    value: any;
    indexes: { "by-status": string; "by-updated": string };
  };
  project_memberships: {
    key: [string, string];
    value: any;
    indexes: { "by-project": string; "by-capture": string };
  };
}

const DB_NAME = "cc";
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

function openConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (_event) => {
      const db = req.result as IDBDatabase;

      if (!db.objectStoreNames.contains("contexts")) {
        const ctx = db.createObjectStore("contexts", { keyPath: "context_id" });
        ctx.createIndex("by-status", "status");
        ctx.createIndex("by-last-active", "last_active_at");
      }
      if (!db.objectStoreNames.contains("captures")) {
        const cap = db.createObjectStore("captures", { keyPath: "capture_id" });
        cap.createIndex("by-context", "context_id");
        cap.createIndex("by-type", "type");
        cap.createIndex("by-domain", "source_domain");
        cap.createIndex("by-deleted", "deleted_at");
        cap.createIndex("by-created", "created_at");
      }
      if (!db.objectStoreNames.contains("attachments")) {
        const att = db.createObjectStore("attachments", { keyPath: "attachment_id" });
        att.createIndex("by-sha256", "sha256", { unique: true });
      }
      if (!db.objectStoreNames.contains("capture_attachments")) {
        const ca = db.createObjectStore("capture_attachments", { keyPath: ["capture_id", "attachment_id"] });
        ca.createIndex("by-capture", "capture_id");
      }
      if (!db.objectStoreNames.contains("tags")) {
        const tags = db.createObjectStore("tags", { keyPath: "tag_id" });
        tags.createIndex("by-name", "name", { unique: true });
      }
      if (!db.objectStoreNames.contains("capture_tags")) {
        const ct = db.createObjectStore("capture_tags", { keyPath: ["capture_id", "tag_id"] });
        ct.createIndex("by-capture", "capture_id");
      }
      if (!db.objectStoreNames.contains("change_journal")) {
        const cj = db.createObjectStore("change_journal", { keyPath: "seq", autoIncrement: true });
        cj.createIndex("by-entity", "entity_id");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("projects")) {
        const p = db.createObjectStore("projects", { keyPath: "project_id" });
        p.createIndex("by-status", "status");
        p.createIndex("by-updated", "updated_at");
      }
      if (!db.objectStoreNames.contains("project_memberships")) {
        const pm = db.createObjectStore("project_memberships", { keyPath: ["project_id", "capture_id"] });
        pm.createIndex("by-project", "project_id");
        pm.createIndex("by-capture", "capture_id");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDatabase(): Promise<IDBDatabase> {
  if (!dbInstance) {
    dbInstance = await openConnection();
    dbInstance.onversionchange = () => {
      dbInstance?.close();
      dbInstance = null;
    };
  }
  return dbInstance;
}

export async function openDatabase(): Promise<IDBDatabase> {
  return getDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export async function tx<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  const transaction = db.transaction(storeNames, mode);
  return new Promise<T>((resolve, reject) => {
    let result: T;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
    fn(transaction)
      .then((res) => {
        result = res;
      })
      .catch((err) => {
        try {
          transaction.abort();
        } catch {}
        reject(err);
      });
  });
}

export function objectStore<T>(transaction: IDBTransaction, name: string): IDBObjectStore {
  return transaction.objectStore(name);
}

export async function initMeta(deviceId: string, installId: string): Promise<void> {
  const db = await getDatabase();
  const txn = db.transaction(["meta"], "readwrite");
  const store = txn.objectStore("meta");
  const existing = await new Promise<any | null>((resolve) => {
    const req = store.get("schema");
    req.onsuccess = () => resolve(req.result ?? null);
  });
  if (!existing) {
    store.add({
      key: "schema",
      schema_version: 1,
      device_id: deviceId,
      install_id_local: installId,
    });
  }
  await new Promise<void>((resolve, reject) => {
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  });
}

export async function getSchemaVersion(): Promise<number | null> {
  const db = await getDatabase();
  return new Promise<number | null>((resolve) => {
    const txn = db.transaction(["meta"], "readonly");
    const store = txn.objectStore("meta");
    const req = store.get("schema");
    req.onsuccess = () => resolve(req.result?.schema_version ?? null);
  });
}
