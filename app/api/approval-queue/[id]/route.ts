import { resolve } from "@/db/approval-queue";
import { appendEvent } from "@/db/audit";
import type { ApprovalResolution } from "@/db/approval-queue";

export const runtime = "edge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    resolution?: ApprovalResolution;
    resolvedBy?: string;
  };

  if (!body.resolution || !body.resolvedBy) {
    return Response.json({ error: "Missing resolution or resolvedBy" }, { status: 400 });
  }

  const updated = resolve(id, body.resolution, body.resolvedBy);
  if (!updated) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  appendEvent({
    id: crypto.randomUUID(),
    tenantId: updated.tenantId,
    kind: "approval.resolved",
    actorId: body.resolvedBy,
    resourceId: updated.id,
    payload: { resolution: body.resolution, callId: updated.callId },
    createdAt: updated.resolvedAt!,
  });

  return Response.json({ item: updated });
}
