import assert from "node:assert/strict";
import test from "node:test";
import type {
  BuyerRequirement,
  Decision,
  Guardrails,
  SupplierOffer,
} from "../lib/domain";
import {
  buildGuardrails,
  createPurchaseOrder,
  evaluateOffer,
} from "../lib/policy";

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

const baseOffer: SupplierOffer = {
  supplierName: "Metro Cement Depot",
  totalPrice: 40_200,
  unitPrice: 201,
  deliveryDate: "2026-07-28",
  paymentTerm: "delivery",
  freightIncluded: true,
  unloadingIncluded: true,
  gstIncluded: true,
  commitments: [],
  corrections: [],
  unresolvedQuestions: [],
  normalizedSummary: "Complete offer",
  needsConfirmation: false,
};

const baseGuardrails: Guardrails = {
  targetTotal: 9_400,
  autonomousCeiling: 9_800,
  absoluteBudget: 10_000,
  requiredBy: "2026-07-29",
  allowedPaymentTerms: ["net-30", "delivery"],
  requireFreightIncluded: true,
};

test("evaluateOffer auto-accepts a complete offer under the autonomy ceiling", () => {
  const decision = evaluateOffer(
    {
      ...baseOffer,
      totalPrice: 9_500,
      unitPrice: 95,
      deliveryDate: "2026-07-28",
      paymentTerm: "net-30",
      normalizedSummary: "Valid offer",
    },
    baseGuardrails,
  );

  assert.equal(decision.action, "auto-accept");
  assert.ok(decision.checks.every((check) => check.passed));
});

test("evaluateOffer auto-accepts when price equals the autonomy ceiling", () => {
  const decision = evaluateOffer(
    { ...baseOffer, totalPrice: 9_800, unitPrice: 98 },
    baseGuardrails,
  );
  assert.equal(decision.action, "auto-accept");
});

test("evaluateOffer auto-accepts when delivery equals requiredBy", () => {
  const decision = evaluateOffer(
    { ...baseOffer, totalPrice: 9_500, deliveryDate: "2026-07-29" },
    baseGuardrails,
  );
  assert.equal(decision.action, "auto-accept");
});

test("evaluateOffer requests human approval for unresolved commercial facts", () => {
  const withQuestions = evaluateOffer(
    { ...baseOffer, totalPrice: 9_500, unresolvedQuestions: ["Warranty?"] },
    baseGuardrails,
  );
  assert.equal(withQuestions.action, "human-approval");
  assert.ok(
    withQuestions.reasons.includes("Offer has unresolved commercial facts"),
  );

  const needsConfirmation = evaluateOffer(
    { ...baseOffer, totalPrice: 9_500, needsConfirmation: true },
    baseGuardrails,
  );
  assert.equal(needsConfirmation.action, "human-approval");
});

test("evaluateOffer requests human approval above autonomy but under absolute budget", () => {
  const decision = evaluateOffer(
    { ...baseOffer, totalPrice: 9_900 },
    baseGuardrails,
  );
  assert.equal(decision.action, "human-approval");
  assert.ok(decision.reasons.includes("Autonomy ceiling"));
});

test("evaluateOffer rejects offers that fail critical guardrails", () => {
  const guardrails = buildGuardrails(baseRequirement);
  const complete: SupplierOffer = {
    ...baseOffer,
    totalPrice: 40_000,
    unitPrice: 200,
    deliveryDate: "2026-07-28",
  };

  const budget = evaluateOffer({ ...complete, totalPrice: 42_000 }, guardrails);
  assert.equal(budget.action, "reject");
  assert.deepEqual(budget.reasons, ["Absolute budget", "Autonomy ceiling"]);

  const delivery = evaluateOffer(
    { ...complete, deliveryDate: "2026-07-30" },
    guardrails,
  );
  assert.equal(delivery.action, "reject");
  assert.deepEqual(delivery.reasons, ["Delivery deadline"]);

  const payment = evaluateOffer(
    { ...complete, paymentTerm: "advance" },
    guardrails,
  );
  assert.equal(payment.action, "reject");
  assert.deepEqual(payment.reasons, ["Payment term"]);

  const freight = evaluateOffer(
    { ...complete, freightIncluded: false },
    guardrails,
  );
  assert.equal(freight.action, "reject");
  assert.deepEqual(freight.reasons, ["Freight included"]);

  const multiple = evaluateOffer(
    {
      ...complete,
      totalPrice: 42_000,
      deliveryDate: "2026-07-30",
      paymentTerm: "advance",
      freightIncluded: false,
    },
    guardrails,
  );
  assert.equal(multiple.action, "reject");
  assert.deepEqual(multiple.reasons, [
    "Absolute budget",
    "Autonomy ceiling",
    "Delivery deadline",
    "Payment term",
    "Freight included",
  ]);
});

test("createPurchaseOrder returns null for reject or unknown commercial fields", () => {
  const reject: Decision = {
    action: "reject",
    reasons: ["Too expensive"],
    checks: [],
  };
  assert.equal(createPurchaseOrder(baseRequirement, baseOffer, reject), null);

  const accept: Decision = {
    action: "auto-accept",
    reasons: [],
    checks: [],
  };
  assert.equal(
    createPurchaseOrder(
      baseRequirement,
      { ...baseOffer, deliveryDate: "unknown" },
      accept,
    ),
    null,
  );
  assert.equal(
    createPurchaseOrder(
      baseRequirement,
      { ...baseOffer, paymentTerm: "unknown" },
      accept,
    ),
    null,
  );
});

test("createPurchaseOrder builds draft and awaiting-approval purchase orders", () => {
  const auto = createPurchaseOrder(baseRequirement, baseOffer, {
    action: "auto-accept",
    reasons: [],
    checks: [],
  });
  assert.ok(auto);
  assert.match(auto.id, /^KBL-\d{8}-\d{4}$/);
  assert.equal(auto.supplierName, baseOffer.supplierName);
  assert.equal(auto.product, baseRequirement.product);
  assert.equal(auto.totalPrice, baseOffer.totalPrice);
  assert.equal(auto.status, "draft-approved");

  const human = createPurchaseOrder(baseRequirement, baseOffer, {
    action: "human-approval",
    reasons: ["Requires manual review"],
    checks: [],
  });
  assert.ok(human);
  assert.equal(human.status, "awaiting-human-approval");
});
