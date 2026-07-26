import { test } from "node:test";
import assert from "node:assert/strict";
import type { CallRecord } from "../lib/telephony.ts";
import { upsertCall, getCall, listCalls } from "../db/telephony.ts";

const makeRecord = (id: string, status: CallRecord["status"] = "dialing"): CallRecord => ({
  id,
  createdAt: new Date().toISOString(),
  supplierName: "Test Supplier",
  supplierPhone: "91-9999999999",
  agentPhone: "91-8888888888",
  connectionId: "conn-001",
  consentState: "pending",
  status,
  decision: null,
  purchaseOrder: null,
  commitments: [],
});

test("upsertCall and getCall round-trip", () => {
  const record = makeRecord("call-001");
  upsertCall(record);
  const retrieved = getCall("call-001");
  assert.ok(retrieved, "should retrieve the record");
  assert.equal(retrieved.id, "call-001");
  assert.equal(retrieved.status, "dialing");
  assert.equal(retrieved.supplierName, "Test Supplier");
});

test("getCall returns undefined for unknown id", () => {
  const result = getCall("nonexistent-id");
  assert.equal(result, undefined);
});

test("listCalls returns all stored records", () => {
  upsertCall(makeRecord("call-A"));
  upsertCall(makeRecord("call-B"));
  upsertCall(makeRecord("call-C"));
  const calls = listCalls();
  const ids = calls.map((c) => c.id);
  assert.ok(ids.includes("call-A"));
  assert.ok(ids.includes("call-B"));
  assert.ok(ids.includes("call-C"));
});

test("idempotent upsert: same id updates status", () => {
  const record = makeRecord("call-update-test", "dialing");
  upsertCall(record);
  assert.equal(getCall("call-update-test")?.status, "dialing");

  const updated = { ...record, status: "completed" as const };
  upsertCall(updated);
  assert.equal(getCall("call-update-test")?.status, "completed");
});

test("human-approval decision is preserved in call record", () => {
  const record = makeRecord("call-approval-test");
  const withDecision: CallRecord = {
    ...record,
    status: "completed",
    decision: {
      action: "human-approval",
      reasons: ["Offer exceeds autonomous ceiling"],
      checks: [],
    },
  };
  upsertCall(withDecision);
  const retrieved = getCall("call-approval-test");
  assert.equal(retrieved?.decision?.action, "human-approval");
  assert.deepEqual(retrieved?.decision?.reasons, ["Offer exceeds autonomous ceiling"]);
});
