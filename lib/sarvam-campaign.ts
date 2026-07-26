import { sarvamFetch } from "./sarvam-server";
import type { CohortRow } from "./campaign";

export async function createSarvamCampaign(params: {
  name: string;
  appId: string;
  appVersion?: number;
  concurrency: number;
  maxRetries: number;
  webhookUrl: string;
}): Promise<{ campaignId: string }> {
  const body: Record<string, unknown> = {
    name: params.name,
    app_id: params.appId,
    concurrency: params.concurrency,
    max_retries: params.maxRetries,
    webhook_url: params.webhookUrl,
  };
  if (params.appVersion !== undefined) body.app_version = params.appVersion;

  const response = await sarvamFetch("/api/agents/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as Record<string, unknown>;
  const campaignId = String(data.campaign_id ?? data.id ?? "unknown");
  return { campaignId };
}

export async function uploadCohort(
  campaignId: string,
  rows: CohortRow[],
): Promise<{ uploaded: number }> {
  const response = await sarvamFetch(`/api/agents/campaigns/${campaignId}/cohort`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });

  const data = (await response.json()) as Record<string, unknown>;
  const uploaded = typeof data.uploaded === "number" ? data.uploaded : rows.length;
  return { uploaded };
}

export async function getCampaignAttempts(
  campaignId: string,
): Promise<{ attempts: Array<{ id: string; outcome: string | null; callId: string | null }> }> {
  const response = await sarvamFetch(`/api/agents/campaigns/${campaignId}/attempts`, {
    method: "GET",
  });
  const data = (await response.json()) as { attempts?: unknown[] };
  const attempts = Array.isArray(data.attempts)
    ? (data.attempts as Array<{ id: string; outcome: string | null; callId: string | null }>)
    : [];
  return { attempts };
}
