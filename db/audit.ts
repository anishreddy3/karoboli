import type { AuditEvent } from "../lib/audit.ts";

const events: AuditEvent[] = [];

export function appendEvent(event: AuditEvent): void {
  events.push(event);
}

export function queryEvents(
  tenantId?: string,
  limit: number = 200,
  offset: number = 0,
): AuditEvent[] {
  const filtered = tenantId ? events.filter((e) => e.tenantId === tenantId) : events;
  return filtered
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(offset, offset + limit);
}

// For testing
export function _clearEvents(): void {
  events.length = 0;
}
