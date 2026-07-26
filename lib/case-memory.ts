import { z } from "zod";
import {
  buyerRequirementSchema,
  speechLanguageSchema,
  supplierOfferSchema,
  type BuyerRequirement,
  type Decision,
  type EvidenceRecord,
  type PurchaseOrder,
} from "@/lib/domain";

export const CASE_MEMORY_SCHEMA_VERSION = 1 as const;

export const caseStageSchema = z.enum(["brief", "supplier", "decision"]);
export type CaseStage = z.infer<typeof caseStageSchema>;

export const caseMemorySchema = z.object({
  schemaVersion: z.literal(CASE_MEMORY_SCHEMA_VERSION),
  stage: caseStageSchema,
  language: z.enum(["unknown", "te-IN", "ta-IN", "hi-IN", "en-IN"]),
  selectedSupplier: z.string().min(1).max(160),
  buyerTranscript: z.string().max(20_000),
  buyerEnglishTranscript: z.string().max(20_000).default(""),
  supplierTranscript: z.string().max(20_000),
  supplierEnglishTranscript: z.string().max(20_000).default(""),
  sellerBriefLanguage: speechLanguageSchema.default("en-IN"),
  requirement: buyerRequirementSchema.nullable(),
  offer: supplierOfferSchema.nullable(),
  decision: z
    .custom<Decision>(
      (value) => typeof value === "object" && value !== null,
    )
    .nullable(),
  purchaseOrder: z
    .custom<PurchaseOrder>(
      (value) => typeof value === "object" && value !== null,
    )
    .nullable(),
  evidence: z
    .custom<EvidenceRecord>(
      (value) => typeof value === "object" && value !== null,
    )
    .nullable(),
  fallbackUsed: z.boolean(),
});

export type CaseMemory = z.infer<typeof caseMemorySchema>;

export type StoredCaseMemory = CaseMemory & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export function isBuyerRequirementReady(
  requirement: CaseMemory["requirement"],
): requirement is BuyerRequirement {
  return Boolean(
    requirement &&
      !requirement.needsConfirmation &&
      requirement.product.trim() &&
      requirement.specification.trim() &&
      requirement.quantity > 0 &&
      requirement.unit.trim() &&
      requirement.deliveryLocation.trim() &&
      requirement.requiredBy !== "unknown" &&
      requirement.maximumBudget > 0 &&
      requirement.preferredPaymentTerm !== "unknown",
  );
}

export function supplierVisibleCaseMemory(
  memory: StoredCaseMemory,
): StoredCaseMemory {
  const requirement = memory.requirement
    ? {
        ...memory.requirement,
        maximumBudget: 0,
        constraints: [],
        normalizedSummary: `${memory.requirement.quantity} ${memory.requirement.unit} of ${memory.requirement.product}, ${memory.requirement.specification}, delivered to ${memory.requirement.deliveryLocation} by ${memory.requirement.requiredBy}.`,
      }
    : null;
  const decision = memory.decision
    ? {
        ...memory.decision,
        reasons: [],
        checks: [],
      }
    : null;

  return {
    ...memory,
    buyerTranscript: "",
    buyerEnglishTranscript: "",
    requirement,
    decision,
    evidence: null,
  };
}

export function safeStageForMemory(memory: CaseMemory): CaseStage {
  if (memory.stage === "decision") {
    return memory.requirement && memory.offer && memory.decision
      ? "decision"
      : memory.requirement
        ? "supplier"
        : "brief";
  }

  if (memory.stage === "supplier") {
    return isBuyerRequirementReady(memory.requirement) ? "supplier" : "brief";
  }

  return "brief";
}
