import { upsertAttempt, getCampaign } from "@/db/campaigns";
import { enqueue } from "@/db/approval-queue";
import { appendEvent } from "@/db/audit";
import type { CampaignAttempt } from "@/lib/campaign";

export const runtime = "edge";

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

export async function POST(request: Request) {
  const bodyText = await request.text().catch(() => "{}");

  const secret = process.env.SARVAM_TELEPHONY_WEBHOOK_SECRET;
  if (secret) {
    const sig = request.headers.get("x-sarvam-signature") || "";
    const valid = await verifySignature(bodyText, sig, secret);
    if (!valid) {
      return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const campaignId = String(body.campaign_id ?? "");
  const attemptId = String(body.attempt_id ?? "");
  if (!campaignId || !attemptId) {
    return Response.json({ error: "campaign_id and attempt_id are required." }, { status: 400 });
  }

  const campaign = getCampaign(campaignId);
  if (!campaign) {
    return Response.json({ error: "Campaign not found." }, { status: 404 });
  }

  const attempt: CampaignAttempt = {
    id: attemptId,
    campaignId,
    supplierName: String(body.supplier_name ?? "Unknown"),
    supplierPhone: String(body.supplier_phone ?? "Unknown"),
    outcome: (body.outcome as CampaignAttempt["outcome"]) || null,
    callId: String(body.call_id ?? "") || null,
    decision: (body.decision as unknown) || null,
    purchaseOrder: (body.purchase_order as unknown) || null,
    startedAt: null,
    endedAt: new Date().toISOString(),
  };

  upsertAttempt(campaignId, attempt);

  appendEvent({
    id: crypto.randomUUID(),
    tenantId: campaign.tenantId,
    kind: "campaign.attempt.completed",
    actorId: "system",
    resourceId: attemptId,
    payload: { campaignId, outcome: attempt.outcome, callId: attempt.callId },
    createdAt: new Date().toISOString(),
  });

  if (attempt.decision?.action === "human-approval") {
    enqueue({
      id: crypto.randomUUID(),
      tenantId: campaign.tenantId,
      callId: attempt.callId,
      campaignAttemptId: attempt.id,
      purchaseOrder: attempt.purchaseOrder,
      decision: attempt.decision,
      resolvedBy: null,
      resolution: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });

    appendEvent({
      id: crypto.randomUUID(),
      tenantId: campaign.tenantId,
      kind: "approval.requested",
      actorId: "system",
      resourceId: attemptId,
      payload: { reason: "Campaign attempt resulted in human-approval decision", decision: attempt.decision },
      createdAt: new Date().toISOString(),
    });
  }

  return Response.json({ ok: true });
}
