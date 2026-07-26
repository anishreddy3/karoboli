import type { BuyerRequirement, Decision, PurchaseOrder } from "./domain";

export type ConsentState = "pending" | "given" | "revoked";

export type CallRecord = {
  id: string;
  createdAt: string;
  supplierName: string;
  supplierPhone: string;
  agentPhone: string;
  connectionId: string;
  interactionId?: string;
  consentState: ConsentState;
  status: "dialing" | "connected" | "completed" | "failed";
  transcriptSummary?: string;
  decision: Decision | null;
  purchaseOrder: PurchaseOrder | null;
  commitments: string[];
  callDurationSeconds?: number;
};

export type OutboundCallRequest = {
  supplierName: string;
  supplierPhone: string;
  requirement: BuyerRequirement;
  connectionId: string;
  agentPhone: string;
  webhookUrl: string;
};
