import { indexedDB as fakeIDB, IDBKeyRange as fakeIDBKeyRange } from "fake-indexeddb";

(globalThis as any).indexedDB = fakeIDB;
(globalThis as any).IDBKeyRange = fakeIDBKeyRange;
(globalThis as any).IDBCursor = fakeIDB.IDBCursor || class {};
