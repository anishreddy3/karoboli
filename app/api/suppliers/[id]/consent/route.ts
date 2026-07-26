import { updateConsent, getSupplier } from "@/db/suppliers";
import { appendEvent } from "@/db/audit";
import type { ConsentState } from "@/lib/supplier-directory";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { state?: ConsentState };

  if (!body.state || !["pending", "given", "revoked"].includes(body.state)) {
    return Response.json({ error: "Invalid consent state" }, { status: 400 });
  }

  const supplier = getSupplier(id);
  if (!supplier) {
    return Response.json({ error: "Supplier not found" }, { status: 404 });
  }

  const previousState = supplier.consentState;
  const updated = updateConsent(id, body.state);

  if (updated) {
    appendEvent({
      id: crypto.randomUUID(),
      tenantId: updated.tenantId,
      kind: "consent.updated",
      actorId: "system", // usually would be user ID
      resourceId: updated.id,
      payload: { previous: previousState, new: updated.consentState },
      createdAt: updated.consentUpdatedAt!,
    });
  }

  return Response.json({ supplier: updated });
}
