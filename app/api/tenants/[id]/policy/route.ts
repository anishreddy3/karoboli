import { getTenant, upsertTenant } from "@/db/tenants";
import { appendEvent } from "@/db/audit";
import type { TenantPolicy } from "@/lib/tenant";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tenant = getTenant(id);
  return Response.json({ policy: tenant.policy });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tenant = getTenant(id);
  
  const body = (await request.json().catch(() => ({}))) as Partial<TenantPolicy>;
  const updatedPolicy: TenantPolicy = {
    ...tenant.policy,
    ...body,
    id: tenant.policy.id,
    tenantId: tenant.policy.tenantId,
    updatedAt: new Date().toISOString(),
  };

  upsertTenant({ ...tenant, policy: updatedPolicy });

  appendEvent({
    id: crypto.randomUUID(),
    tenantId: id,
    kind: "consent.updated", // or another kind, but payload carries details
    actorId: "system",
    resourceId: updatedPolicy.id,
    payload: { previous: tenant.policy, new: updatedPolicy },
    createdAt: new Date().toISOString(),
  });

  return Response.json({ policy: updatedPolicy });
}
