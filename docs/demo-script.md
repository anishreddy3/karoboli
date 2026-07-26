# Three-minute demo script

## 0:00–0:25 — Problem

“India’s SME procurement still runs on calls and WhatsApp. A buyer speaks one
language, a supplier prefers another, and a corrected price or delivery promise
disappears into memory. Karoboli turns that conversation into a controlled,
auditable purchase decision.”

## 0:25–0:45 — Why voice is load-bearing

“This is not a voice wrapper around a form. The workflow contains code-mixing,
spoken numbers, mid-sentence corrections, interruptions, and two people with
different language preferences.”

Point briefly to **Samvaad Agent → Policy engine → Streaming voice**. Do not
explain the architecture yet.

## 0:45–1:15 — Buyer brief in Telugu

Select **Telugu**. Say:

> “Naaku 200 bags 53 grade cement kavali, Whitefield site ki July 29 lopu
> delivery. Maximum budget forty one thousand rupees, payment delivery appudu.”

Show:

1. **Original language** and **English translation** as separate panels.
2. Extracted item, quantity, location, deadline, budget, and payment term.
3. The automatic move to supplier matching.
4. The Cloudflare D1 memory indicator.

Say: “Sarvam preserves what was spoken while Karoboli creates an English
operating view. We never replace the source transcript.”

## 1:15–1:45 — Seller-controlled multilingual brief

Select **Telugu** under **Seller brief language**, then click **Hear agent
brief**.

After the first sentence, click **Stop agent brief**.

“The seller chooses the language and can interrupt or stop the agent. The
spoken RFQ includes quantity, specification, location, and deadline—but never
reveals the buyer’s private budget.”

If useful, switch once to **Tamil** or **English** and replay only a few seconds.
Do not play the full brief during a three-minute demo.

## 1:45–2:10 — Supplier correction

Say:

> “Sir total forty thousand eight hundred—nahi, correction forty thousand two
> hundred. Freight aur unloading included hai. GST bhi included. July twenty
> eighth delivery, payment on delivery.”

Pause on:

- the separate original-language and English offer panels;
- `₹40,800 → ₹40,200`; and
- the captured freight, unloading, GST, delivery, and payment commitments.

## 2:10–2:30 — Role-safe deal room and autopilot

Switch once between **Buyer view** and **Supplier view**.

“Both sides share the RFQ, this supplier’s offer, corrections, and commitments.
The buyer’s ceiling and policy details never cross the supplier boundary.”

Return to **Buyer view** and click **Engage Autopilot**.

“Autopilot evaluates confidence against buyer-only policy. It can negotiate or
route a draft for approval; it cannot place an order or bypass configured
authority.”

## 2:30–2:50 — Deterministic action

Click **Apply guardrails**.

“Sarvam extracts multilingual facts; it does not own the wallet. A deterministic
engine checks budget, deadline, payment, freight, and unresolved facts.”

Show the decision and purchase-order draft.

## 2:50–3:00 — Evidence and close

Point to the SHA-256 evidence record.

“The conversation is not the output. A verifiable, reviewable business action
is. Karoboli is the bridge between how India speaks and how a company safely
buys.”

## Demo operator checklist

- Click **Start new case**, confirm the buyer brief is empty, and check
  **Samvaad ready**.
- Keep **Composed fallback** available even when using live Samvaad.
- Use headphones or moderate speaker volume to avoid microphone feedback.
- Stop the seller brief after one sentence; this proves interruption and saves
  time.
- Stay in **Buyer view** when engaging autopilot.
- Never describe the prototype as placing a live order.
- If a live call is available, use a consenting team member—not an unprepared
  real supplier.

## Backup path

If venue connectivity or an API fails, say:

“I’ll use the disclosed fallback recording so you can inspect the same
deterministic downstream behavior. This banner makes clear it is not live.”

Click **Use disclosed fallback**, open the supplier stage, demonstrate the
language selector and stop control, then continue from the correction and deal
room.

## Q&A — architecture

“Saaras captures the original speech and an English operating transcript.
Sarvam Translate localizes the seller brief, Bulbul speaks it in the seller’s
chosen language, and Samvaad handles the real-time interruptible conversation.
Cloudflare D1 stores the case. A deterministic policy engine alone controls the
commercial outcome.”

## Q&A — monetization and market

“Buyer organizations pay because they receive approval controls and an audit
trail; suppliers participate free. The Design Partner Starter is ₹5,000 per
month, followed by usage-based voice and higher tiers for telephony, approvals,
and ERP integration. Our conservative bottom-up account TAM across registered
small and medium enterprises is approximately ₹3,493 crore in annual software
revenue. We begin with construction and light-manufacturing design partners.”

See [deal rooms, pricing and monetization](./deal-room-and-monetization.md) for
the assumptions, access boundary, and source links.
