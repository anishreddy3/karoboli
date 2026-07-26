import test from "node:test";
import assert from "node:assert/strict";
import { evaluateOffer } from "../lib/policy";
import type { SupplierOffer, Guardrails } from "../lib/domain";

test("evaluateOffer returns auto-accept for happy path", () => {
  const guardrails: Guardrails = {
    targetTotal: 9000,
    autonomousCeiling: 9500,
    absoluteBudget: 10000,
    requiredBy: "2026-07-29",
    allowedPaymentTerms: ["delivery", "net-7"],
    requireFreightIncluded: true,
  };

  const offer: SupplierOffer = {
    supplierName: "Test Supplier",
    totalPrice: 9000, // Below autonomous ceiling
    unitPrice: 90,
    deliveryDate: "2026-07-28", // Before requiredBy
    paymentTerm: "delivery", // Allowed
    freightIncluded: true, // Required
    unloadingIncluded: true,
    gstIncluded: true,
    commitments: [],
    corrections: [],
    unresolvedQuestions: [],
    normalizedSummary: "Summary",
    needsConfirmation: false,
  };

  const decision = evaluateOffer(offer, guardrails);

  assert.equal(decision.action, "auto-accept");
  assert.ok(decision.reasons.length > 0);
  assert.ok(decision.checks.every(check => check.passed));
});

test("evaluateOffer returns auto-accept when price exactly matches autonomousCeiling", () => {
  const guardrails: Guardrails = {
    targetTotal: 9000,
    autonomousCeiling: 9500,
    absoluteBudget: 10000,
    requiredBy: "2026-07-29",
    allowedPaymentTerms: ["delivery", "net-7"],
    requireFreightIncluded: true,
  };

  const offer: SupplierOffer = {
    supplierName: "Test Supplier",
    totalPrice: 9500, // Exactly equals autonomous ceiling
    unitPrice: 95,
    deliveryDate: "2026-07-28",
    paymentTerm: "delivery",
    freightIncluded: true,
    unloadingIncluded: true,
    gstIncluded: true,
    commitments: [],
    corrections: [],
    unresolvedQuestions: [],
    normalizedSummary: "Summary",
    needsConfirmation: false,
  };

  const decision = evaluateOffer(offer, guardrails);

  assert.equal(decision.action, "auto-accept");
  assert.ok(decision.checks.every(check => check.passed));
});

test("evaluateOffer returns auto-accept when delivery exactly matches requiredBy", () => {
  const guardrails: Guardrails = {
    targetTotal: 9000,
    autonomousCeiling: 9500,
    absoluteBudget: 10000,
    requiredBy: "2026-07-29",
    allowedPaymentTerms: ["delivery", "net-7"],
    requireFreightIncluded: true,
  };

  const offer: SupplierOffer = {
    supplierName: "Test Supplier",
    totalPrice: 9000,
    unitPrice: 90,
    deliveryDate: "2026-07-29", // Exactly equals requiredBy
    paymentTerm: "delivery",
    freightIncluded: true,
    unloadingIncluded: true,
    gstIncluded: true,
    commitments: [],
    corrections: [],
    unresolvedQuestions: [],
    normalizedSummary: "Summary",
    needsConfirmation: false,
  };

  const decision = evaluateOffer(offer, guardrails);

  assert.equal(decision.action, "auto-accept");
  assert.ok(decision.checks.every(check => check.passed));
});
