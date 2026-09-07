// Reseed DIRIGIDO de indicator_definitions (y nada mas).
//
// Como se corre:
//   Local:  node --env-file=.env.local            scripts/reseed-indicator-defs.mjs
//   Nube:   node --env-file=.env.production.local scripts/reseed-indicator-defs.mjs   (Santiago)
//
// SIN MIGRACION, y a diferencia del catalogo de condiciones BIS esto NO se puede generar igual: aqui no
// hay tabla de versiones propia. Las definiciones cuelgan de un `model_version_id` fijo y se actualizan
// EN SITIO por `(model_version_id, code)`, asi que desplegar un cambio de nombre exige un UPDATE, no un
// INSERT aditivo. Un generador como el de la encuesta o el de las condiciones no sirve para esta forma.
// Verificado el 2026-09-07 que hoy NO hay desincronizacion: los doce indicadores coinciden en local, en
// la nube y con el registry del repositorio. Es riesgo latente, no divergencia viva. Anotado en BACKLOG.
//
// Por que existe: `pnpm db:seed` (el seed completo) BORRA y re-siembra las respuestas de
// encuesta (survey_answers/responses de la version, ver supabase/seed.ts L482-489). Correr el
// seed entero para actualizar un nombre de indicador costaria los casos de un smoke ya armado.
// Este script hace SOLO el upsert de indicator_definitions (por model_version_id,code), sin
// ningun delete, leyendo el JSON materializado que ya usa el seed. Es idempotente y seguro:
// no toca encuesta, ni referrals, ni inventario, ni la cadena clinica.
//
// El model_version_id es el mismo UUID fijo del seed (supabase/seed.ts). Si algun dia hay mas
// de una version de modelo, este script actualiza la sembrada por el seed (la activa demo).

import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { anunciarBase } from "./lib/base-anunciada.mjs";

// Mismo UUID fijo que supabase/seed.ts (MODEL_VERSION_ID).
const MODEL_VERSION_ID = "44444444-4444-4444-4444-444444444444";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(name, value) {
  if (!value || value.trim() === "") {
    throw new Error(`Falta la variable de entorno ${name} en .env.local`);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);

  // Mismo JSON que lee el seed: registry derivado de la ciencia congelada (registry-data.test.ts
  // guarda que no se desincronice del generador). Se toma solo el bloque de indicadores.
  const registry = JSON.parse(
    readFileSync(
      new URL("../src/clinical-engine/registry-data.generated.json", import.meta.url),
      "utf8",
    ),
  );

  // ANTES DE ESCRIBIR NADA: contra que base. Ver scripts/lib/base-anunciada.mjs.
  const host = anunciarBase(url, "Reseed dirigido de indicator_definitions (upsert por code, sin borrar).");

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = registry.indicators.map((d) => ({
    model_version_id: MODEL_VERSION_ID,
    code: d.code,
    name: d.name,
    unit: d.unit,
  }));

  // `.select()` para que el numero salga de lo que la BASE acepto y no del arreglo que mandamos, que
  // es la misma correccion que el seed de condiciones.
  const { data, error } = await supabase
    .from("indicator_definitions")
    .upsert(rows, { onConflict: "model_version_id,code" })
    .select("code");
  if (error) throw new Error(`indicator_definitions: ${error.message}`);

  const escritos = data?.length ?? 0;
  if (escritos !== rows.length) {
    throw new Error(`se mandaron ${rows.length} indicadores y la base acepto ${escritos}`);
  }
  console.log(`indicator_definitions actualizado en ${host} (${escritos} indicadores, upsert por code, sin borrar nada).`);
  for (const r of rows) console.log(`  ${r.code} -> ${r.name}`);
}

main().catch((err) => {
  console.error("Reseed dirigido fallido:", err instanceof Error ? err.message : err);
  process.exit(1);
});
