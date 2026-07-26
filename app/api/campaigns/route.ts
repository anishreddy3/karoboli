import { listCampaigns, upsertCampaign } from "@/db/campaigns";
import { appendEvent } from "@/db/audit";
import { createSarvamCampaign } from "@/lib/sarvam-campaign";
import type { Campaign } from "@/lib/campaign";
import { buyerRequirementSchema } from "@/lib/domain";

export const runtime = "edge";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || process.env.KAROBOLI_TENANT_ID || "default";
  
  return Response.json({ campaigns: listCampaigns(tenantId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const tenantId = process.env.KAROBOLI_TENANT_ID || "default";

  if (typeof body.name !== "string" || !body.name.trim() || !body.requirement) {
    return Response.json({ error: "Missing name or requirement" }, { status: 400 });
  }

  const requirementResult = buyerRequirementSchema.safeParse(body.requirement);
  if (!requirementResult.success) {
    return Response.json({ error: "Invalid requirement" }, { status: 400 });
  }

  const concurrency = Number(body.concurrency) || 1;
  const maxRetries = Number(body.maxRetries) || 0;
  let campaignId = crypto.randomUUID();

  // If Sarvam API is configured, create the campaign upstream
  const appId = process.env.SARVAM_AGENT_APP_ID;
  if (appId) {
    try {
      const webhookUrl = `${process.env.KAROBOLI_TOOL_BASE_URL || ""}/api/campaigns/webhook`;
      const result = await createSarvamCampaign({
        name: body.name,
        appId,
        appVersion: process.env.SARVAM_AGENT_VERSION ? Number(process.env.SARVAM_AGENT_VERSION) : undefined,
        concurrency,
        maxRetries,
        webhookUrl,
      });
      campaignId = result.campaignId;
    } catch (error) {
      console.warn("Failed to create Sarvam campaign, falling back to local only", error);
    }
  }

  const campaign: Campaign = {
    id: campaignId,
    tenantId,
    name: body.name,
    status: "draft",
    concurrency,
    maxRetries,
    requirement: requirementResult.data,
    cohort: [],
    attempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  upsertCampaign(campaign);

  appendEvent({
    id: crypto.randomUUID(),
    tenantId,
    kind: "campaign.created",
    actorId: "system",
    resourceId: campaignId,
    payload: { name: campaign.name, concurrency, maxRetries },
    createdAt: campaign.createdAt,
  });

  return Response.json({ campaign });
}
