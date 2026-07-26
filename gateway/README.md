# Karoboli Samvaad realtime gateway

This service keeps the Sarvam API key off the browser and bridges Karoboli's
WebSocket client to the documented `AsyncSamvaadAgent` runtime.

## Configure

```dotenv
SARVAM_API_KEY=
SARVAM_AGENT_ORG_ID=
SARVAM_AGENT_WORKSPACE_ID=
SARVAM_AGENT_APP_ID=
SARVAM_AGENT_VERSION=
SARVAM_AGENT_BUYER_STATE=
SARVAM_AGENT_SUPPLIER_STATE=
SAMVAAD_GATEWAY_SHARED_SECRET=
SAMVAAD_ALLOWED_ORIGINS=http://localhost:3000
KAROBOLI_TOOL_BASE_URL=http://localhost:3000
AGENT_TOOL_SHARED_SECRET=
```

The same `SAMVAAD_GATEWAY_SHARED_SECRET` must be configured in the Karoboli web
app so it can mint short-lived browser session tokens. The same
`AGENT_TOOL_SHARED_SECRET` must be configured for the web app and the tool
runtime.

## Run

```bash
cd gateway
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn karoboli_gateway.main:app --reload --port 8788
```

Configure the web app with:

```dotenv
SAMVAAD_GATEWAY_URL=ws://localhost:8788/ws/agent
SAMVAAD_GATEWAY_SHARED_SECRET=the-same-long-random-secret
AGENT_TOOL_SHARED_SECRET=another-long-random-secret
```

Copy the instructions in `agent-prompt.md` into the committed Samvaad app and
register the tool classes from `karoboli_gateway/tools.py` in Agent Studio.
