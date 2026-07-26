import { ProviderUnavailableError } from "@/lib/sarvam-server";
import { createInboundDeployment } from "@/lib/sarvam-telephony";

export const runtime = "edge";

export async function POST(request: Request) {
  const appId = process.env.SARVAM_AGENT_APP_ID;
  if (!appId) {
    return Response.json(
      { error: "SARVAM_AGENT_APP_ID is not configured." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const agentPhone = String(body.agentPhone || process.env.SARVAM_TELEPHONY_AGENT_NUMBER || "");

  if (!agentPhone) {
    return Response.json(
      { error: "agentPhone is required or set SARVAM_TELEPHONY_AGENT_NUMBER." },
      { status: 400 },
    );
  }

  const versionText = process.env.SARVAM_AGENT_VERSION;

  try {
    const result = await createInboundDeployment({
      appId,
      agentPhone,
      appVersion: versionText ? Number(versionText) : undefined,
    });
    return Response.json({ deploymentId: result.deploymentId });
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Failed to create deployment.";
    return Response.json({ error: message }, { status: 502 });
  }
}
