import {
  caseMemorySchema,
  type CaseMemory,
  type StoredCaseMemory,
} from "@/lib/case-memory";

type D1RunResult = {
  success: boolean;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1RunResult[]>;
};

type CaseRow = {
  id: string;
  schema_version: number;
  stage: string;
  language: string;
  selected_supplier: string;
  buyer_transcript: string;
  supplier_transcript: string;
  requirement_json: string | null;
  offer_json: string | null;
  decision_json: string | null;
  purchase_order_json: string | null;
  evidence_json: string | null;
  fallback_used: number;
  created_at: string;
  updated_at: string;
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS procurement_cases (
    id TEXT PRIMARY KEY NOT NULL,
    owner_id TEXT NOT NULL,
    schema_version INTEGER DEFAULT 1 NOT NULL,
    stage TEXT DEFAULT 'brief' NOT NULL,
    language TEXT DEFAULT 'unknown' NOT NULL,
    selected_supplier TEXT NOT NULL,
    buyer_transcript TEXT DEFAULT '' NOT NULL,
    supplier_transcript TEXT DEFAULT '' NOT NULL,
    requirement_json TEXT,
    offer_json TEXT,
    decision_json TEXT,
    purchase_order_json TEXT,
    evidence_json TEXT,
    fallback_used INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )
`;

const createOwnerIndexSql = `
  CREATE INDEX IF NOT EXISTS procurement_cases_owner_updated_idx
  ON procurement_cases (owner_id, updated_at DESC)
`;

async function database(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw new Error("Cloudflare D1 memory is not configured.");
  return binding;
}

async function readyDatabase() {
  const db = await database();
  await db.batch([
    db.prepare(createTableSql),
    db.prepare(createOwnerIndexSql),
  ]);
  return db;
}

function json(value: unknown) {
  return value === null ? null : JSON.stringify(value);
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function rowToMemory(row: CaseRow): StoredCaseMemory | null {
  const parsed = caseMemorySchema.safeParse({
    schemaVersion: row.schema_version,
    stage: row.stage,
    language: row.language,
    selectedSupplier: row.selected_supplier,
    buyerTranscript: row.buyer_transcript,
    supplierTranscript: row.supplier_transcript,
    requirement: parseJson(row.requirement_json),
    offer: parseJson(row.offer_json),
    decision: parseJson(row.decision_json),
    purchaseOrder: parseJson(row.purchase_order_json),
    evidence: parseJson(row.evidence_json),
    fallbackUsed: Boolean(row.fallback_used),
  });
  if (!parsed.success) return null;

  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...parsed.data,
  };
}

export async function getCaseMemory(id: string, ownerId: string) {
  const db = await readyDatabase();
  const row = await db
    .prepare(
      `SELECT * FROM procurement_cases WHERE id = ? AND owner_id = ? LIMIT 1`,
    )
    .bind(id, ownerId)
    .first<CaseRow>();
  return row ? rowToMemory(row) : null;
}

export async function saveCaseMemory(
  id: string,
  ownerId: string,
  memory: CaseMemory,
) {
  const db = await readyDatabase();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO procurement_cases (
        id, owner_id, schema_version, stage, language, selected_supplier,
        buyer_transcript, supplier_transcript, requirement_json, offer_json,
        decision_json, purchase_order_json, evidence_json, fallback_used,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        schema_version = excluded.schema_version,
        stage = excluded.stage,
        language = excluded.language,
        selected_supplier = excluded.selected_supplier,
        buyer_transcript = excluded.buyer_transcript,
        supplier_transcript = excluded.supplier_transcript,
        requirement_json = excluded.requirement_json,
        offer_json = excluded.offer_json,
        decision_json = excluded.decision_json,
        purchase_order_json = excluded.purchase_order_json,
        evidence_json = excluded.evidence_json,
        fallback_used = excluded.fallback_used,
        updated_at = excluded.updated_at
      WHERE procurement_cases.owner_id = excluded.owner_id`,
    )
    .bind(
      id,
      ownerId,
      memory.schemaVersion,
      memory.stage,
      memory.language,
      memory.selectedSupplier,
      memory.buyerTranscript,
      memory.supplierTranscript,
      json(memory.requirement),
      json(memory.offer),
      json(memory.decision),
      json(memory.purchaseOrder),
      json(memory.evidence),
      memory.fallbackUsed ? 1 : 0,
      now,
      now,
    )
    .run();

  return getCaseMemory(id, ownerId);
}

export async function deleteCaseMemory(id: string, ownerId: string) {
  const db = await readyDatabase();
  await db
    .prepare(`DELETE FROM procurement_cases WHERE id = ? AND owner_id = ?`)
    .bind(id, ownerId)
    .run();
}
