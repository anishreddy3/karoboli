import { getCampaign } from "@/db/campaigns";
import { computeAnalytics } from "@/lib/campaign";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const campaign = getCampaign(id);
  
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({
    campaign,
    analytics: computeAnalytics(campaign),
  });
}
