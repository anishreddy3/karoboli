import type { Tenant } from "../lib/tenant";
import { DEFAULT_POLICY as _DEFAULT } from "../lib/tenant";

const store = new Map<string, Tenant>();

function makeDefaultTenant(id: string): Tenant {
  const now = new Date().toISOString();
  return {
    id,
    name: id,
    createdAt: now,
    policy: {
      id: `policy-${id}`,
      tenantId: id,
      ..._DEFAULT,
      updatedAt: now,
    },
  };
}

export function upsertTenant(tenant: Tenant): void {
  store.set(tenant.id, tenant);
}

export function getTenant(id: string): Tenant {
  return store.get(id) ?? makeDefaultTenant(id);
}

export function listTenants(): Tenant[] {
  return [...store.values()];
}
