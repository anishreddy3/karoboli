import type { PaymentTerm } from "./domain";

export type TenantPolicy = {
  id: string;
  tenantId: string;
  maximumAutonomousBudget: number;   // overrides the default 98 % of maximumBudget ceiling
  requireHumanApprovalAbove: number; // absolute INR threshold regardless of ceiling
  allowedPaymentTerms: PaymentTerm[];
  requireFreightIncluded: boolean;
  updatedAt: string;
};

export type Tenant = {
  id: string;
  name: string;
  createdAt: string;
  policy: TenantPolicy;
};

export const DEFAULT_POLICY: Omit<TenantPolicy, "id" | "tenantId" | "updatedAt"> = {
  maximumAutonomousBudget: 0.98,   // 98 % of budget ceiling
  requireHumanApprovalAbove: 500_000,
  allowedPaymentTerms: ["delivery", "advance"],
  requireFreightIncluded: false,
};
