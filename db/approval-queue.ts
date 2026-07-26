import type { Decision, PurchaseOrder } from "../lib/domain.ts";

export type ApprovalResolution = "approved" | "rejected";

export type ApprovalItem = {
  id: string;
  tenantId: string;
  callId: string | null;
  campaignAttemptId: string | null;
  purchaseOrder: PurchaseOrder | null;
  decision: Decision;
  resolvedBy: string | null;
  resolution: ApprovalResolution | null;
  createdAt: string;
  resolvedAt: string | null;
};

const store = new Map<string, ApprovalItem>();

export function enqueue(item: ApprovalItem): void {
  store.set(item.id, item);
}

export function resolve(
  id: string,
  resolution: ApprovalResolution,
  resolvedBy: string,
): ApprovalItem | undefined {
  const item = store.get(id);
  if (!item) return undefined;
  const updated: ApprovalItem = {
    ...item,
    resolution,
    resolvedBy,
    resolvedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}

export function listPending(tenantId?: string): ApprovalItem[] {
  return [...store.values()].filter(
    (item) =>
      item.resolution === null &&
      (tenantId === undefined || item.tenantId === tenantId),
  );
}

export function getItem(id: string): ApprovalItem | undefined {
  return store.get(id);
}
