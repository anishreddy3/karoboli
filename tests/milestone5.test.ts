import { test } from "node:test";
import assert from "node:assert/strict";

import { upsertTenant, getTenant } from "../db/tenants.ts";
import { enqueue, resolve, listPending } from "../db/approval-queue.ts";
import { upsertSupplier, getSupplier, updateConsent } from "../db/suppliers.ts";
import { upsertCampaign, getCampaign, upsertAttempt } from "../db/campaigns.ts";
import { appendEvent, queryEvents, _clearEvents } from "../db/audit.ts";
import { redactEvent, formatNdjson } from "../lib/audit.ts";
import { computeAnalytics } from "../lib/campaign.ts";
import type { TenantPolicy } from "../lib/tenant.ts";
import type { PurchaseOrder } from "../lib/domain.ts";
import type { CampaignAttempt } from "../lib/campaign.ts";

test("tenant default provisioning and policy override", () => {
  const tenant = getTenant("t-001");
  assert.equal(tenant.id, "t-001");
  assert.equal(tenant.policy.tenantId, "t-001");
  assert.equal(tenant.policy.maximumAutonomousBudget, 0.98);

  const updatedPolicy: TenantPolicy = {
    ...tenant.policy,
    maximumAutonomousBudget: 0.8,
    requireHumanApprovalAbove: 100_000,
  };
  upsertTenant({ ...tenant, policy: updatedPolicy });

  const fetched = getTenant("t-001");
  assert.equal(fetched.policy.maximumAutonomousBudget, 0.8);
  assert.equal(fetched.policy.requireHumanApprovalAbove, 100_000);
});

test("approval queue enqueue, list, and resolve", () => {
  enqueue({
    id: "aq-1",
    tenantId: "t-001",
    callId: "call-1",
    campaignAttemptId: null,
    purchaseOrder: null,
    decision: { action: "human-approval", reasons: ["Testing"], checks: [] },
    resolvedBy: null,
    resolution: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });

  const pending = listPending("t-001");
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, "aq-1");

  const resolved = resolve("aq-1", "approved", "admin-1");
  assert.ok(resolved);
  assert.equal(resolved.resolution, "approved");
  assert.equal(resolved.resolvedBy, "admin-1");

  assert.equal(listPending("t-001").length, 0);
});

test("supplier consent updates", () => {
  upsertSupplier({
    id: "sup-1",
    tenantId: "t-001",
    name: "Test Supplier",
    phone: "91-9999999999",
    area: "Mumbai",
    languages: ["en"],
    completedOrders: 0,
    score: 50,
    consentState: "pending",
    consentUpdatedAt: null,
    createdAt: new Date().toISOString(),
  });

  let sup = getSupplier("sup-1");
  assert.equal(sup?.consentState, "pending");

  updateConsent("sup-1", "given");
  sup = getSupplier("sup-1");
  assert.equal(sup?.consentState, "given");
  assert.ok(sup?.consentUpdatedAt);
});

test("campaign analytics computation and attempt tracking", () => {
  upsertCampaign({
    id: "camp-1",
    tenantId: "t-001",
    name: "Test Campaign",
    status: "running",
    concurrency: 5,
    maxRetries: 1,
    requirement: {} as unknown, // Mock
    cohort: [],
    attempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const attempt1: CampaignAttempt = {
    id: "att-1",
    campaignId: "camp-1",
    supplierName: "S1",
    supplierPhone: "111",
    outcome: "converted",
    callId: "call-1",
    decision: null,
    purchaseOrder: null,
    startedAt: null,
    endedAt: new Date().toISOString(),
  };

  const attempt2: CampaignAttempt = {
    ...attempt1,
    id: "att-2",
    supplierName: "S2",
    outcome: "failed",
  };

  upsertAttempt("camp-1", attempt1);
  upsertAttempt("camp-1", attempt2);

  const campaign = getCampaign("camp-1");
  assert.ok(campaign);
  assert.equal(campaign.attempts.length, 2);

  const analytics = computeAnalytics(campaign);
  assert.equal(analytics.total, 2);
  assert.equal(analytics.converted, 1);
  assert.equal(analytics.failed, 1);
  assert.equal(analytics.conversionRate, 0.5);
});

test("audit redaction and NDJSON formatting", () => {
  _clearEvents();

  appendEvent({
    id: "evt-1",
    tenantId: "t-001",
    kind: "po.written",
    actorId: "system",
    resourceId: "po-1",
    payload: {
      message: "Call with +91-9876543210 completed. Secret is 123.",
      amount: 500,
      nested: { phone: "9876543210" }
    },
    createdAt: new Date().toISOString(),
  });

  const events = queryEvents("t-001");
  assert.equal(events.length, 1);

  const redacted = redactEvent(events[0]);
  const msg = redacted.payload.message as string;
  assert.ok(msg.includes("***"));
  assert.ok(!msg.includes("9876543210"));

  const nested = redacted.payload.nested as Record<string, string>;
  assert.equal(nested.phone, "***");

  assert.equal(redacted.payload.amount, 500); // Numbers preserved

  const ndjson = formatNdjson([redacted]);
  assert.ok(ndjson.includes(`"amount":500`));
  assert.ok(ndjson.endsWith("\n"));
});
