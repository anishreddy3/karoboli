import { writePurchaseOrderToErp } from "@/lib/erp-adapter";
import { appendEvent } from "@/db/audit";
import type { PurchaseOrder } from "@/lib/domain";

export const runtime = "edge";

export async function POST(request: Request) {
  const po = (await request.json().catch(() => ({}))) as PurchaseOrder;

  if (!po || !po.id) {
    return Response.json({ error: "Invalid purchase order" }, { status: 400 });
  }

  const result = await writePurchaseOrderToErp(po);

  if (result.status === "created" || result.status === "already-exists") {
    appendEvent({
      id: crypto.randomUUID(),
      tenantId: process.env.KAROBOLI_TENANT_ID || "default",
      kind: "po.written",
      actorId: "system",
      resourceId: po.id,
      payload: { status: result.status },
      createdAt: new Date().toISOString(),
    });
  }

  return Response.json(result, {
    status: result.status === "error" ? 500 : 200,
  });
}
