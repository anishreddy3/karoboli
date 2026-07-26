export type AuditEventKind =
  | "call.started"
  | "call.completed"
  | "decision.made"
  | "po.written"
  | "approval.requested"
  | "approval.resolved"
  | "consent.updated"
  | "campaign.created"
  | "campaign.attempt.completed";

export type AuditEvent = {
  id: string;
  tenantId: string;
  kind: AuditEventKind;
  actorId: string;
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

const PHONE_PATTERN = /\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g;

/**
 * Returns a copy of the event with phone numbers masked and transcripts truncated.
 * All string values in the payload are sanitized; numeric and boolean values are preserved.
 */
export function redactEvent(event: AuditEvent): AuditEvent {
  const redactValue = (value: unknown): unknown => {
    if (typeof value === "string") {
      const masked = value.replace(PHONE_PATTERN, "***");
      return masked.length > 200 ? masked.slice(0, 200) + "…" : masked;
    }
    if (Array.isArray(value)) return value.map(redactValue);
    if (value !== null && typeof value === "object") {
      return redactRecord(value as Record<string, unknown>);
    }
    return value;
  };

  const redactRecord = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = redactValue(val);
    }
    return result;
  };

  return {
    ...event,
    payload: redactRecord(event.payload),
  };
}

/** Converts a list of audit events to NDJSON (one JSON object per line). */
export function formatNdjson(events: AuditEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join("\n") + (events.length > 0 ? "\n" : "");
}
