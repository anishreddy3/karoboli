import { getCall, upsertCall } from "@/db/telephony";

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

  const callId = String(body.call_id ?? "");
  if (!callId) {
    return Response.json({ error: "call_id is required." }, { status: 400 });
  }

  const existing = getCall(callId);
  const statusRaw = String(body.status ?? "completed");
  const status = (["dialing", "connected", "completed", "failed"] as const).includes(
    statusRaw as "dialing" | "connected" | "completed" | "failed",
  )
    ? (statusRaw as "dialing" | "connected" | "completed" | "failed")
    : "completed";

  const updated = {
    id: callId,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    supplierName: existing?.supplierName ?? String(body.supplier_name ?? ""),
    supplierPhone: existing?.supplierPhone ?? "",
    agentPhone: existing?.agentPhone ?? "",
    connectionId: existing?.connectionId ?? "",
    interactionId: String(body.interaction_id ?? existing?.interactionId ?? ""),
    consentState: existing?.consentState ?? ("pending" as const),
    status,
    transcriptSummary: String(body.transcript_summary ?? existing?.transcriptSummary ?? ""),
    decision: (body.decision as typeof existing.decision) ?? existing?.decision ?? null,
    purchaseOrder: (body.purchase_order as typeof existing.purchaseOrder) ?? existing?.purchaseOrder ?? null,
    commitments: Array.isArray(body.commitments)
      ? (body.commitments as string[])
      : (existing?.commitments ?? []),
    callDurationSeconds: typeof body.duration_seconds === "number"
      ? body.duration_seconds
      : existing?.callDurationSeconds,
  };

  upsertCall(updated);
  return Response.json({ ok: true });
}
