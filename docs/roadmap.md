# Implementation roadmap

## Milestone 1 — Golden path

- Live microphone capture under 30 seconds.
- Saaras v3 codemix transcription.
- Sarvam-30B schema-constrained buyer and supplier fact extraction.
- Visible supplier self-correction and commitment memory.
- Deterministic guardrails.
- Dynamic PO and SHA-256 evidence record.
- Bulbul v3 supplier-facing voice.
- Honest disclosed fallback.

## Milestone 2 — Agent depth

- Replace the composed voice pipeline with the event-exclusive Sarvam Voice
  Agent session once its agent ID and access contract are available.
- Stream partial STT and TTS for interruption-friendly turns.
- Ask one targeted follow-up for missing price, deadline, freight, or tax facts.
- Run three unseen repeat cases: Telugu buyer, Tamil buyer, and English buyer;
  each with a Hinglish supplier reply.

## Milestone 3 — Supporting Sarvam agents

- Content Agent: generate a buyer approval note and supplier follow-up message
  from the verified evidence record.
- Doc Agent: ingest a supplier quotation, compare it with verbal commitments,
  and flag discrepancies before PO approval.

The exclusive agent APIs are kept behind identifiers in `.env.example`. No
undocumented endpoint is fabricated.

## Milestone 4 — Telephony

- Exotel originates the Indian PSTN call.
- A SIP trunk bridges the call into a LiveKit room.
- The Sarvam Voice Agent joins as an audio participant.
- Stream 8 kHz call audio to Saaras v3 and return low-latency Bulbul v3 audio.
- Persist call ID, consent state, transcript, commitments, and outcome.
- Escalate to a human participant when a hard policy or uncertainty boundary is
  reached.

For the buildathon, browser voice proves the intelligence without making SIP
configuration a critical dependency.

## Milestone 5 — Production procurement

- Tenant-specific policies and human approval queues.
- Verified supplier directory and consent controls.
- Parallel supplier calling with concurrency limits.
- ERP/PO integration through idempotent adapters.
- Retention, encryption, access control, redaction, and audit export.
- Usage-based billing after real call-cost measurements.

