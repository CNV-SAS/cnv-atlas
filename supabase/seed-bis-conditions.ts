// Seed idempotente de las condiciones de la toma BIS (Parte 2 de captura, pestana Evaluacion).
//
// INDEPENDIENTE del seed principal (supabase/seed.ts): NO borra respuestas de encuesta ni nada
// mas. Vive aparte a proposito, para no acoplar este catalogo al seed destructivo de la encuesta
// (BACKLOG.md, "El seed principal es destructivo con las respuestas de encuesta").
//
// Como se corre:  pnpm db:seed:bis   (node --env-file=.env.local supabase/seed-bis-conditions.ts)
// Idempotente: UUIDs derivados de la clave + upsert por (version, key). Recorrerlo no duplica.
//
// La lista v1 es fiel al HTML de Gildardo (ATLAS.html L10444-10480): 8 generales + 3 femeninas.
// Divergencias documentadas (INVENTARIO.md punto 3a): embarazo agrega "mes de gestacion" (mejora
// nuestra, informativa, no altera calculos); menstruacion captura "dia del periodo"; semana_ciclo
// es numerico 1-6 siempre visible (sin Si/No). El ciclo menstrual NO alimenta el motor (registro
// clinico, verificado en INVENTARIO.md punto 4).

import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
}

// Service role: bypass RLS para sembrar el catalogo (mismo criterio que supabase/seed.ts).
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// UUID deterministico desde una clave estable (md5 -> formato v4). Asi el seed es idempotente sin
// hardcodear UUIDs a mano.
const uuidFromKey = (key: string): string => {
  const h = createHash("md5").update(`bis-condition:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const VERSION_NUMBER = 1;
const VERSION_ID = uuidFromKey(`version:${VERSION_NUMBER}`);

type FieldType = "boolean" | "number" | "text";
type Cond = {
  key: string;
  label: string;
  scope: "general" | "mujeres";
  kind: "calidad" | "contraindicacion" | "advertencia";
  inputType: FieldType;
  requiresDetail: boolean;
  detailLabel: string | null;
  detailType: FieldType | null;
};

// Orden = posicion en este arreglo (order_index = i + 1). Fiel al HTML.
const CONDS: Cond[] = [
  // ── 8 generales ──
  { key: "placas_metalicas", label: "¿Cuenta con placas metálicas?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "protesis_manos_pies", label: "¿Tiene prótesis de manos o pies?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  // Unica contraindicacion: la corriente de la BIA puede danar el dispositivo. Bloqueo DURO.
  { key: "marcapasos", label: "¿Tiene marcapasos o equipos de soporte vital?", scope: "general", kind: "contraindicacion", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "cafe_alimentos_3h", label: "¿Tomó café o alimentos hace menos de 3 horas?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "bano_previo", label: "¿Fue al baño antes de ingresar a la consulta?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "ejercicio_intenso_4h", label: "¿Hizo ejercicio intenso hace menos de 4 horas?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  { key: "diuretico", label: "¿Consume algún medicamento diurético?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "¿Cuál?", detailType: "text" },
  { key: "accesorios_metalicos_retirados", label: "¿Se retiraron los accesorios metálicos en contacto con la piel antes de la BIA?", scope: "general", kind: "calidad", inputType: "boolean", requiresDetail: false, detailLabel: null, detailType: null },
  // ── 3 femeninas (solo mujeres) ──
  // Embarazo: advertencia (NO bloquea; alerta seria + recordatorio del permiso del comite de etica).
  // "Mes de gestacion" es mejora nuestra sobre el HTML: informativa, no altera calculos.
  { key: "embarazo", label: "¿Está en embarazo?", scope: "mujeres", kind: "advertencia", inputType: "boolean", requiresDetail: true, detailLabel: "Mes de gestación", detailType: "number" },
  { key: "menstruacion", label: "¿Está menstruando?", scope: "mujeres", kind: "calidad", inputType: "boolean", requiresDetail: true, detailLabel: "Día del periodo", detailType: "number" },
  // Semana del ciclo: numero directo 1-6, siempre visible, sin Si/No. Solo registro clinico.
  { key: "semana_ciclo", label: "¿En qué semana de su ciclo se encuentra?", scope: "mujeres", kind: "calidad", inputType: "number", requiresDetail: false, detailLabel: null, detailType: null },
];

async function main() {
  // 1. Version del catalogo (activa = la de mayor published_at; en v1 hay una sola).
  const v = await supabase.from("bis_condition_versions").upsert(
    {
      id: VERSION_ID,
      version_number: VERSION_NUMBER,
      notes: "v1: lista fiel al HTML de Gildardo (ATLAS.html L10444-10480). 8 generales + 3 femeninas.",
    },
    { onConflict: "id" },
  );
  if (v.error) throw v.error;

  // 2. Las 11 condiciones (upsert por version + clave; order_index por posicion).
  const rows = CONDS.map((c, i) => ({
    id: uuidFromKey(`${VERSION_NUMBER}:${c.key}`),
    bis_condition_version_id: VERSION_ID,
    key: c.key,
    label: c.label,
    scope: c.scope,
    kind: c.kind,
    input_type: c.inputType,
    requires_detail: c.requiresDetail,
    detail_label: c.detailLabel,
    detail_type: c.detailType,
    order_index: i + 1,
  }));
  const r = await supabase
    .from("bis_conditions")
    .upsert(rows, { onConflict: "bis_condition_version_id,key" });
  if (r.error) throw r.error;

  console.log(`Sembradas ${rows.length} condiciones BIS (version ${VERSION_NUMBER}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
