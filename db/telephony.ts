import type { CallRecord } from "../lib/telephony";

const store = new Map<string, CallRecord>();

export function upsertCall(record: CallRecord): void {
  store.set(record.id, record);
}

export function getCall(id: string): CallRecord | undefined {
  return store.get(id);
}

export function listCalls(): CallRecord[] {
  return [...store.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
