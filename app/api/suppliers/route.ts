import { listSuppliers, upsertSupplier } from "@/db/suppliers";
import type { SupplierRecord } from "@/lib/supplier-directory";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || process.env.KAROBOLI_TENANT_ID || "default";
  
  return Response.json({ suppliers: listSuppliers(tenantId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<SupplierRecord>;
  
  const tenantId = process.env.KAROBOLI_TENANT_ID || "default";
  const supplier: SupplierRecord = {
    id: body.id || crypto.randomUUID(),
    tenantId: body.tenantId || tenantId,
    name: body.name || "Unknown",
    phone: body.phone || "",
    area: body.area || "",
    languages: body.languages || [],
    completedOrders: body.completedOrders || 0,
    score: body.score || 0,
    consentState: body.consentState || "pending",
    consentUpdatedAt: body.consentUpdatedAt || null,
    createdAt: new Date().toISOString(),
  };

  upsertSupplier(supplier);
  return Response.json({ supplier });
}
