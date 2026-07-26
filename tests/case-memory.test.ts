import assert from "node:assert/strict";
import test from "node:test";
import {
  CASE_MEMORY_SCHEMA_VERSION,
  caseMemorySchema,
  isBuyerRequirementReady,
  safeStageForMemory,
} from "../lib/case-memory";
import { fallbackOffer, fallbackRequirement } from "../lib/fixtures";

const completeMemory = {
  schemaVersion: CASE_MEMORY_SCHEMA_VERSION,
  stage: "supplier" as const,
  language: "te-IN" as const,
  selectedSupplier: fallbackOffer.supplierName,
  buyerTranscript: "Complete buyer brief",
  supplierTranscript: "",
  requirement: fallbackRequirement,
  offer: null,
  decision: null,
  purchaseOrder: null,
  evidence: null,
  fallbackUsed: false,
};

test("complete buyer requirements are eligible for the live supplier handoff", () => {
  assert.equal(isBuyerRequirementReady(fallbackRequirement), true);
  assert.equal(
    isBuyerRequirementReady({
      ...fallbackRequirement,
      requiredBy: "unknown",
      needsConfirmation: false,
    }),
    false,
  );
});

test("case memory validates the versioned buyer and seller context", () => {
  const parsed = caseMemorySchema.safeParse(completeMemory);
  assert.equal(parsed.success, true);

  const wrongVersion = caseMemorySchema.safeParse({
    ...completeMemory,
    schemaVersion: 2,
  });
  assert.equal(wrongVersion.success, false);
});

test("restored stage cannot skip required workflow state", () => {
  assert.equal(safeStageForMemory(completeMemory), "supplier");
  assert.equal(
    safeStageForMemory({
      ...completeMemory,
      stage: "decision",
      offer: fallbackOffer,
      decision: null,
    }),
    "supplier",
  );
  assert.equal(
    safeStageForMemory({
      ...completeMemory,
      stage: "supplier",
      requirement: null,
    }),
    "brief",
  );
});
