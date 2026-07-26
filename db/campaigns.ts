import type { Campaign, CampaignAttempt } from "../lib/campaign.ts";

const store = new Map<string, Campaign>();

export function upsertCampaign(campaign: Campaign): void {
  store.set(campaign.id, campaign);
}

export function getCampaign(id: string): Campaign | undefined {
  return store.get(id);
}

export function listCampaigns(tenantId?: string): Campaign[] {
  return [...store.values()]
    .filter((c) => tenantId === undefined || c.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function upsertAttempt(campaignId: string, attempt: CampaignAttempt): boolean {
  const campaign = store.get(campaignId);
  if (!campaign) return false;
  const existing = campaign.attempts.findIndex((a) => a.id === attempt.id);
  const attempts =
    existing >= 0
      ? campaign.attempts.map((a, i) => (i === existing ? attempt : a))
      : [...campaign.attempts, attempt];
  store.set(campaignId, {
    ...campaign,
    attempts,
    updatedAt: new Date().toISOString(),
  });
  return true;
}
