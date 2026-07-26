import { z } from "zod";

export const languageSchema = z.enum(["te-IN", "ta-IN", "hi-IN", "en-IN"]);
export type Language = z.infer<typeof languageSchema>;

export const speechLanguageSchema = z.enum([
  "bn-IN",
  "en-IN",
  "gu-IN",
  "hi-IN",
  "kn-IN",
  "ml-IN",
  "mr-IN",
  "od-IN",
  "pa-IN",
  "ta-IN",
  "te-IN",
]);
export type SpeechLanguage = z.infer<typeof speechLanguageSchema>;

export const paymentTermSchema = z.enum([
  "advance",
  "delivery",
  "net-7",
  "net-15",
  "net-30",
]);
export type PaymentTerm = z.infer<typeof paymentTermSchema>;

export const buyerRequirementSchema = z.object({
  product: z.string().min(1),
  specification: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  deliveryLocation: z.string().min(1),
  requiredBy: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.literal("unknown"),
  ]),
  maximumBudget: z.number().nonnegative(),
  preferredPaymentTerm: z.union([paymentTermSchema, z.literal("unknown")]),
  constraints: z.array(z.string()),
  normalizedSummary: z.string().min(1),
  missingFields: z.array(z.string()),
  needsConfirmation: z.boolean(),
});
export type BuyerRequirement = z.infer<typeof buyerRequirementSchema>;

export const supplierOfferSchema = z.object({
  supplierName: z.string().min(1),
  totalPrice: z.number().nonnegative(),
  unitPrice: z.number().positive().nullable(),
  deliveryDate: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.literal("unknown"),
  ]),
  paymentTerm: z.union([paymentTermSchema, z.literal("unknown")]),
  freightIncluded: z.boolean(),
  unloadingIncluded: z.boolean(),
  gstIncluded: z.boolean(),
  commitments: z.array(z.string()),
  corrections: z.array(
    z.object({
      before: z.number().positive(),
      after: z.number().positive(),
      evidence: z.string().min(1),
    }),
  ),
  unresolvedQuestions: z.array(z.string()),
  normalizedSummary: z.string().min(1),
  needsConfirmation: z.boolean(),
});
export type SupplierOffer = z.infer<typeof supplierOfferSchema>;

export type Guardrails = {
  targetTotal: number;
  autonomousCeiling: number;
  absoluteBudget: number;
  requiredBy: string;
  allowedPaymentTerms: PaymentTerm[];
  requireFreightIncluded: boolean;
};

export type DecisionAction = "auto-accept" | "human-approval" | "reject";

export type Decision = {
  action: DecisionAction;
  reasons: string[];
  checks: Array<{
    label: string;
    passed: boolean;
    detail: string;
  }>;
};

export type PurchaseOrder = {
  id: string;
  createdAt: string;
  supplierName: string;
  product: string;
  specification: string;
  quantity: number;
  unit: string;
  deliveryLocation: string;
  deliveryDate: string;
  paymentTerm: PaymentTerm;
  totalPrice: number;
  freightIncluded: boolean;
  unloadingIncluded: boolean;
  gstIncluded: boolean;
  commitments: string[];
  status: "draft-approved" | "awaiting-human-approval";
};

export type EvidenceRecord = {
  id: string;
  createdAt: string;
  buyerTranscript: string;
  supplierTranscript: string;
  corrections: SupplierOffer["corrections"];
  commitments: string[];
  decision: Decision;
  purchaseOrder: PurchaseOrder | null;
  digest: string;
};
