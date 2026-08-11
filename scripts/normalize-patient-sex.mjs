// Limpieza UNICA de patient_profiles.sex a exactamente "F" / "M" (decision A, 2026-08-10).
//
// Por que: el intake antes guardaba el sexo como TEXTO LIBRE, y build-engine-input lo normalizaba con
// "empieza por f -> F, el resto -> M" (adivinaba). Ahora el intake usa un select con valores F/M y
// normalizeSex es ESTRICTA (falla en voz alta ante cualquier cosa que no sea F/M). Este script canoniza
// los perfiles viejos para que no truenen en un seguimiento.
//
// Como se corre:
//   Local:  node --env-file=.env.local scripts/normalize-patient-sex.mjs
//   Nube:   node --env-file=.env.production.local scripts/normalize-patient-sex.mjs   (Santiago)
//
// SEGURIDAD: mapa EXPLICITO. Un valor conocido (Male/Female/masculino/femenino/F/M, indiferente a
// mayusculas) se mapea; **cualquier otro se DEJA COMO ESTA y se AVISA**, no se adivina. Si aparece un
// valor ambiguo (p. ej. "mujer", que la logica vieja habria guardado MAL como M), el diagnostico sellado
// de ese paciente pudo calcularse con el sexo equivocado: NO se puede recalcular un sellado, hay que
// revisarlo a mano (marcar). Por eso el script no lo toca en silencio.

import { createClient } from "@supabase/supabase-js";

const MAP = new Map([
  ["f", "F"],
  ["female", "F"],
  ["femenino", "F"],
  ["m", "M"],
  ["male", "M"],
  ["masculino", "M"],
]);

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data, error } = await sb.from("patient_profiles").select("patient_id, sex");
if (error) {
  console.error("ERROR leyendo patient_profiles:", error.message);
  process.exit(1);
}

let yaOk = 0;
let mapeados = 0;
const desconocidos = [];
for (const p of data ?? []) {
  const raw = p.sex ?? "";
  const clean = raw.trim();
  if (clean === "F" || clean === "M") {
    yaOk++;
    continue;
  }
  const target = MAP.get(clean.toLowerCase());
  if (!target) {
    desconocidos.push({ patient_id: p.patient_id, sex: raw });
    continue;
  }
  const { error: upErr } = await sb
    .from("patient_profiles")
    .update({ sex: target })
    .eq("patient_id", p.patient_id);
  if (upErr) {
    console.error(`ERROR actualizando ${p.patient_id}:`, upErr.message);
    process.exit(1);
  }
  mapeados++;
}

console.log(`patient_profiles.sex canonizado. Ya estaban F/M: ${yaOk}. Mapeados a F/M: ${mapeados}.`);
if (desconocidos.length) {
  console.log(
    `\nATENCION: ${desconocidos.length} con valor DESCONOCIDO (no tocados, revisar a mano; su diagnostico sellado pudo salir con el sexo equivocado):`,
  );
  for (const d of desconocidos) console.log(`  ${d.patient_id} -> ${JSON.stringify(d.sex)}`);
} else {
  console.log("Sin valores desconocidos: todos quedaron en F/M.");
}
