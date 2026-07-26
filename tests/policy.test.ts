import assert from "node:assert/strict";
import test from "node:test";
import type { BuyerRequirement, SupplierOffer } from "../lib/domain";
import { evaluateOffer, buildGuardrails } from "../lib/policy";

const baseRequirement: BuyerRequirement = {
  product: "cement",
  specification: "53 grade",
  quantity: 200,
  unit: "bags",
  deliveryLocation: "Whitefield site",
  requiredBy: "2026-07-29",
  maximumBudget: 41_000,
  preferredPaymentTerm: "delivery",
  constraints: [],
  normalizedSummary: "Complete requirement",
  missingFields: [],
  needsConfirmation: false,
};

test("evaluateOffer rejects complete offers that violate critical guardrails", () => {
  const guardrails = buildGuardrails(baseRequirement);

  const baseValidOffer: SupplierOffer = {
    supplierName: "Test Supplier",
    totalPrice: 40_000,
    unitPrice: 200,
    deliveryDate: "2026-07-28",
    paymentTerm: "delivery",
    freightIncluded: true,
    unloadingIncluded: true,
    gstIncluded: true,
    commitments: [],
    corrections: [],
    unresolvedQuestions: [],
    normalizedSummary: "Valid offer",
    needsConfirmation: false,
  };

  // 1. Exceeding absolute budget
  const budgetReject = evaluateOffer(
    { ...baseValidOffer, totalPrice: 42_000 },
    guardrails,
  );
  assert.equal(budgetReject.action, "reject");
  assert.ok(budgetReject.reasons.includes("Absolute budget"));

  // 2. Late delivery
  const deliveryReject = evaluateOffer(
    { ...baseValidOffer, deliveryDate: "2026-07-30" },
    guardrails,
  );
  assert.equal(deliveryReject.action, "reject");
  assert.ok(deliveryReject.reasons.includes("Delivery deadline"));

  // 3. Disallowed payment term
  const paymentReject = evaluateOffer(
    { ...baseValidOffer, paymentTerm: "advance" },
    guardrails,
  );
  assert.equal(paymentReject.action, "reject");
  assert.ok(paymentReject.reasons.includes("Payment term"));

  // 4. Freight not included
  const freightReject = evaluateOffer(
    { ...baseValidOffer, freightIncluded: false },
    guardrails,
  );
  assert.equal(freightReject.action, "reject");
  assert.ok(freightReject.reasons.includes("Freight included"));

  // 5. Multiple rejection reasons
  const multiReject = evaluateOffer(
    {
      ...baseValidOffer,
      totalPrice: 42_000,
      deliveryDate: "2026-07-30",
    },
    guardrails,
  );
  assert.equal(multiReject.action, "reject");
  assert.ok(multiReject.reasons.includes("Absolute budget"));
  assert.ok(multiReject.reasons.includes("Delivery deadline"));
});
