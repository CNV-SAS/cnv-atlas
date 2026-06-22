// Seed deterministico de Atlas. DATABASE.md, seccion "Seed deterministico".
//
// Como se corre:  pnpm db:seed   (node --env-file=.env.local supabase/seed.ts)
// Node 24 ejecuta TypeScript de forma nativa; --env-file carga .env.local.
//
// Idempotente: usa UUIDs fijos y upsert, asi que recorrerlo no duplica. Los
// usuarios de auth se crean por la API admin (no permite fijar el id), por eso se
// resuelven por email: si ya existen, se reutilizan. El trigger handle_new_user
// materializa public.profiles leyendo organization_id y full_name del metadata.
// Todo lo demas se inserta con service role (BYPASSRLS).

import { createClient } from "@supabase/supabase-js";

// ---- Variables de entorno requeridas -------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const PROFESSIONAL_PASSWORD = process.env.SEED_PROFESSIONAL_PASSWORD;

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Falta la variable de entorno ${name} en .env.local`);
  }
  return value;
}

// ---- UUIDs fijos (determinismo) ------------------------------------------
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const ROLE_IDS = {
  admin: "22222222-0000-0000-0000-000000000001",
  direccion: "22222222-0000-0000-0000-000000000002",
  soporte: "22222222-0000-0000-0000-000000000003",
  obbia: "22222222-0000-0000-0000-000000000004",
  professional: "22222222-0000-0000-0000-000000000005",
} as const;
const PROFESSIONAL_PROFILE_ID = "33333333-3333-3333-3333-333333333333";
const MODEL_VERSION_ID = "44444444-4444-4444-4444-444444444444";
const SURVEY_TEMPLATE_ID = "55555555-5555-5555-5555-555555555551";
const SURVEY_VERSION_ID = "55555555-5555-5555-5555-555555555552";
// Preguntas placeholder, una por nivel de data_class, para que la encuesta
// renderice y se pueda probar end-to-end. Las preguntas reales llegan con Gildardo.
const SURVEY_QUESTION_IDS = {
  identifier: "55555555-5555-5555-5555-555555555561",
  quasi: "55555555-5555-5555-5555-555555555562",
  clinical: "55555555-5555-5555-5555-555555555563",
} as const;
const SURVEY_OPTION_IDS = [
  "55555555-5555-5555-5555-555555555571",
  "55555555-5555-5555-5555-555555555572",
] as const;
const DEVICE_IDS = ["66666666-6666-6666-6666-666666666601", "66666666-6666-6666-6666-666666666602"];
const NUTRA_IDS = ["77777777-7777-7777-7777-777777777701", "77777777-7777-7777-7777-777777777702"];
const INVENTORY_IDS = ["88888888-8888-8888-8888-888888888801", "88888888-8888-8888-8888-888888888802"];
const PATIENT_ID = "99999999-9999-9999-9999-999999999901";
const PATIENT_PROF_REL_ID = "99999999-9999-9999-9999-999999999902";
// Link de encuesta inicial (reusable) del profesional demo, para smoke del intake.
// El token es fijo y claramente de prueba: /encuesta/<token>.
const SURVEY_LINK_ID = "99999999-9999-9999-9999-999999999903";
const SURVEY_LINK_TOKEN = "demo-encuesta-inicial-0001";

// ---- Identidad de los usuarios sembrados ---------------------------------
const ADMIN_EMAIL = "sau.idk001@gmail.com";
const ADMIN_NAME = "Santiago Arroyave";
const PROFESSIONAL_EMAIL = "profesional.demo@cnvsystem.com";
const PROFESSIONAL_NAME = "Profesional Demo";

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD", ADMIN_PASSWORD);
  const professionalPassword = requireEnv("SEED_PROFESSIONAL_PASSWORD", PROFESSIONAL_PASSWORD);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Falla ruidosamente ante cualquier error de escritura.
  function check(label: string, error: { message: string } | null) {
    if (error) throw new Error(`${label}: ${error.message}`);
  }

  // Crea el usuario de auth o reutiliza el existente (resuelto por email).
  async function ensureUser(email: string, password: string, fullName: string): Promise<string> {
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    check("listUsers", list.error);
    const existing = list.data.users.find((u) => u.email === email);
    if (existing) return existing.id;

    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { organization_id: ORG_ID, full_name: fullName },
    });
    check(`createUser ${email}`, created.error);
    return created.data.user!.id;
  }

  // 1. Organizacion (debe existir antes de crear usuarios: el trigger la referencia).
  check(
    "organizations",
    (
      await supabase
        .from("organizations")
        .upsert({ id: ORG_ID, name: "Connected Nutrition Ventures", type: "unidad CNV", country: "Colombia", city: "Medellin" }, { onConflict: "id" })
    ).error,
  );

  // 2. Los 5 roles.
  check(
    "roles",
    (
      await supabase.from("roles").upsert(
        [
          { id: ROLE_IDS.admin, name: "admin", description: "Administrador CNV" },
          { id: ROLE_IDS.direccion, name: "direccion", description: "Direccion CNV" },
          { id: ROLE_IDS.soporte, name: "soporte", description: "Soporte operativo" },
          { id: ROLE_IDS.obbia, name: "obbia", description: "Observatorio / investigacion" },
          { id: ROLE_IDS.professional, name: "professional", description: "Profesional de salud" },
        ],
        { onConflict: "id" },
      )
    ).error,
  );

  // 3. Admin: auth user (el trigger crea el profile) + rol admin.
  const adminId = await ensureUser(ADMIN_EMAIL, adminPassword, ADMIN_NAME);
  check(
    "user_roles admin",
    (await supabase.from("user_roles").upsert({ user_id: adminId, role_id: ROLE_IDS.admin }, { onConflict: "user_id,role_id" })).error,
  );

  // 4. Profesional de prueba: auth user + professional_profile + rol professional.
  const professionalId = await ensureUser(PROFESSIONAL_EMAIL, professionalPassword, PROFESSIONAL_NAME);
  check(
    "professional_profiles",
    (
      await supabase.from("professional_profiles").upsert(
        { id: PROFESSIONAL_PROFILE_ID, profile_id: professionalId, license: "DEMO-0001", specialty: "Nutricion", certification_status: "habilitado", commission_rate: "0.20" },
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "user_roles professional",
    (await supabase.from("user_roles").upsert({ user_id: professionalId, role_id: ROLE_IDS.professional }, { onConflict: "user_id,role_id" })).error,
  );

  // 5. model_version placeholder en estado active (contenido clinico congelado).
  check(
    "model_versions",
    (
      await supabase.from("model_versions").upsert(
        { id: MODEL_VERSION_ID, version_name: "ANI-BIS-E placeholder", rules_version: "placeholder", description: "Placeholder; el contenido real se carga al entregar Gildardo (B11).", status: "active" },
        { onConflict: "id" },
      )
    ).error,
  );

  // 5bis. indicator_definitions placeholder bajo el model_version activo. Andamiaje
  // ESTRUCTURAL para B9 (la propagacion del stub persiste indicator_values, que exige
  // este FK); los nombres/rangos clinicos reales se cargan en B11 (congelado). Los
  // codigos son los del contrato del motor (clinical-engine INDICATOR_CODES). Upsert
  // por la unique (model_version_id, code), sin id fijo: el pipeline los resuelve por
  // codigo en runtime.
  const INDICATOR_CODES = [
    "IFC", "IRC", "PABU", "ICA-BIS", "ISCM", "IEHH", "IAE", "EB", "FMI", "FFMI", "AF", "IR",
  ];
  check(
    "indicator_definitions",
    (
      await supabase.from("indicator_definitions").upsert(
        INDICATOR_CODES.map((code) => ({
          model_version_id: MODEL_VERSION_ID,
          code,
          name: `${code} (placeholder)`,
          description: "Placeholder estructural; nombre y rangos reales en B11.",
        })),
        { onConflict: "model_version_id,code" },
      )
    ).error,
  );

  // 6. survey_template + survey_version con estructura placeholder.
  check(
    "survey_templates",
    (await supabase.from("survey_templates").upsert({ id: SURVEY_TEMPLATE_ID, name: "Encuesta ANI-BIS-E (placeholder)", description: "Estructura placeholder; preguntas reales al entregar Gildardo." }, { onConflict: "id" })).error,
  );
  check(
    "survey_versions",
    (await supabase.from("survey_versions").upsert({ id: SURVEY_VERSION_ID, template_id: SURVEY_TEMPLATE_ID, version_number: 1 }, { onConflict: "id" })).error,
  );
  // 3 preguntas placeholder (una por data_class). Contenido y scoring reales al
  // entregar Gildardo (congelado). Solo dan forma para probar el flujo del intake.
  check(
    "survey_questions",
    (
      await supabase.from("survey_questions").upsert(
        [
          { id: SURVEY_QUESTION_IDS.identifier, survey_version_id: SURVEY_VERSION_ID, question_text: "Pregunta placeholder (identificador)", question_type: "texto", order_index: 1, data_class: "identifier" },
          { id: SURVEY_QUESTION_IDS.quasi, survey_version_id: SURVEY_VERSION_ID, question_text: "Pregunta placeholder (cuasi-identificador)", question_type: "opcion", order_index: 2, data_class: "quasi_identifier" },
          { id: SURVEY_QUESTION_IDS.clinical, survey_version_id: SURVEY_VERSION_ID, question_text: "Pregunta placeholder (clinica)", question_type: "texto", order_index: 3, data_class: "clinical" },
        ],
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "survey_options",
    (
      await supabase.from("survey_options").upsert(
        [
          { id: SURVEY_OPTION_IDS[0], question_id: SURVEY_QUESTION_IDS.quasi, option_text: "Opcion A", value: "1", order_index: 1 },
          { id: SURVEY_OPTION_IDS[1], question_id: SURVEY_QUESTION_IDS.quasi, option_text: "Opcion B", value: "2", order_index: 2 },
        ],
        { onConflict: "id" },
      )
    ).error,
  );

  // 7. 2 devices en estados distintos.
  check(
    "devices",
    (
      await supabase.from("devices").upsert(
        [
          { id: DEVICE_IDS[0], organization_id: ORG_ID, asset_code: "CNV-BIS-0001", manufacturer_serial: "SN-DEMO-0001", system_email: "biody+0001@cnvsystem.com", brand: "Aminogram", model: "Biody B.I.S ZM", supplier: "Aminogram", status: "available" },
          { id: DEVICE_IDS[1], organization_id: ORG_ID, asset_code: "CNV-BIS-0002", manufacturer_serial: "SN-DEMO-0002", system_email: "biody+0002@cnvsystem.com", brand: "Aminogram", model: "Biody B.I.S ZM", supplier: "Aminogram", status: "in_use" },
        ],
        { onConflict: "id" },
      )
    ).error,
  );

  // 8. 2 nutraceuticos con inventario.
  check(
    "nutraceuticals",
    (
      await supabase.from("nutraceuticals").upsert(
        [
          { id: NUTRA_IDS[0], organization_id: ORG_ID, name: "Nutraceutico Demo A", description: "Placeholder", unit: "capsula", unit_price: "50000" },
          { id: NUTRA_IDS[1], organization_id: ORG_ID, name: "Nutraceutico Demo B", description: "Placeholder", unit: "sobre", unit_price: "75000" },
        ],
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "nutraceutical_inventory",
    (
      await supabase.from("nutraceutical_inventory").upsert(
        [
          { id: INVENTORY_IDS[0], nutraceutical_id: NUTRA_IDS[0], stock_quantity: 100 },
          { id: INVENTORY_IDS[1], nutraceutical_id: NUTRA_IDS[1], stock_quantity: 60 },
        ],
        { onConflict: "id" },
      )
    ).error,
  );

  // 9. Paciente demo + relacion con el profesional de prueba. Habilita el smoke de
  // pagos (B6: el admin crea el checkout y la comision se sella al profesional
  // asignado) y futuras demos. Documento claramente ficticio.
  check(
    "patients",
    (
      await supabase.from("patients").upsert(
        { id: PATIENT_ID, organization_id: ORG_ID, document_type: "CC", document_number: "DEMO-0001" },
        { onConflict: "id" },
      )
    ).error,
  );
  check(
    "patient_professional_relationships",
    (
      await supabase.from("patient_professional_relationships").upsert(
        { id: PATIENT_PROF_REL_ID, patient_id: PATIENT_ID, professional_id: PROFESSIONAL_PROFILE_ID },
        { onConflict: "id" },
      )
    ).error,
  );

  // 10. Link de encuesta inicial (reusable) del profesional demo.
  check(
    "survey_links",
    (
      await supabase.from("survey_links").upsert(
        {
          id: SURVEY_LINK_ID,
          organization_id: ORG_ID,
          professional_id: PROFESSIONAL_PROFILE_ID,
          type: "inicial",
          token: SURVEY_LINK_TOKEN,
        },
        { onConflict: "id" },
      )
    ).error,
  );

  console.log("Seed completo:");
  console.log(`  organizacion: ${ORG_ID}`);
  console.log(`  admin:        ${ADMIN_EMAIL} (${adminId})`);
  console.log(`  profesional:  ${PROFESSIONAL_EMAIL} (${professionalId})`);
  console.log(`  model_version active (12 indicator_definitions placeholder), survey v1 (3 preguntas placeholder), 2 devices, 2 nutraceuticos`);
  console.log(`  paciente demo: CC DEMO-0001 (${PATIENT_ID}) vinculado al profesional`);
  console.log(`  link de encuesta inicial: /encuesta/${SURVEY_LINK_TOKEN}`);
}

main().catch((err) => {
  console.error("Seed fallido:", err instanceof Error ? err.message : err);
  process.exit(1);
});
