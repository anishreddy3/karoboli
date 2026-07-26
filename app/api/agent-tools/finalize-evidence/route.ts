import { z } from "zod";
import { authorizeAgentTool } from "@/lib/agent-tool-auth";
import { sha256Evidence } from "@/lib/evidence";

export const runtime = "edge";

const requestSchema = z.object({
  interactionId: z.string().min(1).max(200),
  buyerTranscript: z.string().max(20_000),
  supplierTranscript: z.string().max(20_000),
  corrections: z.array(z.unknown()),
  commitments: z.array(z.string().max(1000)),
  decision: z.unknown(),
  purchaseOrder: z.unknown().nullable(),
});

export async function POST(request: Request) {
  const unauthorized = await authorizeAgentTool(request);
  if (unauthorized) return unauthorized;

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid evidence payload." }, { status: 400 });
  }

  const createdAt = new Date().toISOString();
  const digest = await sha256Evidence({ createdAt, ...parsed.data });
  return Response.json({
    evidenceId: `EVD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    createdAt,
    algorithm: "sha256",
    digest,
  });
}
