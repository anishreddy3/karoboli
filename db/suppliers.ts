import type { SupplierRecord, ConsentState } from "../lib/supplier-directory.ts";

const store = new Map<string, SupplierRecord>();

export function upsertSupplier(supplier: SupplierRecord): void {
  store.set(supplier.id, supplier);
}

export function getSupplier(id: string): SupplierRecord | undefined {
  return store.get(id);
}

export function listSuppliers(tenantId?: string): SupplierRecord[] {
  return [...store.values()].filter(
    (s) => tenantId === undefined || s.tenantId === tenantId,
  );
}

export function updateConsent(id: string, state: ConsentState): SupplierRecord | undefined {
  const supplier = store.get(id);
  if (!supplier) return undefined;
  const updated: SupplierRecord = {
    ...supplier,
    consentState: state,
    consentUpdatedAt: new Date().toISOString(),
  };
  store.set(id, updated);
  return updated;
}
