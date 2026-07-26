export type ConsentState = "pending" | "given" | "revoked";

export type SupplierRecord = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  area: string;
  languages: string[];
  materials: string[];
  deliveryRadius: string;
  completedOrders: number;
  score: number;           // 0–100
  consentState: ConsentState;
  consentUpdatedAt: string | null;
  createdAt: string;
};

/** Returns true only when the supplier has explicitly given consent for outbound calls. */
export function consentAllows(supplier: SupplierRecord): boolean {
  return supplier.consentState === "given";
}
