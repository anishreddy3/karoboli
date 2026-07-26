import { z } from "zod";
import { authorizeAgentTool } from "@/lib/agent-tool-auth";
import { buyerRequirementSchema, supplierOfferSchema } from "@/lib/domain";
import {
  buildGuardrails,
  createPurchaseOrder,
  evaluateOffer,
} from "@/lib/policy";

export const runtime = "edge";

const requestSchema = z.object({
  requirement: buyerRequirementSchema,
  offer: supplierOfferSchema,
});

export async function POST(request: Request) {
  const unauthorized = await authorizeAgentTool(request);
  if (unauthorized) return unauthorized;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid offer evaluation." }, { status: 400 });
  }
  if (parsed.data.requirement.needsConfirmation) {
    return Response.json(
      { error: "Buyer requirement still needs confirmation." },
      { status: 409 },
    );
  }

  const guardrails = buildGuardrails(parsed.data.requirement);
  const decision = evaluateOffer(parsed.data.offer, guardrails);
  const purchaseOrder = createPurchaseOrder(
    parsed.data.requirement,
    parsed.data.offer,
    decision,
  );
  return Response.json({ guardrails, decision, purchaseOrder });
}
