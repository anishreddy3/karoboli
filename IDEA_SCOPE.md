# Karoboli — Buildathon Scope

## One-line thesis

Karoboli is a voice-native procurement agent that converts multilingual Indian
buyer intent and code-mixed supplier negotiation into a safe, verifiable
purchase decision.

## Selected Sarvam judging parameter

**Primary: Voice Experience**

The handbook does not reward raw API count. Karoboli therefore optimizes for
depth on one visible voice workflow:

- natural Telugu, Tamil, Hindi/Hinglish, and English input;
- code-mixing without forcing an English-first script;
- exact numbers, dates, and commercial terms;
- explicit self-correction resolution;
- honest uncertainty and follow-up;
- concise Indian-language voice output;
- an end-to-end consequence: decision, PO, and evidence.

Content and Doc Agents remain supporting capabilities. They are added only when
they improve the live proof.

## Golden-path acceptance test

The live speaker says:

> “Total ₹40,800—nahi, correction ₹40,200. Freight, unloading aur GST
> included. July 28 delivery, payment on delivery.”

Karoboli must:

1. preserve the original transcript;
2. resolve ₹40,200 as the final amount;
3. visibly show ₹40,800 → ₹40,200 as a correction;
4. extract freight, unloading, GST, delivery, and payment commitments;
5. compare the offer with deterministic guardrails;
6. generate a PO only when the offer is not rejected;
7. bind the transcript, correction, commitments, decision, and PO into one
   evidence digest.

## Failure acceptance test

If the speaker omits freight or provides an ambiguous price, Karoboli must show
the unresolved fact and require confirmation or human approval. It must not
silently guess.

If Sarvam is unavailable, the user may retry or select a clearly labeled,
disclosed fallback case. Fallback output must never be presented as live.

## What is intentionally outside the critical path

- PSTN telephony and outbound calling;
- multi-vendor parallel calling;
- payment collection;
- production supplier discovery;
- ERP writes;
- legally binding purchase orders.

These are roadmap items, not demo dependencies.

## Build provenance

This repository and its implementation were created publicly on the event day
as a new buildathon artifact.
