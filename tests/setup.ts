import { indexedDB as fakeIDB, IDBKeyRange as fakeIDBKeyRange } from "fake-indexeddb";

(globalThis as any).indexedDB = fakeIDB;
(globalThis as any).IDBKeyRange = fakeIDBKeyRange;
(globalThis as any).IDBCursor = fakeIDB.IDBCursor || class {};

// Mock Chrome API for tests
const storageMock: Record<string, any> = {};
(globalThis as any).chrome = {
  storage: {
    local: {
      get: (keys: any) => {
        if (!keys) return Promise.resolve({ ...storageMock });
        if (typeof keys === "string") return Promise.resolve({ [keys]: storageMock[keys] });
        if (Array.isArray(keys)) {
          const res: Record<string, any> = {};
          for (const k of keys) res[k] = storageMock[k];
          return Promise.resolve(res);
        }
        return Promise.resolve({ ...storageMock });
      },
      set: (items: Record<string, any>) => {
        Object.assign(storageMock, items);
        return Promise.resolve();
      },
      clear: () => {
        for (const k of Object.keys(storageMock)) delete storageMock[k];
        return Promise.resolve();
      },
    },
  },
  runtime: {
    sendMessage: () => Promise.resolve(),
    onMessage: {
      addListener: () => {},
      removeListener: () => {},
    },
  },
  tabs: {
    query: () => Promise.resolve([]),
    get: () => Promise.resolve(null),
    create: () => Promise.resolve({ id: 1, windowId: 1 }),
  },
};
