# Sarvam agent integration strategy

The current Samvaad documentation does expose integration surfaces, but they
are not shaped like a conventional synchronous `POST /agent/{id}/chat` API.
Karoboli should integrate through the documented runtime SDK, agent tools, and
deployment APIs without inventing an undocumented endpoint.

## Recommended architecture

```text
Karoboli browser
  ↕ WebSocket (PCM audio, text, events)
Karoboli realtime gateway
  ↕ sarvam-conv-ai-sdk / AsyncSamvaadAgent
Committed Samvaad app
  ↕ SarvamTool calls
Karoboli policy and evidence APIs
```

The realtime gateway can be a small Python service. It holds the Sarvam key,
creates `InteractionConfig`, starts `AsyncSamvaadAgent`, and relays browser
audio, text, audio responses, interruptions, and end events. The browser never
receives the Sarvam key.

## Integration paths

### 1. Real-time browser voice through the Python SDK

Use `AsyncSamvaadAgent` in headless mode. The browser sends raw LINEAR16 mono
audio to a Karoboli WebSocket gateway; the gateway calls `send_audio()` and
relays the SDK's text, audio, and event callbacks.

This is the preferred Milestone 2 path because it adds streaming, interruption
events, agent variables, initial language, and state control while preserving
the current browser demo.

Required provisioned values:

- Sarvam API key
- organization ID
- workspace ID
- committed app ID
- optional committed app version

### 2. Text-mode agent session as the fastest integration proof

The same SDK supports `InteractionType.CHAT`, `send_text()`, and voice notes.
Use this before the audio bridge to validate the agent prompt, state machine,
variables, transitions, and Karoboli tool calls. It is also a reliable demo
fallback if live streaming audio is unstable.

### 3. Karoboli APIs as Samvaad tools

Expose narrow, authenticated tools that the agent may call:

- `get_requirement`
- `record_supplier_commitment`
- `evaluate_offer`
- `request_human_approval`
- `finalize_evidence`

The agent can converse and decide when to call a tool, but the existing
deterministic policy engine remains the only component allowed to accept,
escalate, or reject an offer. Use an `OnStart` tool to seed the buyer brief and
an `OnEnd` tool to persist the transcript, variables, provider reference, and
interaction outcome.

### 4. Instant outbound supplier call

For a single live supplier call, use the documented instant outbound endpoint
with the committed app ID/version, connection ID, agent phone number, supplier
phone number, buyer requirement in `agent_variables`, and a Karoboli webhook.

This is preferable to building a LiveKit–Exotel bridge for the buildathon when
the Sarvam workspace already has an approved telephony connection.

### 5. Inbound deployment

If judges or suppliers should call Karoboli, create a deployment that binds a
committed agent version to a provisioned phone number and optional operating
schedule. Karoboli receives outcomes through tools, end hooks, webhooks, and
analytics rather than attempting to own the media path.

### 6. Campaigns and cohorts

For multi-supplier outreach, create a campaign with concurrency and retry
settings, upload a supplier cohort, and map each row into agent variables.
Use the campaign webhook and attempts analytics to update the procurement
comparison board.

This is the production path for parallel supplier calling. For the buildathon,
start with one instant outbound call and simulate parallelism in the UI until
the telephony tenant is verified.

### 7. Content and document capabilities

The reviewed documentation describes Samvaad applications and the Python SDK,
not separate public Content Agent or Doc Agent endpoints.

Use this order of preference:

1. If Sarvam provisions each capability as a committed app ID, call it through
   a text-mode SDK session.
2. Otherwise, implement content generation and quotation comparison as tools
   or knowledge-backed states inside the main Samvaad app.
3. If neither is provisioned by build day, retain Sarvam-30B for those supporting
   tasks and label them accurately. Do not fabricate an agent API.

## Failure-safe provider boundary

All Sarvam agent access should sit behind a Karoboli provider interface:

```text
ConversationProvider
  ├─ SamvaadSdkProvider
  ├─ SarvamComposedProvider (Saaras + Sarvam-30B + Bulbul)
  └─ FixtureProvider
```

This lets the golden path remain demoable while the event account, app IDs,
committed versions, connection IDs, and phone-number approvals are resolved.

## Documentation references

- [Samvaad agent model](https://agent-docs.azurewebsites.net/getting-started/whats-an-agent)
- [Python SDK and backend proxy pattern](https://agent-docs.azurewebsites.net/sdks/python)
- [Instant outbound call](https://agent-docs.azurewebsites.net/api-reference/instant-outbound/create-instant-outbound-call)
- [Create an inbound deployment](https://agent-docs.azurewebsites.net/api-reference/deployments/create-deployment)
- [Create a campaign](https://agent-docs.azurewebsites.net/api-reference/scheduling/campaigns/create-campaign)
- [Upload a cohort](https://agent-docs.azurewebsites.net/api-reference/scheduling/cohorts/upload-cohort)
- [Attempts analytics](https://agent-docs.azurewebsites.net/api-reference/analytics/get-attempts)

