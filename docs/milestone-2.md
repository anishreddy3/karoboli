# Milestone 2 — Agent depth

## Implementation status

The branch contains the complete credential-independent implementation:

- Python `AsyncSamvaadAgent` gateway with short-lived signed browser sessions.
- Raw LINEAR16 mono audio streaming at 16 kHz.
- Streaming agent text/audio, transcript callbacks, speech events, and
  interruption-aware playback cancellation.
- Buyer and supplier agent modes seeded through `InteractionConfig` variables.
- Optional initial language and state overrides.
- Browser provider switch between Samvaad streaming and the composed
  Saaras + Sarvam-30B + Bulbul path.
- One targeted buyer or supplier follow-up at a time.
- Follow-up answers merge into existing confirmed facts.
- Authenticated deterministic offer evaluation and evidence-finalization APIs.
- `SarvamTool`, `OnStart`, and `OnEnd` implementations plus Agent Studio
  instructions.
- Telugu, Tamil, English, supplier-uncertainty, and gateway-token tests.

## Activation values still required

The SDK rejects a session until the target app has a committed version.
Provide these values to activate live streaming:

```dotenv
SARVAM_API_KEY=
SARVAM_AGENT_API_KEY=
SARVAM_AGENT_ORG_ID=
SARVAM_AGENT_WORKSPACE_ID=
SARVAM_AGENT_APP_ID=
SARVAM_AGENT_VERSION=
SAMVAAD_GATEWAY_SHARED_SECRET=
AGENT_TOOL_SHARED_SECRET=
```

`SARVAM_AGENT_VERSION` may be omitted to use the latest committed app version.

## Acceptance rehearsal

1. Start the Karoboli web app and Python gateway.
2. Confirm the UI selects `Samvaad streaming`.
3. Run an incomplete Telugu buyer brief and verify only one follow-up is asked.
4. Answer the follow-up and verify existing facts remain unchanged.
5. Run a Hinglish supplier offer with a price correction.
6. Interrupt the agent while it speaks and verify queued audio stops.
7. Leave freight or GST unstated and verify one supplier follow-up is asked.
8. Complete the offer and verify the deterministic decision and evidence hash.
9. Stop the gateway and verify the composed provider remains usable.

Live account validation is the only remaining external acceptance step; it
cannot be completed without the provisioned organization, workspace, committed
app ID, and version.
