// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CORRER LA REEMISION DEL DIAGNOSTICO  ·  ESCRIBE  ·  recalibracion_ciencia
//
// ═══ QUE HACE ═══
//
// Llama a `reemitirDiagnostico` sobre las evaluaciones que se le pasen. Por cada una: crea un diagnostico
// nuevo con el motor de hoy, un snapshot nuevo en borrador, y el rastro inline. NO toca el tratamiento ni
// el informe ya enviado (el servicio lo garantiza y su candado lo vigila).
//
// ═══ POR QUE ES UN SCRIPT APARTE Y NO UNA PANTALLA ═══
//
// Porque es una operacion de la Direccion Cientifica sobre el historico, no un acto clinico de consulta.
// El dia que haya que repetirlo (la proxima recalibracion), este es el sitio.
//
// ═══ NO CORRE SIN DOS COSAS ═══
//
//   1. `--confirmar`. Sin la bandera hace un SIMULACRO: dice que haria y no escribe. Un script que
//      escribe en registros clinicos reales por el solo hecho de arrancar es un accidente esperando.
//   2. `--actor <correo>`. El actor NO se adivina ni cae a un admin cualquiera: el rastro registra quien
//      reemitio, y una firma equivocada en un registro clinico es peor que ninguna.
//
// Y NECESITA `DATABASE_URL`, que `.env.production.local` no trae (solo lleva la URL de Supabase y la
// service role). Es deliberado que la escritura exija una credencial mas.
//
// COMO SE CORRE (simulacro primero, siempre):
//   node --env-file=.env.production.local scripts/CORRER_LA_REEMISION.ts --actor tu@correo \
//        2bd2b5a8-... 00fb3e1d-...
//   ...y cuando el simulacro se vea bien, lo mismo con --confirmar al final.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { ENGINE_VERSION } from "@/clinical-engine";
import { reemitirDiagnostico } from "@/modules/clinical-pipeline/services/reemitir-diagnostico";
import { getDiagnosisEmissionVersions } from "@/modules/diagnoses/data/results-reader";

const args = process.argv.slice(2);
const confirmar = args.includes("--confirmar");
const iActor = args.indexOf("--actor");
const correoDelActor = iActor >= 0 ? args[iActor + 1] : null;
const evaluaciones = args.filter((a) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(a));

if (!correoDelActor) {
  console.error("Falta --actor <correo>. El rastro registra quien reemitio; no se adivina.");
  process.exit(1);
}
if (evaluaciones.length === 0) {
  console.error("No se paso ninguna evaluacion (uuid completo).");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error(
    "Falta DATABASE_URL. La escritura exige esa credencial aparte, a proposito: .env.production.local\n" +
      "solo trae la URL de Supabase y la service role.",
  );
  process.exit(1);
}

const [actor] = await db
  .select({ id: profiles.id, email: profiles.email })
  .from(profiles)
  .where(eq(profiles.email, correoDelActor))
  .limit(1);
if (!actor) {
  console.error(`No encontre un perfil con el correo ${correoDelActor}.`);
  process.exit(1);
}

console.log(`\n  MOTOR DE HOY: ${ENGINE_VERSION}`);
console.log(`  ACTOR: ${actor.email}`);
console.log(`  EVALUACIONES: ${evaluaciones.length}`);
console.log(confirmar ? "  MODO: ESCRIBE\n" : "  MODO: SIMULACRO (no escribe)\n");

let hechas = 0;
let saltadas = 0;
for (const evaluationId of evaluaciones) {
  const corto = evaluationId.slice(0, 8);
  // EL ESTADO ANTES, para que el simulacro diga algo util y no solo "lo intentaria".
  const sellado = await getDiagnosisEmissionVersions(evaluationId);
  if (sellado.engineVersion == null) {
    console.log(`  ${corto}  SALTA: no tiene diagnostico`);
    saltadas++;
    continue;
  }
  if (sellado.engineVersion === ENGINE_VERSION) {
    console.log(`  ${corto}  SALTA: ya esta en ${ENGINE_VERSION}`);
    saltadas++;
    continue;
  }

  if (!confirmar) {
    console.log(`  ${corto}  reemitiria: ${sellado.engineVersion} -> ${ENGINE_VERSION}`);
    continue;
  }

  const r = await reemitirDiagnostico({
    evaluationId,
    motivo: "recalibracion_ciencia",
    actorId: actor.id,
    actorEmail: actor.email,
    ip: null,
  });
  if (!r.ok) {
    // NO SE SIGUE EN SILENCIO: un fallo a mitad de una tanda tiene que verse, y las que ya se hicieron
    // quedan hechas (cada reemision es su propia transaccion, a proposito: una tanda no es un acto).
    console.log(`  ${corto}  FALLO: ${r.error.message}`);
    saltadas++;
    continue;
  }
  console.log(
    `  ${corto}  HECHA: ${r.value.versionAnterior} -> ${r.value.versionNueva}` +
      `  ·  diagnostico ${r.value.diagnosisIdNuevo.slice(0, 8)}` +
      `  ·  informe nuevo en borrador ${r.value.reportIdNuevo.slice(0, 8)}`,
  );
  hechas++;
}

console.log(
  `\n  ${confirmar ? "hechas" : "se reemitirian"}: ${confirmar ? hechas : evaluaciones.length - saltadas}` +
    ` · saltadas: ${saltadas}`,
);
console.log(
  confirmar
    ? "\n  El tratamiento y el informe enviado NO se tocaron. Revisa en pantalla y en el informe.\n"
    : "\n  Nada se escribio. Repite con --confirmar cuando esto se vea bien.\n",
);
process.exit(0);
