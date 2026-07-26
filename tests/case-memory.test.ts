import assert from "node:assert/strict";
import test from "node:test";
import {
  CASE_MEMORY_SCHEMA_VERSION,
  caseMemorySchema,
  isBuyerRequirementReady,
  safeStageForMemory,
  supplierVisibleCaseMemory,
  type StoredCaseMemory,
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

test("supplier case projection removes buyer-private memory before transport", () => {
  const stored: StoredCaseMemory = {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    ...completeMemory,
    stage: "decision",
    buyerTranscript: "Private buyer ceiling is ₹41,000",
    offer: fallbackOffer,
    decision: {
      action: "human-approval",
      reasons: ["Private budget threshold"],
      checks: [
        {
          label: "Private ceiling",
          passed: false,
          detail: "₹40,200 exceeds autonomous ceiling",
        },
      ],
    },
  };

  const visible = supplierVisibleCaseMemory(stored);
  const serialized = JSON.stringify(visible);
  assert.equal(visible.requirement?.maximumBudget, 0);
  assert.deepEqual(visible.requirement?.constraints, []);
  assert.equal(visible.buyerTranscript, "");
  assert.equal(visible.evidence, null);
  assert.deepEqual(visible.decision?.reasons, []);
  assert.deepEqual(visible.decision?.checks, []);
  assert.doesNotMatch(serialized, /41,000|41000|Private budget threshold/);
  assert.equal(caseMemorySchema.safeParse(visible).success, true);
});
