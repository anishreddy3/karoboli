import assert from "node:assert/strict";
import test from "node:test";
import type { BuyerRequirement, SupplierOffer } from "../lib/domain";
import { nextBuyerQuestion, nextSupplierQuestion } from "../lib/follow-up";
import { evaluateOffer, buildGuardrails } from "../lib/policy";
import {
  dateFromSpokenMonth,
  reconcileBuyerRequirement,
} from "../lib/requirement-reconciliation";
import { reconcileSupplierOffer } from "../lib/supplier-reconciliation";

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

test("Telugu repeat case preserves confirmed facts across one follow-up", () => {
  const firstTurn = reconcileBuyerRequirement(
    {
      ...baseRequirement,
      maximumBudget: 0,
      preferredPaymentTerm: "unknown",
      missingFields: ["maximumBudget", "preferredPaymentTerm"],
      needsConfirmation: true,
    },
    "I need 200 bags of 53 grade cement at Whitefield by July 29.",
  );
  assert.equal(nextBuyerQuestion(firstTurn), "What is the maximum total budget?");

  const completed = reconcileBuyerRequirement(
    {
      ...firstTurn,
      product: "unknown",
      specification: "unknown",
      quantity: 0,
      unit: "unknown",
      deliveryLocation: "unknown",
      requiredBy: "unknown",
      maximumBudget: 41_000,
      preferredPaymentTerm: "delivery",
      missingFields: [],
      needsConfirmation: false,
    },
    "Maximum budget is 41,000 rupees, payment on delivery.",
    firstTurn,
  );
  assert.equal(completed.product, "cement");
  assert.equal(completed.requiredBy, "2026-07-29");
  assert.equal(completed.maximumBudget, 41_000);
  assert.deepEqual(completed.missingFields, []);
  assert.equal(completed.needsConfirmation, false);
});

test("Tamil repeat case repairs spoken dates and recomputes readiness", () => {
  const requirement = reconcileBuyerRequirement(
    {
      ...baseRequirement,
      requiredBy: "2907-07-26",
      missingFields: Object.keys(baseRequirement),
      needsConfirmation: true,
    },
    "Deliver by 29 July. Maximum budget 41,000 rupees. Payment on delivery.",
  );
  assert.equal(requirement.requiredBy, "2026-07-29");
  assert.deepEqual(requirement.missingFields, []);
  assert.equal(requirement.needsConfirmation, false);
});

test("English repeat case asks only the first missing commercial question", () => {
  const requirement: BuyerRequirement = {
    ...baseRequirement,
    deliveryLocation: "unknown",
    requiredBy: "unknown",
    missingFields: ["deliveryLocation", "requiredBy"],
    needsConfirmation: true,
  };
  assert.equal(
    nextBuyerQuestion(requirement),
    "Where should the material be delivered?",
  );
});

test("supplier uncertainty gets one targeted question before policy", () => {
  const rawOffer: SupplierOffer = {
    supplierName: "Metro Cement Depot",
    totalPrice: 40_200,
    unitPrice: 201,
    deliveryDate: "2026-07-28",
    paymentTerm: "delivery",
    freightIncluded: false,
    unloadingIncluded: true,
    gstIncluded: true,
    commitments: ["Delivery by 28 July"],
    corrections: [],
    unresolvedQuestions: [],
    normalizedSummary: "Freight remains unresolved.",
    needsConfirmation: false,
  };
  const offer = reconcileSupplierOffer(
    rawOffer,
    "Final total is 40,200 rupees and delivery is July 28.",
  );
  assert.equal(offer.unitPrice, null);
  assert.equal(offer.paymentTerm, "unknown");
  assert.deepEqual(offer.corrections, []);
  assert.ok(offer.unresolvedQuestions.includes("Is freight included?"));
  assert.equal(
    nextSupplierQuestion(offer),
    "Is freight included in that total?",
  );
  assert.equal(
    evaluateOffer(offer, buildGuardrails(baseRequirement)).action,
    "human-approval",
  );
});

