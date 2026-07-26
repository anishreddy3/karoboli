# Buyer and supplier memory

Karoboli now treats memory as procurement case data, not browser state.

## What is stored

Each case has an opaque UUID and a versioned record in Cloudflare D1:

- buyer and supplier transcripts;
- normalized buyer requirement and supplier offer;
- the selected supplier and current workflow stage;
- supplier price corrections and verbal commitments;
- the deterministic decision, purchase order and SHA-256 evidence record;
- language, timestamps and whether the disclosed fallback was used.

The browser stores only the opaque active-case ID. Refreshing or reopening the
site reloads the case from D1. The interface shows whether memory is loading,
saving, restored or unavailable.

## Identity and access

In the hosted app, records are scoped to the signed-in user email injected by
the hosting layer. Reads, writes and deletes require both the case ID and the
same owner identity. In local development, the unguessable case ID acts as the
temporary scope because hosted identity headers are absent.

The current buildathon workspace is buyer-owned. It remembers both sides of the
conversation so the buyer can audit the resulting deal. The supplier deal-room
view deliberately omits buyer budget, private constraints and policy reasons.
Production supplier invitations require a separate participant table and
server-enforced role grants before external supplier access is enabled.

## Live handoff

Live Samvaad transcript turns are processed in sequence so later corrections
cannot race earlier turns. When the structured buyer requirement is complete,
Karoboli ends the buyer streaming session, saves the case, and automatically
opens the supplier matching stage. If a required field remains uncertain, the
buyer stays in Step 1 and receives one targeted follow-up.

## Production hardening

Before external customers are onboarded:

- add tenant, case-participant and supplier-invitation tables;
- encrypt or redact sensitive transcript fields according to retention policy;
- record consent and purpose for voice capture;
- add role-specific API projections rather than returning a full buyer-owned
  case to the browser;
- retain immutable audit events separately from mutable working memory.
