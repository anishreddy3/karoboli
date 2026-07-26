# Milestone 4 — Telephony

## Implementation status

The branch `codex/milestone-4-telephony` adds voice-native procurement over real phone calls using Sarvam's instant outbound API.

### What was implemented

- **`lib/telephony.ts`** — `CallRecord`, `ConsentState`, and `OutboundCallRequest` types.
- **`lib/sarvam-telephony.ts`** — `triggerInstantOutbound` and `createInboundDeployment` wrappers around the Sarvam instant-outbound and deployment APIs.
- **`db/telephony.ts`** — In-memory call record store with `upsertCall`, `getCall`, `listCalls`.
- **API routes**:
  - `POST /api/telephony/outbound` — triggers an instant outbound call and creates a call record.
  - `POST /api/telephony/inbound` — creates an inbound deployment binding a phone number to the committed agent version.
  - `POST /api/telephony/webhook` — receives call outcome events from Sarvam, updates call record; validates HMAC-SHA256 signature when secret is configured.
  - `GET /api/telephony/calls` — lists all persisted call records.
  - `GET /api/telephony/calls/:id` — fetches a single call record.
- **Capabilities route** — extended with `telephonyConfigured` and `samvaadRealtime` flags.
- **UI** — "📞 Call supplier" button appears in Step 2 when telephony is configured. Live call status badge polls every 3 s. Human-approval escalation banner appears on Step 3 when policy requires human sign-off.
- **CSS** — `.call-status-badge`, `.escalation-flag`, `.human-approval-banner` added.

## Required environment variables

```dotenv
# Milestone 4 — Telephony
SARVAM_TELEPHONY_CONNECTION_ID=   # Provisioned connection ID in your Sarvam workspace
SARVAM_TELEPHONY_AGENT_NUMBER=    # Agent phone number assigned by Sarvam
SARVAM_TELEPHONY_WEBHOOK_SECRET=  # Optional HMAC secret for webhook signature verification
```

The following must also be set (already in use by Milestone 2):
```dotenv
SARVAM_AGENT_APP_ID=
SARVAM_AGENT_VERSION=
```

## Caveats on Sarvam telephony API endpoints

The exact API paths for instant outbound (`/api/agents/instant-outbound`) and inbound deployments (`/api/agents/deployments`) are based on the patterns described in [sarvam-agent-integration.md](./sarvam-agent-integration.md) and the Sarvam documentation links therein. If the provisioned API differs, update the paths in `lib/sarvam-telephony.ts`. The implementation is intentionally structured behind a single module to make this easy.

## Acceptance test steps

1. Set `SARVAM_TELEPHONY_CONNECTION_ID` and `SARVAM_TELEPHONY_AGENT_NUMBER` in `.env.local`.
2. Start the app (`npm run dev`). The "Call supplier" button should appear in Step 2.
3. Capture a complete buyer brief (Step 1). Select a supplier.
4. Click "📞 Call supplier". The status badge should show "Dialling…".
5. The Sarvam agent calls the supplier. When the call ends, the webhook receives the outcome and the badge updates to "✓ Call completed" or "✗ Call failed".
6. If the offer exceeds the autonomous ceiling, the decision page shows the human-approval escalation banner.
7. Without telephony env vars, the button is hidden; the rest of the app works as before.
