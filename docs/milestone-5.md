# Milestone 5 — Production Procurement

## Implementation status

The branch `codex/milestone-5-production-procurement` adds multi-tenant production infrastructure, a human approval queue, a verified supplier directory with consent tracking, parallel supplier outreach campaigns, idempotent ERP adapters, and a redacted audit log.

### What was implemented

- **Tenants (`lib/tenant.ts`, `db/tenants.ts`, `api/tenants/[id]/policy/route.ts`)**: Supports overriding global policy (autonomous budget ceiling, required freight terms) per tenant.
- **Supplier Directory & Consent (`lib/supplier-directory.ts`, `db/suppliers.ts`, `api/suppliers/...`)**: Stores vetted suppliers and manages explicit consent (`pending`, `given`, `revoked`) for outbound calling.
- **Human Approval Queue (`db/approval-queue.ts`, `api/approval-queue/...`)**: When policy decides `human-approval` (e.g. over autonomous ceiling), decisions enter this queue instead of being auto-rejected or placed autonomously.
- **Outreach Campaigns (`lib/campaign.ts`, `lib/sarvam-campaign.ts`, `api/campaigns/...`)**: Support for creating a campaign and uploading a cohort of suppliers. The webhook tracks `connected`, `converted`, `failed` outcomes and automatically evaluates if a human approval is needed for the result.
- **Idempotent ERP Adapter (`lib/erp-adapter.ts`, `api/erp/po/route.ts`)**: Standardised way to write the final Purchase Order to an upstream ERP or system of record, keyed by PO ID.
- **Audit Logs (`lib/audit.ts`, `db/audit.ts`, `api/audit/export/route.ts`)**: Captures events like `campaign.created`, `approval.resolved`, `po.written`. Includes a redaction utility to mask phone numbers and an NDJSON export endpoint.

## Required environment variables

```dotenv
# Milestone 5 — Production Procurement
KAROBOLI_TENANT_ID=default
KAROBOLI_ERP_ADAPTER_URL=          # e.g., https://erp.internal/api/v1
KAROBOLI_ERP_ADAPTER_SECRET=       # Bearer token for ERP adapter
```

## Acceptance test steps

1. `npm run test:milestone5` validates all domain logic:
   - Tenant policy overrides work.
   - Approval queue tracks pending items and resolutions.
   - Supplier consent can be updated.
   - Campaign analytics correctly sum converted/failed/connected stats.
   - Audit event redaction correctly masks phone numbers.
2. The UI for Karoboli handles the "human-approval" flag by showing a banner (from M4). M5 adds the backend queueing system so procurement managers can review these items.
3. You can fetch `/api/audit/export` to see the NDJSON redacted log of actions.
