import {
  ProviderUnavailableError,
  sarvamFetch,
} from "./sarvam-server";
import type { OutboundCallRequest } from "./telephony";

export async function triggerInstantOutbound(
  req: OutboundCallRequest,
): Promise<{ callId: string }> {
  const appId = process.env.SARVAM_AGENT_APP_ID;
  if (!appId) throw new ProviderUnavailableError("SARVAM_AGENT_APP_ID is not configured.");

  const body: Record<string, unknown> = {
    connection_id: req.connectionId,
    from_number: req.agentPhone,
    to_number: req.supplierPhone,
    app_id: appId,
    agent_variables: {
      supplier_name: req.supplierName,
      buyer_requirement_json: JSON.stringify(req.requirement),
      karoboli_role: "supplier",
      policy_authority: "karoboli_deterministic_engine",
    },
    webhook_url: req.webhookUrl,
  };

  const version = process.env.SARVAM_AGENT_VERSION;
  if (version) body.app_version = Number(version);

  const response = await sarvamFetch("/api/agents/instant-outbound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as Record<string, unknown>;
  const callId =
    String(data.call_id ?? data.callId ?? data.id ?? "unknown");
  return { callId };
}

export async function createInboundDeployment(config: {
  appId: string;
  agentPhone: string;
  appVersion?: number;
}): Promise<{ deploymentId: string }> {
  const body: Record<string, unknown> = {
    app_id: config.appId,
    agent_phone_number: config.agentPhone,
  };
  if (config.appVersion !== undefined) body.app_version = config.appVersion;

  const response = await sarvamFetch("/api/agents/deployments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as Record<string, unknown>;
  const deploymentId = String(data.deployment_id ?? data.id ?? "unknown");
  return { deploymentId };
}
