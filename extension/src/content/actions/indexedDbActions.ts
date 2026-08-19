import { MAX_CONTENT_STORAGE_ENTRIES, MAX_CONTENT_VALUE_BYTES } from "../../../../src/protocol/limits.js";
import type { JsonValue } from "../../../../src/types/json.js";
import type { ContentActionContext, ContentActionHandler } from "./types.js";
import { toJsonValue, toJsonValueWithBytes } from "./element";
type PageRecord = { key: JsonValue; value: JsonValue }; const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
});
const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed."));
  transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted."));
});
const openDatabase = (name: string) => new Promise<IDBDatabase>((resolve, reject) => {
  if (!name) return reject(new Error("An existing IndexedDB database name is required."));
  const request = indexedDB.open(name);
  request.onupgradeneeded = () => request.transaction?.abort();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error(`IndexedDB database "${name}" does not exist.`));
});
const withStore = async <T>(name: string, storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) => {
  const database = await openDatabase(name);
  try {
    const transaction = database.transaction(storeName, mode);
    const completed = transactionDone(transaction);
    const result = await requestResult(run(transaction.objectStore(storeName)));
    await completed;
    return result;
  } finally { database.close(); }
};
const names = (context: ContentActionContext) => ({
  database: String(context.request.params?.database ?? ""),
  store: String(context.request.params?.store ?? ""),
});
const integer = (value: unknown, fallback: number, maximum: number, label: string) => {
  const resolved = value === undefined ? fallback : value;
  if (typeof resolved !== "number" || !Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) throw new Error(`${label} must be an integer from 1 to ${maximum}.`);
  return resolved;
};
const readPage = async (databaseName: string, storeName: string, afterKey: IDBValidKey | undefined, limit: number, byteLimit: number) => {
  const database = await openDatabase(databaseName);
  try {
    const transaction = database.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const completed = transactionDone(transaction);
    const totalRequest = requestResult(store.count());
    const pageRequest = new Promise<{ records: PageRecord[]; encodedBytes: number; truncated: boolean }>((resolve, reject) => {
      const request = store.openCursor(afterKey === undefined ? undefined : IDBKeyRange.lowerBound(afterKey, true));
      const records: PageRecord[] = [];
      let encodedBytes = 2;
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return resolve({ records, encodedBytes, truncated: false });
        if (records.length >= limit) return resolve({ records, encodedBytes, truncated: true });
        try {
          const output = toJsonValueWithBytes({ key: cursor.key, value: cursor.value }, Math.max(1, byteLimit - 2), "IndexedDB record");
          const requiredBytes = output.encodedBytes + Number(records.length > 0);
          if (encodedBytes + requiredBytes > byteLimit) return resolve({ records, encodedBytes, truncated: true });
          records.push(output.value as PageRecord);
          encodedBytes += requiredBytes;
          cursor.continue();
        } catch (error) { reject(error); }
      };
      request.onerror = () => reject(request.error || new Error("IndexedDB cursor failed."));
    });
    const [page, total] = await Promise.all([pageRequest, totalRequest, completed]);
    return { ...page, total };
  } finally { database.close(); }
};
export const indexedDbActionHandlers: Record<string, ContentActionHandler> = {
  readIndexedDB: async (context) => {
    const { database, store } = names(context);
    if (!store) throw new Error("An IndexedDB object store name is required.");
    const byteLimit = integer(context.request.params?.maxBytes, MAX_CONTENT_VALUE_BYTES, MAX_CONTENT_VALUE_BYTES, "maxBytes");
    const key = context.request.params?.key;
    if (key !== undefined) return toJsonValue(await withStore(database, store, "readonly", (objectStore) => objectStore.get(key as IDBValidKey)), byteLimit, "IndexedDB record");
    const limit = integer(context.request.params?.limit, 1_000, MAX_CONTENT_STORAGE_ENTRIES, "limit");
    const page = await readPage(database, store, context.request.params?.afterKey as IDBValidKey | undefined, limit, byteLimit);
    return {
      records: page.records, total: page.total, returnedRecordCount: page.records.length,
      truncated: page.truncated, nextKey: page.truncated ? page.records.at(-1)?.key ?? null : null,
      encodedBytes: page.encodedBytes, byteLimit,
    };
  },
  writeIndexedDB: async (context) => {
    const { database, store } = names(context);
    if (!store) throw new Error("An IndexedDB object store name is required.");
    const key = context.request.params?.key as IDBValidKey | undefined;
    const value = context.request.params?.value;
    return toJsonValue(await withStore(database, store, "readwrite", (objectStore) => key === undefined ? objectStore.put(value) : objectStore.put(value, key)), MAX_CONTENT_VALUE_BYTES, "IndexedDB write result");
  },
  deleteIndexedDB: async (context) => {
    const { database, store } = names(context);
    if (!store) throw new Error("An IndexedDB object store name is required.");
    const key = context.request.params?.key as IDBValidKey | undefined;
    if (key === undefined && context.request.params?.all !== true) throw new Error("An IndexedDB key or explicit params.all=true is required.");
    await withStore(database, store, "readwrite", (objectStore) => key === undefined ? objectStore.clear() : objectStore.delete(key));
    return true;
  },
};
