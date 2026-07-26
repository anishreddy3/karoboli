import { z } from "zod";
import { buyerRequirementSchema } from "@/lib/domain";
import { ProviderUnavailableError } from "@/lib/sarvam-server";
import { triggerInstantOutbound } from "@/lib/sarvam-telephony";
import type { CallRecord } from "@/lib/telephony";
import { upsertCall } from "@/db/telephony";

export const runtime = "edge";

const requestSchema = z.object({
  supplierName: z.string().min(1),
  supplierPhone: z.string().min(1),
  requirement: buyerRequirementSchema,
});

export async function POST(request: Request) {
  const connectionId = process.env.SARVAM_TELEPHONY_CONNECTION_ID;
  const agentPhone = process.env.SARVAM_TELEPHONY_AGENT_NUMBER;

  if (!connectionId || !agentPhone) {
    return Response.json(
      { error: "Telephony is not configured. Set SARVAM_TELEPHONY_CONNECTION_ID and SARVAM_TELEPHONY_AGENT_NUMBER." },
      { status: 503 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid outbound call request." }, { status: 400 });
  }

  const { supplierName, supplierPhone, requirement } = parsed.data;

  const callId = crypto.randomUUID();
  const webhookUrl = `${process.env.KAROBOLI_TOOL_BASE_URL || ""}/api/telephony/webhook`;

  try {
    const result = await triggerInstantOutbound({
      supplierName,
      supplierPhone,
      requirement,
      connectionId,
      agentPhone,
      webhookUrl,
    });

    const record: CallRecord = {
      id: result.callId || callId,
      createdAt: new Date().toISOString(),
      supplierName,
      supplierPhone,
      agentPhone,
      connectionId,
      consentState: "pending",
      status: "dialing",
      decision: null,
      purchaseOrder: null,
      commitments: [],
    };

    upsertCall(record);
    return Response.json({ callId: record.id, record });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Failed to trigger outbound call.";
    return Response.json({ error: message }, { status: 502 });
  }
}
