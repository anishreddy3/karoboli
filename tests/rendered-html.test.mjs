import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function requestApp(path, init) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Karoboli live demo shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Karoboli — Voice-native procurement for India<\/title>/i);
  assert.match(html, /A buyer speaks/);
  assert.match(html, /What do you need/);
  assert.match(html, /Use disclosed fallback/);
  assert.match(html, /Start new case/);
  assert.match(html, /Never hide uncertainty/);
  assert.doesNotMatch(html, /Your site is taking shape/);
});

test("keeps deterministic authority separate from Sarvam extraction", async () => {
  const [policy, understandingRoute, component] = await Promise.all([
    readFile(new URL("../lib/policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/understand/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/KaroboliApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(policy, /export function evaluateOffer/);
  assert.match(policy, /absoluteBudget/);
  assert.match(policy, /human-approval/);
  assert.doesNotMatch(understandingRoute, /auto-accept|createPurchaseOrder/);
  assert.match(component, /Disclosed fallback case/);
  assert.match(component, /const requirementReady/);
  assert.match(
    component,
    /const guardrails = requirementReady \? buildGuardrails\(requirement\) : null/,
  );
});

test("keeps agent sessions and deterministic tools closed without secrets", async () => {
  const [session, tool] = await Promise.all([
    requestApp("/api/agent/session", { method: "POST" }),
    requestApp("/api/agent-tools/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  ]);
  assert.equal(session.status, 503);
  assert.equal(tool.status, 503);
});
