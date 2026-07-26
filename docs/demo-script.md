# Three-minute demo script

## 0:00–0:25 — Business

“India's SME procurement still runs on calls and WhatsApp. A buyer speaks one
language, a supplier negotiates in another, and the final price or promise
disappears into memory. Karoboli turns that conversation into a controlled,
auditable purchase decision.”

## 0:25–0:40 — Why voice

“This is not a translated English chatbot. Procurement happens in code-mixed
speech, with pauses, revisions, spoken numbers, and implied context. That is the
interface we built for.”

## 0:40–1:15 — Buyer brief

Select Telugu. Say:

> “Naaku 200 bags 53 grade cement kavali, Whitefield site ki July 29 lopu
> delivery. Maximum budget forty one thousand rupees, payment delivery appudu.”

Show the verbatim transcript and extracted item, quantity, location, deadline,
budget, and payment term.

## 1:15–1:35 — Agent voice

Choose Sri Balaji Building Supplies and click **Hear agent brief**. Let Bulbul
v3 speak the requirement in concise supplier-facing Hinglish.

## 1:35–2:05 — Supplier correction

Say:

> “Sir total forty thousand eight hundred—nahi, correction forty thousand two
> hundred. Freight aur unloading included hai. GST bhi included. July twenty
> eighth delivery, payment on delivery.”

Pause on the visible `₹40,800 → ₹40,200` correction and commitment list.

## 2:05–2:40 — Safe action

Click **Apply guardrails**. Explain:

“The model extracts facts; it does not own the wallet. A deterministic policy
checks absolute budget, autonomy ceiling, deadline, payment terms, freight, and
unresolved facts.”

Show the decision and dynamic PO.

## 2:40–3:00 — Evidence and close

Point to the SHA-256 evidence record.

“The conversation is not the output. A verifiable business action is. Karoboli
is the procurement bridge between how India speaks and how a company safely
buys.”

## Backup

If venue connectivity or the API fails, say:

“I’ll use the disclosed fallback recording so you can inspect the same
deterministic downstream behavior. This banner makes clear it is not live.”

Then click **Use disclosed fallback**.

