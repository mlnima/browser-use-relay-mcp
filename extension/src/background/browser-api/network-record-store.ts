import type { JsonValue } from "../../../../src/types/json.js";
import { jsonByteLength } from "./network-field-bounds";
import { NETWORK_STORE_MAX_RECORDS } from "./network-observation-limits";

export type NetworkRecord = Record<string, JsonValue>;
export const createNetworkRecordStore = <Value extends NetworkRecord>(byteLimit: number) => {
  const records = new Map<string, Value>();
  const sizes = new Map<string, number>();
  const order: string[] = [];
  let bytes = 0;
  let droppedRecords = 0;
  let droppedBytes = 0;
  const remove = (key: string) => {
    const size = sizes.get(key) || 0;
    records.delete(key);
    sizes.delete(key);
    bytes -= size;
    return size;
  };
  const put = (key: string, record: Value) => {
    const previous = sizes.get(key) || 0;
    if (!records.has(key)) order.push(key);
    bytes -= previous;
    const size = jsonByteLength(record);
    records.set(key, record);
    sizes.set(key, size);
    bytes += size;
    while (order.length > NETWORK_STORE_MAX_RECORDS || bytes > byteLimit) {
      const oldest = order.shift();
      if (!oldest) break;
      const removed = remove(oldest);
      droppedRecords += 1;
      droppedBytes += removed;
    }
  };
  const clear = (predicate?: (key: string, value: Value) => boolean) => {
    for (let index = order.length - 1; index >= 0; index -= 1) {
      const key = order[index];
      const value = key ? records.get(key) : undefined;
      if (!key || !value || (predicate && !predicate(key, value))) continue;
      remove(key);
      order.splice(index, 1);
    }
    if (!predicate) {
      droppedRecords = 0;
      droppedBytes = 0;
    }
  };
  return {
    put,
    get: (key: string) => records.get(key),
    list: () => order.map((key) => records.get(key)).filter((value): value is Value => Boolean(value)),
    clear,
    stats: () => ({ records: records.size, bytes, droppedRecords, droppedBytes }),
  };
};
