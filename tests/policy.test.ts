import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOffer } from "../lib/policy";
import type { Guardrails, SupplierOffer } from "../lib/domain";

const baseGuardrails: Guardrails = {
  targetTotal: 9400,
  autonomousCeiling: 9800,
  absoluteBudget: 10000,
  requiredBy: "2024-12-31",
  allowedPaymentTerms: ["net-30", "delivery"],
  requireFreightIncluded: true,
};

const baseOffer: SupplierOffer = {
  supplierName: "Test Supplier",
  totalPrice: 9500, // Below autonomous ceiling (9800)
  unitPrice: 95,
  deliveryDate: "2024-12-30", // Before requiredBy
  paymentTerm: "net-30", // Allowed
  freightIncluded: true, // Required by guardrails
  unloadingIncluded: true,
  gstIncluded: true,
  commitments: [],
  corrections: [],
  unresolvedQuestions: [],
  normalizedSummary: "Test offer",
  needsConfirmation: false,
};

test("evaluateOffer - auto-accept (happy path)", () => {
  const decision = evaluateOffer(baseOffer, baseGuardrails);
  assert.equal(decision.action, "auto-accept");
  assert.equal(
    decision.checks.every((c) => c.passed),
    true
  );
});

test("evaluateOffer - human-approval (incomplete offer - unresolved questions)", () => {
  const incompleteOffer = {
    ...baseOffer,
    unresolvedQuestions: ["What about warranty?"],
  };
  const decision = evaluateOffer(incompleteOffer, baseGuardrails);
  assert.equal(decision.action, "human-approval");
  assert.ok(decision.reasons.includes("Offer has unresolved commercial facts"));
});

test("evaluateOffer - human-approval (incomplete offer - needs confirmation)", () => {
  const incompleteOffer = {
    ...baseOffer,
    needsConfirmation: true,
  };
  const decision = evaluateOffer(incompleteOffer, baseGuardrails);
  assert.equal(decision.action, "human-approval");
  assert.ok(decision.reasons.includes("Offer has unresolved commercial facts"));
});

test("evaluateOffer - reject (over absolute budget)", () => {
  const expensiveOffer = {
    ...baseOffer,
    totalPrice: 10500,
  };
  const decision = evaluateOffer(expensiveOffer, baseGuardrails);
  assert.equal(decision.action, "reject");
  assert.ok(decision.reasons.includes("Absolute budget"));
});

test("evaluateOffer - reject (delivery too late)", () => {
  const lateOffer = {
    ...baseOffer,
    deliveryDate: "2025-01-01",
  };
  const decision = evaluateOffer(lateOffer, baseGuardrails);
  assert.equal(decision.action, "reject");
  assert.ok(decision.reasons.includes("Delivery deadline"));
});

test("evaluateOffer - reject (payment term not allowed)", () => {
  const badPaymentOffer = {
    ...baseOffer,
    paymentTerm: "advance" as const,
  };
  const decision = evaluateOffer(badPaymentOffer, baseGuardrails);
  assert.equal(decision.action, "reject");
  assert.ok(decision.reasons.includes("Payment term"));
});

test("evaluateOffer - reject (freight not included when required)", () => {
  const noFreightOffer = {
    ...baseOffer,
    freightIncluded: false,
  };
  const decision = evaluateOffer(noFreightOffer, baseGuardrails);
  assert.equal(decision.action, "reject");
  assert.ok(decision.reasons.includes("Freight included"));
});

test("evaluateOffer - human-approval (over autonomy ceiling but under absolute budget)", () => {
  const midOffer = {
    ...baseOffer,
    totalPrice: 9900,
  };
  const decision = evaluateOffer(midOffer, baseGuardrails);
  assert.equal(decision.action, "human-approval");
  assert.ok(decision.reasons.includes("Autonomy ceiling"));
});
