import type { JsonValue } from "../../../../src/types/json.js";
type Encoded = { value: JsonValue; encodedBytes: number }; type Page = { rows: JsonValue[]; encodedBytes: number; truncated: boolean; truncationReason?: string; nextKey: JsonValue | null; oversizedRecord: boolean };
export const inspectIndexedDb = async (params: Record<string, JsonValue>) => {
  const byteLimit = typeof params.__relayMaxBytes === "number" ? Math.max(1, Math.floor(params.__relayMaxBytes)) : 1; const rowLimit = typeof params.__relayMaxRows === "number" ? Math.max(1, Math.floor(params.__relayMaxRows)) : 1;
  const metadataLimit = typeof params.__relayMaxMetadataItems === "number" ? Math.max(1, Math.floor(params.__relayMaxMetadataItems)) : 1;
  const requested = params.limit === undefined ? Math.min(100, rowLimit) : params.limit;
  if (typeof requested !== "number" || !Number.isSafeInteger(requested) || requested < 1 || requested > rowLimit) {
    throw new Error(`limit must be an integer from 1 to ${rowLimit}.`);
  }
  const encoder = new TextEncoder(); const boundedPath = (value: string | string[] | null) => Array.isArray(value) ? value.slice(0, 128).map((part) => part.slice(0, 4_096)) : value?.slice(0, 4_096) ?? null;
  const encode = (source: unknown, maximum: number): Encoded => {
    let estimated = 0, items = 0;
    const seen = new WeakSet<object>();
    const add = (size: number) => { estimated += size; if (estimated > maximum) throw new Error(`IndexedDB value exceeds the ${maximum}-byte limit.`); };
    const addText = (value: string) => {
      for (let offset = 0; offset < value.length; offset += 8_192) add(encoder.encode(value.slice(offset, offset + 8_192)).byteLength);
    };
    let visit: (value: unknown, depth: number) => void;
    visit = (value, depth) => {
      if (depth > 128) throw new Error("IndexedDB value exceeds the 128-level depth limit.");
      if (value === null || value === undefined) { add(4); return; }
      if (typeof value === "string") { add(2); addText(value); return; }
      if (["number", "boolean", "bigint"].includes(typeof value)) { addText(String(value)); return; }
      if (typeof value !== "object") return;
      if (seen.has(value)) { add(12); return; }
      seen.add(value); if (value instanceof Map || value instanceof Set || value instanceof RegExp) throw Object.assign(new Error("IndexedDB Map, Set, and RegExp values require an explicit supported representation."), { unsupported: true });
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value)
        : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : undefined;
      if (bytes) {
        if (bytes.length > 100_000) throw new Error("IndexedDB binary value exceeds the 100000-item limit.");
        add(bytes.length * 4 + 2); return;
      }
      if (value instanceof Blob) { addText(value.type); add(64); return; }
      for (const key in value) {
        if (!Object.hasOwn(value, key)) continue;
        if (++items > 100_000) throw new Error("IndexedDB value exceeds the 100000-item limit.");
        addText(key); visit((value as Record<string, unknown>)[key], depth + 1);
      }
    };
    visit(source, 0);
    const serializedSeen = new WeakSet<object>();
    const serialized = JSON.stringify(source, (_key, value: unknown) => {
      if (typeof value === "bigint") return value.toString();
      if (value instanceof ArrayBuffer) return [...new Uint8Array(value)];
      if (ArrayBuffer.isView(value)) return [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)];
      if (value instanceof Blob) return { size: value.size, type: value.type };
      if (typeof value !== "object" || value === null) return value;
      if (serializedSeen.has(value)) return "[Circular]";
      serializedSeen.add(value); return value;
    });
    if (serialized === undefined) return { value: null, encodedBytes: 4 };
    const encodedBytes = encoder.encode(serialized).byteLength;
    if (encodedBytes > maximum) throw new Error(`IndexedDB value exceeds the ${maximum}-byte encoded limit.`);
    return { value: JSON.parse(serialized) as JsonValue, encodedBytes };
  };
  const sourceDatabases = await indexedDB.databases(); const databases = sourceDatabases.slice(0, metadataLimit).map(({ name, version }) => ({ name: name?.slice(0, 4_096), version }));
  if (typeof params.database !== "string") return encode({ databases, databaseTotal: sourceDatabases.length, truncated: sourceDatabases.length > databases.length }, byteLimit).value;
  const databaseInfo = sourceDatabases.find(({ name }) => name === params.database);
  if (!databaseInfo?.name) return encode({ databases, databaseTotal: sourceDatabases.length, database: null }, byteLimit).value;
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseInfo.name!);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    const storeNames = Array.from({ length: Math.min(database.objectStoreNames.length, metadataLimit) }, (_, index) => database.objectStoreNames.item(index)!); let remainingMetadata = metadataLimit - storeNames.length, omittedIndexCount = 0;
    const stores = storeNames.map((name) => {
      const store = database.transaction(name, "readonly").objectStore(name);
      const indexCount = Math.min(store.indexNames.length, remainingMetadata); remainingMetadata -= indexCount; omittedIndexCount += store.indexNames.length - indexCount;
      const indexes = Array.from({ length: indexCount }, (_, index) => store.indexNames.item(index)!).map((indexName) => {
        const index = store.index(indexName);
        return { name: index.name.slice(0, 4_096), keyPath: boundedPath(index.keyPath), multiEntry: index.multiEntry, unique: index.unique };
      });
      return { name: name.slice(0, 4_096), keyPath: boundedPath(store.keyPath), autoIncrement: store.autoIncrement, indexes, indexTotal: store.indexNames.length };
    });
    if (typeof params.objectStore !== "string" || !database.objectStoreNames.contains(params.objectStore)) {
      return encode({ database: { name: databaseInfo.name.slice(0, 4_096), version: databaseInfo.version }, stores, storeTotal: database.objectStoreNames.length, metadataLimit, omittedIndexCount }, byteLimit).value;
    }
    const objectStoreName = params.objectStore; const total = await new Promise<number>((resolve, reject) => { const request = database.transaction(objectStoreName, "readonly").objectStore(objectStoreName).count(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const store = database.transaction(objectStoreName, "readonly").objectStore(objectStoreName);
    const page = await new Promise<Page>((resolve, reject) => {
      const rows: JsonValue[] = []; let encodedBytes = 2; let nextKey: JsonValue | null = null;
      const cursor = store.openCursor(params.afterKey === undefined ? undefined : IDBKeyRange.lowerBound(params.afterKey as IDBValidKey, true));
      cursor.onsuccess = () => {
        const result = cursor.result;
        if (!result) return resolve({ rows, encodedBytes, truncated: false, nextKey, oversizedRecord: false });
        if (rows.length >= requested) return resolve({ rows, encodedBytes, truncated: true, truncationReason: "limit", nextKey, oversizedRecord: false });
        try {
          const record = encode({ key: result.key, value: result.value }, Math.max(1, byteLimit - encodedBytes));
          const required = record.encodedBytes + Number(rows.length > 0);
          if (encodedBytes + required > byteLimit) throw new Error("byteLimit");
          rows.push(record.value); encodedBytes += required; nextKey = (record.value as { key?: JsonValue }).key ?? null; result.continue();
        } catch (error) { if (error && typeof error === "object" && "unsupported" in error) reject(error); else resolve({ rows, encodedBytes, truncated: true, truncationReason: "byteLimit", nextKey, oversizedRecord: true }); }
      };
      cursor.onerror = () => reject(cursor.error);
    });
    return encode({ database: { name: databaseInfo.name.slice(0, 4_096), version: databaseInfo.version }, stores, storeTotal: database.objectStoreNames.length, metadataLimit, omittedIndexCount, objectStore: objectStoreName,
      rows: page.rows, total, returnedRowCount: page.rows.length, encodedBytes: page.encodedBytes, byteLimit, rowLimit: requested,
      truncated: page.truncated, truncationReason: page.truncationReason, nextKey: page.nextKey, oversizedRecord: page.oversizedRecord }, byteLimit).value;
  } finally { database.close(); }
};
