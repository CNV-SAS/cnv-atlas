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

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

// Datos del model-registry DERIVADOS de la ciencia congelada, generados por
// registry-data.ts (canonico, testeado) y materializados en un JSON committeado. El
// seed lo LEE con fs (no importa modulos TS de src/: node no resuelve sus imports sin
// extension). registry-data.test.ts guarda que el JSON no se desincronice del generador.
type RegistryData = {
  indicators: { code: string; name: string; unit: string | null }[];
  phenotypes: { code: string; name: string }[];
  frSectors: { code: string; name: string }[];
  efrStates: {
    stateNumber: number;
    ifcBand: number;
    ircBand: number;
    ffmiBand: number;
    fmiBand: number;
    key: string;
    diagnosisName: string;
    mechanism: string;
    biomarkers: string;
    risks: string;
    suggestedNutraceuticals: string;
  }[];
};
const registry: RegistryData = JSON.parse(
  readFileSync(
    new URL("../src/clinical-engine/registry-data.generated.json", import.meta.url),
    "utf8",
  ),
);

// Texto canonico del prompt de menu (fuente unica; el mismo JSON que consume el builder del
// prompt en la app). Se siembra como ai_prompts menu.generate v1.
const menuSystemPrompt: string = JSON.parse(
  readFileSync(
    new URL("../src/modules/treatment/ai/prompts/menu.system.v1.json", import.meta.url),
    "utf8",
  ),
).system;

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
// UUID deterministico para las filas de la encuesta: mismo (tipo, clave) -> mismo id,
// asi el seed es idempotente sin transcribir a mano ~240 UUIDs. Formato v5-like valido
// para la columna uuid (el motor no usa estos ids; resuelve por field_key/option_text).
function surveyUuid(...parts: string[]): string {
  const h = createHash("sha1").update("atlas-survey-v1:" + parts.join(":")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
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
// Usuarios internos de prueba para el flujo de grants (soporte solicita, admin/direccion
// aprueban). Su password reusa por defecto la del profesional (sin nueva config).
const SOPORTE_EMAIL = "soporte.demo@cnvsystem.com";
const SOPORTE_NAME = "Soporte Demo";
const DIRECCION_EMAIL = "direccion.demo@cnvsystem.com";
const DIRECCION_NAME = "Direccion Demo";

// ---- Contenido REAL de la encuesta ANI-BIS-E -----------------------------
// Portado VERBATIM de reference/ATLAS-Patients_v7.html (prototipo final de Gildardo).
// field_key (engine:true) = d-field que lee el motor congelado (calcLE8 /
// computeDFIFromData en clinical-engine/frozen/engine.dfi.js). Sus option_text deben
// coincidir CARACTER por caracter, incluidos los guiones cortos "-" (en-dash, dato de
// Gildardo, no em-dash prohibido), o el LE8/DFI fallan en silencio (GILDARDO_QUERIES.md
// Q3). El resto es el instrumento clinico completo (field_key null). Los guiones largos
// de las etiquetas D1 se normalizaron a parentesis (CLAUDE.md prohibe em-dash en copy);
// ninguna OPCION lleva em-dash. Nota (Q3): la encuesta no recolecta d1_9/d1_10/d1_16,
// asi que los dominios Alimentacion e Hidratacion del LE8 corren degradados, igual que
// en el prototipo. No se inventa mapeo alguno.
type SurveyQ = {
  key: string; // clave del prototipo (d5_39, d1_1_i, d7_agua...)
  // opcion/opcion_multiple = pills; contador = +/- (cantidades); escala = slider 1-10.
  // El intake (B7.1) renderiza el widget segun este tipo; el motor no lo usa.
  type: "opcion" | "opcion_multiple" | "contador" | "escala";
  text: string;
  options?: string[];
  engine?: boolean; // el motor lo lee -> field_key = key
};

// Dominio (D1-D8) por prefijo del d-field, para agrupar visualmente el intake (B7.1).
// Etiquetas orientadas al paciente, sin jerga (nada de "LE8"), tuteo, sin em-dash.
const SECTION_LABELS: Record<string, string> = {
  d1: "Alimentación",
  d2: "Percepción corporal",
  d3: "Hábitos",
  d4: "Conductas alimentarias",
  d5: "Antecedentes y estilo de vida",
  d6: "Alergias y digestión",
  d7: "Hidratación",
  d8: "Contexto social",
};
// Deriva la seccion del d-field (d1_1_i, d1f_sal_i, d7_agua -> d1/d1/d7).
function sectionFor(key: string): string {
  const m = /^d(\d)/.exec(key);
  return m ? (SECTION_LABELS[`d${m[1]}`] ?? "Otras") : "Otras";
}

// Escala de frecuencia de consumo (D1, indice 0-4 en el prototipo).
const FREQ_OPC = ["Nunca", "1–2 días", "3–4 días", "5–6 días", "Todos los días"];
// Severidad de sintomas digestivos (D6, items 45-51).
const GI_OPC = ["Nunca", "A veces", "Frecuente", "Siempre"];

const SURVEY_QUESTIONS: SurveyQ[] = [
  // D1 · Patron alimentario (frecuencia de consumo)
  { key: "d1_1_i", type: "opcion", text: "Verduras y hortalizas (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_2_i", type: "opcion", text: "Frutas enteras (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_3_i", type: "opcion", text: "Leguminosas (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_4_i", type: "opcion", text: "Pescado y mariscos (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_5_i", type: "opcion", text: "Grasas saludables (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_6_i", type: "opcion", text: "Lácteos bajos en grasa / fermentados (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_7_i", type: "opcion", text: "Huevos (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_8_i", type: "opcion", text: "Cereales integrales (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_9_i", type: "opcion", text: "Tubérculos y raíces (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_10_i", type: "opcion", text: "Carnes magras (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_11_i", type: "opcion", text: "Cereales refinados y harinas (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_12_i", type: "opcion", text: "Carnes rojas y procesadas (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_13_i", type: "opcion", text: "Azúcares y dulces (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1_14_i", type: "opcion", text: "Comida ultraprocesada (frecuencia de consumo)", options: FREQ_OPC },
  { key: "d1f_sal_i", type: "opcion", text: "¿Con qué frecuencia añade sal extra a la comida ya servida?", options: ["Nunca", "Rara vez", "Con frecuencia", "Siempre"] },
  { key: "d1f_des_i", type: "opcion", text: "¿Desayuna regularmente (antes de las 10 am)?", options: ["Sí, todos los días", "A veces (3–4 días)", "Rara vez o nunca"] },
  { key: "d1f_noche_i", type: "opcion", text: "¿A qué hora suele cenar?", options: ["Antes de las 7 pm", "Entre 7 y 8 pm", "Entre 8 y 9 pm", "Después de las 9 pm"] },
  // D2 · Percepcion corporal
  { key: "d2_19", type: "opcion", text: "¿Cómo percibe su cuerpo actualmente?", options: ["Muy delgado/a", "Delgado/a", "Normal", "Sobrepeso", "Obesidad"], engine: true },
  { key: "d2_20", type: "opcion", text: "¿Qué tan satisfecho/a está con su peso?", options: ["Muy insatisfecho/a", "Insatisfecho/a", "Neutral", "Satisfecho/a"], engine: true },
  { key: "d2_21", type: "opcion_multiple", text: "¿Qué métodos ha usado para cambiar su peso?", options: ["Dieta propia", "Profesional de salud", "Ayunos", "Saltar comidas", "Laxantes", "Vómito", "Ejercicio excesivo", "Ninguno"], engine: true },
  { key: "d2_22", type: "opcion", text: "¿Con qué frecuencia pierde el control al comer?", options: ["Nunca", "Rara vez", "A veces", "Frecuentemente", "Siempre"], engine: true },
  // D3 · Habitos
  { key: "d3_23", type: "opcion", text: "¿Cuántos días/semana hace actividad física (≥30 min)?", options: ["0", "1", "2", "3", "4", "5", "6", "7"], engine: true },
  { key: "d3_24", type: "opcion", text: "¿Cuánto dura cada sesión?", options: ["Menos de 15", "15–30 min", "30–45 min", "45–60 min", "Más de 60 min"], engine: true },
  { key: "d3_25", type: "opcion_multiple", text: "¿Qué tipo de actividad realiza?", options: ["Caminata", "Trote", "Bicicleta", "Pesas / gimnasio", "Yoga / pilates", "Deporte en equipo", "Ninguna"] },
  { key: "d3_26", type: "opcion", text: "¿Cuántas horas duerme por noche?", options: ["Menos de 5h", "5–6 horas", "6–7 horas", "7–8 horas", "Más de 8h"], engine: true },
  { key: "d3_27", type: "opcion", text: "¿Cómo califica la calidad de su sueño?", options: ["Muy mala", "Mala", "Regular", "Buena", "Muy buena"] },
  { key: "d3_28", type: "opcion", text: "¿Ronca durante el sueño?", options: ["No", "A veces", "Frecuentemente"] },
  { key: "d3_29", type: "escala", text: "Nivel de estrés en el último mes (1 = sin estrés, 10 = máximo)" },
  { key: "d3_30", type: "opcion", text: "¿Su relación con el tabaco / nicotina?", options: ["Nunca he fumado", "Dejé hace 5 años o más", "Dejé hace menos de 5 años", "Fumo ocasionalmente", "Fumo diariamente", "Solo vapeo", "Exposición pasiva"], engine: true },
  // Alcohol: registro clinico, NO alimenta el motor (Q6, resuelto por Gildardo 2026-07-21: calcLE8
  // lo leia en una variable muerta). Sin field_key para que no viaje al LE8; efecto cero en el
  // diagnostico. La pregunta sigue en la encuesta como registro.
  { key: "d3_31", type: "opcion", text: "¿Con qué frecuencia consume alcohol?", options: ["Nunca", "1–2 veces al mes", "1–2 veces a la semana", "Todos los días"] },
  // D4 · Conductas alimentarias
  { key: "d4_32", type: "opcion", text: "¿Cuántas comidas hace al día?", options: ["1 comida", "2 comidas", "3 comidas", "4 o más comidas"] },
  { key: "d4_33", type: "opcion", text: "¿Desayuna regularmente?", options: ["Nunca", "Rara vez", "A veces", "Casi siempre", "Siempre"] },
  { key: "d4_34", type: "opcion_multiple", text: "¿Sigue algún patrón alimentario?", options: ["Ninguno", "Vegetariano", "Vegano", "Keto / bajo en carbohidratos", "Sin gluten", "Sin lácteos", "Bajo en sal"] },
  { key: "d4_35", type: "opcion_multiple", text: "¿Qué suplementos toma actualmente?", options: ["Ninguno", "Multivitamínico", "Vitamina D", "Omega-3", "Proteína en polvo", "Hierro", "Magnesio", "Probióticos"] },
  // D5 · Epigenetico / LE8
  { key: "d5_36", type: "opcion", text: "¿Le han diagnosticado hipertensión arterial?", options: ["Sí", "No", "No sé"], engine: true },
  { key: "d5_37", type: "opcion", text: "¿Toma medicamentos para la presión arterial?", options: ["Sí", "No"] },
  { key: "d5_38", type: "opcion_multiple", text: "¿Familiares cercanos con estas enfermedades?", options: ["DM2 (diabetes)", "HTA (presión alta)", "Obesidad", "Infarto / ACV", "Cáncer", "Enfermedad de tiroides", "Depresión", "Ninguna"], engine: true },
  { key: "d5_39", type: "opcion_multiple", text: "¿Tiene alguno de estos diagnósticos personales?", options: ["Diabetes tipo 1", "Diabetes tipo 2", "Prediabetes", "HTA", "Dislipidemia (colesterol alto)", "Hipertrigliceridemia", "Hipotiroidismo", "Hipertiroidismo", "Obesidad", "Síndrome Metabólico", "Cáncer (activo)", "Cáncer (en remisión)", "Enfermedad cardiovascular", "Insuficiencia renal", "Enfermedad hepática", "Artritis/Artrosis", "Osteoporosis", "Depresión", "Ansiedad", "Trastornos de la conducta alimentaria", "Ninguna", "Otra"], engine: true },
  { key: "d5_40", type: "opcion_multiple", text: "¿Qué medicamentos toma actualmente?", options: ["Ninguno", "Metformina", "Antihipertensivo", "Estatinas", "Levotiroxina", "Insulina", "Otros"] },
  { key: "d5_41", type: "opcion", text: "¿Fue amamantado/a en su infancia?", options: ["No sé", "No", "Sí, menos de 6 meses", "Sí, 6 meses o más"] },
  { key: "d5_42", type: "opcion_multiple", text: "¿Exposición habitual a contaminantes?", options: ["Pesticidas / agroquímicos", "Metales pesados", "Contaminación del aire", "Ninguna"] },
  // D6 · Alergias y salud digestiva
  { key: "d6_43", type: "opcion_multiple", text: "¿Alergias alimentarias diagnosticadas?", options: ["Ninguna", "Leche", "Huevo", "Maní", "Trigo", "Soya", "Pescado", "Mariscos"] },
  { key: "d6_44", type: "opcion_multiple", text: "¿Intolerancias alimentarias?", options: ["Ninguna", "Lactosa", "Gluten", "Fructosa"] },
  { key: "d6_45", type: "opcion", text: "Hinchazón abdominal", options: GI_OPC },
  { key: "d6_46", type: "opcion", text: "Gases / flatulencia", options: GI_OPC },
  { key: "d6_47", type: "opcion", text: "Dolor abdominal", options: GI_OPC },
  { key: "d6_48", type: "opcion", text: "Diarrea", options: GI_OPC },
  { key: "d6_49", type: "opcion", text: "Estreñimiento", options: GI_OPC },
  { key: "d6_50", type: "opcion", text: "Reflujo / acidez", options: GI_OPC },
  { key: "d6_51", type: "opcion", text: "Náuseas", options: GI_OPC },
  // D7 · Hidratacion (bebidas: conteo por dia)
  { key: "d7_52", type: "contador", text: "Café (tazas por día)" },
  { key: "d7_53", type: "contador", text: "Té (tazas por día)" },
  { key: "d7_54", type: "contador", text: "Jugos naturales (vasos por día)" },
  { key: "d7_55", type: "contador", text: "Gaseosas (vasos por día)" },
  { key: "d7_agua", type: "contador", text: "Agua (vasos de 200 ml por día)" },
  { key: "d7_56", type: "contador", text: "Bebidas energéticas (latas por día)" },
  { key: "d7_57", type: "opcion", text: "¿Siente sed con frecuencia?", options: ["Nunca", "Rara vez", "A veces", "Frecuentemente", "Siempre"] },
  { key: "d7_58", type: "opcion", text: "¿Color de su orina habitualmente?", options: ["Transparente", "Amarillo claro", "Amarillo", "Oscuro (naranja / marrón)"] },
  // D8 · Contexto social
  { key: "d8_59", type: "opcion", text: "¿Quién prepara sus alimentos habitualmente?", options: ["Yo mismo/a", "Un familiar", "Restaurante o fonda", "Cafetería / comedor"] },
  { key: "d8_60", type: "opcion", text: "¿Con qué frecuencia come fuera de casa?", options: ["Nunca", "1–2 veces/semana", "3–4 veces/semana", "Todos los días"] },
  { key: "d8_61", type: "opcion", text: "¿Tiene acceso fácil a alimentos frescos y saludables?", options: ["Sí, siempre", "A veces es difícil", "Generalmente es difícil"], engine: true },
  { key: "d8_62", type: "opcion", text: "¿Hay momentos en que no tiene suficiente comida en el hogar?", options: ["No, nunca", "A veces", "Frecuentemente"], engine: true },
];

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD", ADMIN_PASSWORD);
  const professionalPassword = requireEnv("SEED_PROFESSIONAL_PASSWORD", PROFESSIONAL_PASSWORD);
  // Internos de prueba: password propia si se define, si no la del profesional.
  const soportePassword = process.env.SEED_SOPORTE_PASSWORD || professionalPassword;
  const direccionPassword = process.env.SEED_DIRECCION_PASSWORD || professionalPassword;

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
  // Anexo 3 firmado por el profesional demo (onboardeado). Es la precondicion del Nivel (b):
  // sin esta firma vigente, la auditoria seudonimizada no cubre a sus pacientes.
  check(
    "professional_document_signatures",
    (
      await supabase.from("professional_document_signatures").upsert(
        { professional_id: PROFESSIONAL_PROFILE_ID, document_type: "anexo3", signed_version: "1.0", signed_at: new Date().toISOString() },
        { onConflict: "professional_id,document_type" },
      )
    ).error,
  );

  // 4b. Soporte de prueba: auth user (el trigger crea el profile) + rol soporte. Solicita
  // grants de acceso a las notas; lo aprueba admin.
  const soporteId = await ensureUser(SOPORTE_EMAIL, soportePassword, SOPORTE_NAME);
  check(
    "user_roles soporte",
    (await supabase.from("user_roles").upsert({ user_id: soporteId, role_id: ROLE_IDS.soporte }, { onConflict: "user_id,role_id" })).error,
  );

  // 4c. Direccion de prueba: auth user + rol direccion. Aprueba las solicitudes de admin;
  // no solicita ni ve contenido clinico (su tablero es agregado).
  const direccionId = await ensureUser(DIRECCION_EMAIL, direccionPassword, DIRECCION_NAME);
  check(
    "user_roles direccion",
    (await supabase.from("user_roles").upsert({ user_id: direccionId, role_id: ROLE_IDS.direccion }, { onConflict: "user_id,role_id" })).error,
  );

  // 5. model_version REAL en estado active (B11: motor de Gildardo portado).
  check(
    "model_versions",
    (
      await supabase.from("model_versions").upsert(
        { id: MODEL_VERSION_ID, version_name: "ANI-BIS-E 1.0", rules_version: "1.0", description: "Modelo ANI-BIS-E portado del prototipo final de Gildardo (B11). Ciencia congelada en src/clinical-engine/frozen; los cortes viven en el motor.", status: "active" },
        { onConflict: "id" },
      )
    ).error,
  );

  // 5bis. Catalogos del registry DERIVADOS de la ciencia congelada (B11): 12 indicadores,
  // 9 fenotipos estructurales (STRUCT), 9 sectores FyR y los 81 estados EFR. Se generan
  // corriendo el motor congelado (registry-data), no se transcriben. Upsert por sus
  // unique keys; el pipeline resuelve los FK por codigo/clave en runtime. Los cortes de
  // los clasificadores NO se duplican aqui: viven en el motor (fuente unica).
  check(
    "indicator_definitions",
    (
      await supabase.from("indicator_definitions").upsert(
        registry.indicators.map((d) => ({
          model_version_id: MODEL_VERSION_ID,
          code: d.code,
          name: d.name,
          unit: d.unit,
        })),
        { onConflict: "model_version_id,code" },
      )
    ).error,
  );
  check(
    "phenotypes",
    (
      await supabase.from("phenotypes").upsert(
        registry.phenotypes.map((p) => ({
          model_version_id: MODEL_VERSION_ID,
          code: p.code,
          name: p.name,
        })),
        { onConflict: "model_version_id,code" },
      )
    ).error,
  );
  check(
    "fr_sectors",
    (
      await supabase.from("fr_sectors").upsert(
        registry.frSectors.map((s) => ({
          model_version_id: MODEL_VERSION_ID,
          code: s.code,
          name: s.name,
        })),
        { onConflict: "model_version_id,code" },
      )
    ).error,
  );
  // efr_states: delete + insert (no upsert) para ser RESEED-SAFE ante una renumeracion.
  // La etiqueta-numero es una permutacion de las 4 bandas; un upsert por (model_version_id,
  // state_number) chocaria con el unique (model_version_id, bands) al reasignar numeros sobre
  // una BD ya seedada (el update pisaria bandas que otra fila ya tiene). En BD fresca no
  // aplica; el delete previo la deja consistente en ambos casos. Sin FK entrante (diagnoses
  // guarda efr_state_number como entero, no como FK), asi que borrar es seguro.
  await supabase.from("efr_states").delete().eq("model_version_id", MODEL_VERSION_ID);
  check(
    "efr_states",
    (
      await supabase.from("efr_states").insert(
        registry.efrStates.map((s) => ({
          model_version_id: MODEL_VERSION_ID,
          state_number: s.stateNumber,
          ifc_band: s.ifcBand,
          irc_band: s.ircBand,
          ffmi_band: s.ffmiBand,
          fmi_band: s.fmiBand,
          diagnosis_name: s.diagnosisName,
          mechanism: s.mechanism,
          biomarkers: s.biomarkers,
          risks: s.risks,
          suggested_nutraceuticals: s.suggestedNutraceuticals,
        })),
      )
    ).error,
  );

  // 6. survey_template + survey_version + contenido REAL (62 preguntas, D1-D8).
  check(
    "survey_templates",
    (await supabase.from("survey_templates").upsert({ id: SURVEY_TEMPLATE_ID, name: "Encuesta ANI-BIS-E", description: "Instrumento clinico completo (D1-D8) portado del prototipo final de Gildardo. field_key marca las preguntas que alimentan el motor congelado." }, { onConflict: "id" })).error,
  );
  check(
    "survey_versions",
    (await supabase.from("survey_versions").upsert({ id: SURVEY_VERSION_ID, template_id: SURVEY_TEMPLATE_ID, version_number: 1 }, { onConflict: "id" })).error,
  );
  // Reemplazo autoritativo: borra las preguntas de esta version (las opciones caen por
  // cascade) y siembra el set real. Con UUIDs deterministicos por (tipo, clave) el borrar
  // e insertar deja los mismos ids -> idempotente. Requiere una BD sin respuestas reales
  // referenciando estas preguntas (contexto de seed dev), o el FK de survey_answers frena.
  // Orden de borrado (dev): survey_answers -> survey_responses -> survey_questions, o el
  // FK de answers frena el borrado de preguntas. Las answers se borran por question_id de
  // esta version (survey_answers no tiene columna de version), cubriendo tambien answers
  // huerfanas de smokes previos. En dev no hay historia clinica real que preservar; el
  // seed reestablece el estado determinista.
  const existingQ = await supabase.from("survey_questions").select("id").eq("survey_version_id", SURVEY_VERSION_ID);
  check("survey_questions fetch", existingQ.error);
  const existingQIds = (existingQ.data ?? []).map((r) => r.id);
  if (existingQIds.length) {
    check("survey_answers delete", (await supabase.from("survey_answers").delete().in("question_id", existingQIds)).error);
  }
  check("survey_responses delete", (await supabase.from("survey_responses").delete().eq("survey_version_id", SURVEY_VERSION_ID)).error);
  check("survey_questions delete", (await supabase.from("survey_questions").delete().eq("survey_version_id", SURVEY_VERSION_ID)).error);

  const surveyQuestionRows = SURVEY_QUESTIONS.map((q, i) => ({
    id: surveyUuid("q", q.key),
    survey_version_id: SURVEY_VERSION_ID,
    question_text: q.text,
    question_type: q.type,
    field_key: q.engine ? q.key : null,
    section: sectionFor(q.key),
    order_index: i + 1,
    data_class: "clinical" as const, // toda respuesta de salud es dato clinico
    used_in_diagnosis: !!q.engine,
  }));
  check("survey_questions", (await supabase.from("survey_questions").upsert(surveyQuestionRows, { onConflict: "id" })).error);

  // El motor lee option_text (la cadena), no survey_options.value: value queda null (no se
  // inventa scoring; los cortes viven en el motor). order_index preserva el orden del HTML.
  const surveyOptionRows = SURVEY_QUESTIONS.flatMap((q) =>
    (q.options ?? []).map((opt, j) => ({
      id: surveyUuid("o", q.key, String(j)),
      question_id: surveyUuid("q", q.key),
      option_text: opt,
      value: null,
      order_index: j + 1,
    })),
  );
  check("survey_options", (await supabase.from("survey_options").upsert(surveyOptionRows, { onConflict: "id" })).error);

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
  // PII demografica del paciente demo (un paciente real la tiene desde el intake). Da
  // nombre a la vista identificada (Nivel c).
  check(
    "patient_profiles",
    (
      await supabase.from("patient_profiles").upsert(
        { patient_id: PATIENT_ID, first_name: "Paciente", last_name: "Demo", sex: "M", city: "Medellin" },
        { onConflict: "patient_id" },
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

  // 9b. (Retirado) La cadena clinica demo fabricada a mano (evaluacion -> diagnostico sin
  // snapshot -> tratamiento -> nota) se elimino: daba 404 en "Ver resultados" porque el
  // diagnostico no tenia snapshot, y su numero quedaba rancio ante renumeraciones. El caso
  // clinico real navegable es "Demo GoldenPath", sembrado por la VIA REAL con `pnpm seed:golden`
  // (snapshot genuino y autosuficiente + notas para el smoke de auditoria Nivel b/c). El paciente
  // demo 99999999 queda SIN evaluacion (solo sostiene el link de encuesta / intake), asi no
  // muestra un diagnostico roto en /pacientes.

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

  // 11. Prompt de IA versionado: menu.generate v1 (active) = texto canonico en codigo. Se
  // usa ignoreDuplicates para NO sobrescribir ediciones del admin (v2+) al recorrer el seed.
  check(
    "ai_prompts",
    (
      await supabase.from("ai_prompts").upsert(
        {
          prompt_key: "menu.generate",
          version: 1,
          content: menuSystemPrompt,
          status: "active",
          created_by: adminId,
        },
        { onConflict: "prompt_key,version", ignoreDuplicates: true },
      )
    ).error,
  );

  console.log("Seed completo:");
  console.log(`  organizacion: ${ORG_ID}`);
  console.log(`  admin:        ${ADMIN_EMAIL} (${adminId})`);
  console.log(`  soporte:      ${SOPORTE_EMAIL} (${soporteId})`);
  console.log(`  direccion:    ${DIRECCION_EMAIL} (${direccionId})`);
  console.log(`  profesional:  ${PROFESSIONAL_EMAIL} (${professionalId})`);
  console.log(`  model_version ANI-BIS-E 1.0 active (12 indicadores, 9 fenotipos, 9 sectores FyR, 81 estados EFR reales), survey v1 (${SURVEY_QUESTIONS.length} preguntas reales D1-D8, ${SURVEY_QUESTIONS.filter((q) => q.engine).length} con field_key), 2 devices, 2 nutraceuticos`);
  console.log(`  paciente demo: CC DEMO-0001 (${PATIENT_ID}) vinculado al profesional`);
  console.log(`  link de encuesta inicial: /encuesta/${SURVEY_LINK_TOKEN}`);
}

main().catch((err) => {
  console.error("Seed fallido:", err instanceof Error ? err.message : err);
  process.exit(1);
});
