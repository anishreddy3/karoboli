import type { BuyerRequirement, Decision, PurchaseOrder } from "./domain";

export type CampaignStatus = "draft" | "running" | "paused" | "completed";
export type AttemptOutcome =
  | "connected"
  | "no-answer"
  | "busy"
  | "failed"
  | "converted";

export type CampaignAttempt = {
  id: string;
  campaignId: string;
  supplierName: string;
  supplierPhone: string;
  outcome: AttemptOutcome | null;
  callId: string | null;
  decision: Decision | null;
  purchaseOrder: PurchaseOrder | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type CohortRow = {
  supplierName: string;
  supplierPhone: string;
  [key: string]: string;
};

export type Campaign = {
  id: string;
  tenantId: string;
  name: string;
  status: CampaignStatus;
  concurrency: number;
  maxRetries: number;
  requirement: BuyerRequirement;
  cohort: CohortRow[];
  attempts: CampaignAttempt[];
  createdAt: string;
  updatedAt: string;
};

export type CampaignAnalytics = {
  total: number;
  connected: number;
  converted: number;
  noAnswer: number;
  failed: number;
  conversionRate: number;
};

export function computeAnalytics(campaign: Campaign): CampaignAnalytics {
  const attempts = campaign.attempts;
  const total = attempts.length;
  const connected = attempts.filter((a) => a.outcome === "connected" || a.outcome === "converted").length;
  const converted = attempts.filter((a) => a.outcome === "converted").length;
  const noAnswer = attempts.filter((a) => a.outcome === "no-answer").length;
  const failed = attempts.filter((a) => a.outcome === "failed" || a.outcome === "busy").length;
  const conversionRate = total > 0 ? converted / total : 0;
  return { total, connected, converted, noAnswer, failed, conversionRate };
}