test("three unseen language cases retain a verified Hinglish correction", () => {
  for (const language of ["Telugu", "Tamil", "English"]) {
    const offer = reconcileSupplierOffer(
      {
        supplierName: `${language} repeat supplier`,
        totalPrice: 40_000,
        unitPrice: 200,
        deliveryDate: "2026-07-28",
        paymentTerm: "delivery",
        freightIncluded: true,
        unloadingIncluded: true,
        gstIncluded: true,
        commitments: [
          "Freight, unloading and GST included",
          "Delivery July 28",
          "Payment on delivery",
        ],
        corrections: [
          {
            before: 40_800,
            after: 40_000,
            evidence: "40,800—nahi, correction 40,000",
          },
        ],
        unresolvedQuestions: [],
        normalizedSummary: `${language} buyer repeat offer`,
        needsConfirmation: false,
      },
      "Total 40,800—nahi, correction 40,000. Rate 200 per bag. Freight, unloading and GST included. Delivery July 28. Payment on delivery.",
    );
    assert.equal(offer.corrections.length, 1);
    assert.equal(offer.needsConfirmation, false);
    assert.equal(
      evaluateOffer(offer, buildGuardrails(baseRequirement)).action,
      "auto-accept",
    );
  }
});

test("verified supplier correction deterministically becomes the final total", () => {
  const offer = reconcileSupplierOffer(
    {
      supplierName: "Correction test supplier",
      totalPrice: 40_800,
      unitPrice: null,
      deliveryDate: "2026-07-28",
      paymentTerm: "delivery",
      freightIncluded: true,
      unloadingIncluded: true,
      gstIncluded: true,
      commitments: ["Final corrected total is ₹40,200"],
      corrections: [
        {
          before: 40_800,
          after: 40_200,
          evidence: "40800, nahi correction 40200",
        },
      ],
      unresolvedQuestions: [],
      normalizedSummary: "Corrected supplier offer",
      needsConfirmation: false,
    },
    "Total 40800, nahi correction 40200. Freight, unloading and GST included. Delivery July 28, payment on delivery.",
  );

  assert.equal(offer.totalPrice, 40_200);
});

test("evaluateOffer rejection path handles single and multiple check failures", () => {
  const guardrails = buildGuardrails(baseRequirement);

  const baseOffer: SupplierOffer = {
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
    normalizedSummary: "Complete test offer",
    needsConfirmation: false,
  };

  // Test individual failures
  const budgetFailure = evaluateOffer(
    { ...baseOffer, totalPrice: 42_000 },
    guardrails,
  );
  assert.equal(budgetFailure.action, "reject");
  // Total price fails both budget and autonomy
  assert.deepEqual(budgetFailure.reasons, ["Absolute budget", "Autonomy ceiling"]);

  const deliveryFailure = evaluateOffer(
    { ...baseOffer, deliveryDate: "2026-07-30" },
    guardrails,
  );
  assert.equal(deliveryFailure.action, "reject");
  assert.deepEqual(deliveryFailure.reasons, ["Delivery deadline"]);

  const paymentFailure = evaluateOffer(
    { ...baseOffer, paymentTerm: "advance" },
    guardrails,
  );
  assert.equal(paymentFailure.action, "reject");
  assert.deepEqual(paymentFailure.reasons, ["Payment term"]);

  const freightFailure = evaluateOffer(
    { ...baseOffer, freightIncluded: false },
    guardrails,
  );
  assert.equal(freightFailure.action, "reject");
  assert.deepEqual(freightFailure.reasons, ["Freight included"]);

  // Test multiple simultaneous failures
  const multipleFailure = evaluateOffer(
    {
      ...baseOffer,
      totalPrice: 42_000,
      deliveryDate: "2026-07-30",
      paymentTerm: "advance",
      freightIncluded: false,
    },
    guardrails,
  );
  assert.equal(multipleFailure.action, "reject");
  assert.deepEqual(multipleFailure.reasons, [
    "Absolute budget",
    "Autonomy ceiling",
    "Delivery deadline",
    "Payment term",
    "Freight included",
  ]);
});

test("deadline parser understands multilingual and relative date phrases", () => {
  const cases = [
    ["జూలై 29 లోపు డెలివరీ కావాలి", "2026-07-29"],
    ["ஜூலை 29 க்குள் டெலிவரி வேண்டும்", "2026-07-29"],
    ["29 जुलाई तक डिलीवरी चाहिए", "2026-07-29"],
    ["Deliver by July twenty ninth", "2026-07-29"],
    ["Delivery tomorrow", "2026-07-27"],
    ["Delivery day after tomorrow", "2026-07-28"],
    ["3 రోజుల్లో డెలివరీ కావాలి", "2026-07-29"],
    ["Deliver by 29/07/2026", "2026-07-29"],
  ] as const;

  for (const [spoken, expected] of cases) {
    assert.equal(dateFromSpokenMonth(spoken), expected, spoken);
  }
});
