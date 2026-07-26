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

Status: implemented on `codex/milestone-2-agent-depth`; live account validation
awaits the provisioned organization, workspace, and committed Samvaad app ID.

- Add a Python realtime gateway using the documented
  `sarvam-conv-ai-sdk` and `AsyncSamvaadAgent`.
- Connect the browser to that gateway for streamed PCM audio, text, and events.
- Keep the composed Saaras + Sarvam-30B + Bulbul provider as a fallback.
- Stream partial STT and TTS for interruption-friendly turns.
- Ask one targeted follow-up for missing price, deadline, freight, or tax facts.
- Expose deterministic Karoboli functions as authenticated Samvaad tools.
- Run three unseen repeat cases: Telugu buyer, Tamil buyer, and English buyer;
  each with a Hinglish supplier reply.

## Milestone 3 — Supporting Sarvam agents

- First try separately provisioned Content and Doc app IDs through text-mode SDK
  sessions.
- Otherwise implement approval-note generation, supplier follow-up, quotation
  comparison, and discrepancy detection as tools or knowledge-backed states
  inside the main Samvaad app.
- Keep supporting Sarvam-30B implementations available behind the same provider
  interface and disclose which provider produced each artifact.

No undocumented agent endpoint will be fabricated.

## Milestone 4 — Telephony

- Preferred: use Sarvam's instant outbound API with a provisioned connection,
  agent phone number, committed app ID/version, agent variables, and webhook.
- Add an inbound deployment when a provisioned number is available.
- Retain Exotel → SIP → LiveKit as an alternative only if direct Sarvam
  telephony access is unavailable.
- Persist call ID, consent state, transcript, commitments, and outcome.
- Escalate to a human participant when a hard policy or uncertainty boundary is
  reached.

For the buildathon, browser voice proves the intelligence without making SIP
configuration a critical dependency.

## Milestone 5 — Production procurement

- Tenant-specific policies and human approval queues.
- Verified supplier directory and consent controls.
- Sarvam campaigns and cohorts for scheduled or parallel supplier calling,
  with concurrency, retry policy, webhooks, and attempts analytics.
- ERP/PO integration through idempotent adapters.
- Retention, encryption, access control, redaction, and audit export.
- Usage-based billing after real call-cost measurements.

## Milestone branches

Each branch starts from the stable Milestone 1 release. Rebase the next branch
onto the previous completed milestone before implementation begins.

- `codex/milestone-2-agent-depth`
- `codex/milestone-3-supporting-agents`
- `codex/milestone-4-telephony`
- `codex/milestone-5-production-procurement`

See [the Sarvam agent integration strategy](./sarvam-agent-integration.md) for
the provider options, required account values, and fallback architecture.
