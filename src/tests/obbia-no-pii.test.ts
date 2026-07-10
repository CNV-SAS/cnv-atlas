import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Candado del criterio de aceptacion de B14: obbia NO accede a PII. En vez de simular una
// sesion obbia contra la BD, se verifica la fuente de verdad de la autorizacion: las policies
// RLS. Se escanean TODAS las migraciones (forward-only), asi una concesion futura a obbia
// sobre una tabla con PII rompe el test en el punto exacto donde se introduciria la fuga.

const migrationsDir = new URL("../../drizzle/", import.meta.url);

function allMigrationSql(): string {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  return files
    .map((f) => readFileSync(new URL(f, migrationsDir), "utf8"))
    .join("\n--> statement-breakpoint\n");
}

// Extrae las tablas sobre las que alguna policy concede acceso a obbia (has_role('obbia')).
function obbiaGrantedTables(sql: string): string[] {
  const tables = new Set<string>();
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (!/create policy/i.test(statement)) continue;
    if (!/has_role\('obbia'\)/.test(statement)) continue;
    const m = statement.match(/on\s+public\.(\w+)/i);
    if (m) tables.add(m[1]);
  }
  return [...tables];
}

// Unica tabla que obbia puede tocar: data de investigacion agregada/anonimizada.
const OBBIA_ALLOWED_TABLES = new Set(["research_datasets"]);

// Tablas con PII o datos clinicos identificables: jamas deben conceder acceso a obbia.
const PII_TABLES = [
  "patients",
  "evaluations",
  "reports",
  "diagnoses",
  "treatments",
  "treatment_notes",
  "treatment_diet_guidelines",
  "survey_responses",
  "survey_answers",
  "bis_measurements",
  "bis_raw_values",
  "followups",
  "followup_metrics",
  "patient_consents",
  "survey_links",
  "clinical_audit_log",
];

describe("Obbia no accede a PII (candado B14)", () => {
  const granted = obbiaGrantedTables(allMigrationSql());

  it("el parser encuentra al menos una concesion a obbia (sanity)", () => {
    expect(granted.length).toBeGreaterThan(0);
  });

  it("obbia solo tiene policies sobre tablas permitidas (research_datasets)", () => {
    for (const table of granted) {
      expect(OBBIA_ALLOWED_TABLES.has(table), `obbia no deberia acceder a ${table}`).toBe(true);
    }
  });

  it("ninguna tabla con PII concede acceso a obbia", () => {
    for (const table of PII_TABLES) {
      expect(granted, `obbia no deberia acceder a ${table}`).not.toContain(table);
    }
  });
});
