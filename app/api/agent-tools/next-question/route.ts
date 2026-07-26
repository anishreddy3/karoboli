import { z } from "zod";
import { authorizeAgentTool } from "@/lib/agent-tool-auth";
import { buyerRequirementSchema, supplierOfferSchema } from "@/lib/domain";
import { nextBuyerQuestion, nextSupplierQuestion } from "@/lib/follow-up";

export const runtime = "edge";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("buyer"), requirement: buyerRequirementSchema }),
  z.object({ kind: z.literal("supplier"), offer: supplierOfferSchema }),
]);

export async function POST(request: Request) {
  const unauthorized = await authorizeAgentTool(request);
  if (unauthorized) return unauthorized;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid follow-up request." }, { status: 400 });
  }

  const question =
    parsed.data.kind === "buyer"
      ? nextBuyerQuestion(parsed.data.requirement)
      : nextSupplierQuestion(parsed.data.offer);

  return Response.json({ question });
}
