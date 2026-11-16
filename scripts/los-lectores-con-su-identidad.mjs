// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS LECTORES DE "ANTROP. Y BIS", CORRIDOS CON LA IDENTIDAD DE UNA PROFESIONAL  ·  SOLO LECTURA
//
// 2026-11-15 · DEJADO LISTO SIN CORRER, a peticion de Santiago, para el caso de Maria Teresa (4d2a74e0).
//
// COMO SE CORRE, CUANDO ELLA VUELVA A VER EL ERROR:
//
//   node --env-file=.env.production.local scripts/los-lectores-con-su-identidad.mjs <correo> <idConsulta>
//
// Y DESPUES, EN SENTRY: buscar el codigo que le salio en pantalla con  digest:<codigo>
//
// ═══ QUE PREGUNTA CONTESTA, Y POR QUE NO LA CONTESTA UNA MIRADA AL CODIGO ═══
//
// Cuando una pestaña se cae con "Algo salió mal" y un codigo, la pregunta no es que lector falla: es
// **con que identidad** falla. Casi todos estos lectores van por el cliente CON SESION, asi que la RLS
// decide, y la RLS depende de quien pregunta: su `user id`, su rol y los claims de su JWT. Corriendo las
// mismas consultas con la service role NUNCA se reproduce (la service role salta la RLS), y de ahi sale
// el diagnostico equivocado de "en mi maquina funciona".
//
// ASI QUE ESTO HACE LAS DOS COSAS Y LAS COMPARA, que es lo unico que separa las tres causas posibles:
//
//   · falla con ELLA y funciona con la service role  -> es la RLS (o un claim que le falta);
//   · falla con las DOS                               -> es la consulta (un embed ambiguo, una columna);
//   · funciona con las dos pero LENTO                 -> es el tiempo limite de la base, no un permiso.
//
// Por eso imprime los MILISEGUNDOS de cada una: el caso de ella empezo como timeouts, y un timeout no se
// distingue de un permiso denegado mirando la pantalla.
//
// ═══ COMO SE CONSIGUE SU IDENTIDAD SIN SU CONTRASEÑA ═══
//
// Con el admin de Auth se genera un enlace de un solo uso para su correo (`generateLink`, que NO envia
// ningun correo) y se canjea en el cliente ANONIMO (`verifyOtp`). Lo que queda es un `access_token` con
// SUS claims, que es exactamente lo que el navegador de ella le manda a PostgREST. No se cambia su
// contraseña, no se toca su cuenta, y la sesion que se crea se cierra al final.
//
// ESO NO ES "SOLO LECTURA" EN SENTIDO ESTRICTO, y conviene decirlo: crear una sesion es un acto de auth,
// queda en el log de Auth de Supabase, e invalida nada de lo suyo. Ninguna fila de datos se escribe. Si
// Santiago prefiere no crear la sesion, el script corre igual con `--solo-service-role` y entonces solo
// contesta la tercera pregunta (si es lentitud), que ya es la mitad del caso.
//
// NO IMPRIME NINGUN DATO DE PACIENTE: ni nombre, ni documento, ni valores de la medicion. Solo el rol de
// ella, cuantas filas devolvio cada lectura, los milisegundos y el error textual cuando hay.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL_SB || !SERVICE) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

const args = process.argv.slice(2);
const soloServiceRole = args.includes("--solo-service-role");
const [correo, idConsulta] = args.filter((a) => !a.startsWith("--"));
if (!correo || !idConsulta) {
  console.error(
    "Uso: node --env-file=.env.production.local scripts/los-lectores-con-su-identidad.mjs <correo> <idConsulta> [--solo-service-role]",
  );
  process.exit(1);
}

const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
console.log(`base: ${new URL(URL_SB).host}`);
console.log(`consulta: ${idConsulta}`);

// ── 1 · QUIEN ES ELLA PARA LA BASE: su user id y su rol ──────────────────────────────────────────
//
// El rol NO se lee del correo ni del dominio (regla dura 3): se lee de su fila. Y se imprime porque es
// la mitad de la hipotesis: un rol que no corresponde es indistinguible de una RLS mal escrita.
// EL ROL VIVE EN `user_roles`, N:N, no en una columna de `profiles`: un usuario puede tener varios, y
// eso importa aqui (el candado `dos-roles-no-abren-mas-puertas` existe por ese motivo). Se piden TODOS.
const { data: perfiles, error: errPerfil } = await admin
  .from("profiles")
  .select("id, status, user_roles(roles(name))")
  .eq("email", correo)
  .limit(1);
if (errPerfil) {
  console.log(`! no se pudo leer su perfil: ${errPerfil.message}`);
  process.exit(1);
}
const perfil = perfiles?.[0];
if (!perfil) {
  console.log(`! no hay ningun perfil con el correo dado en esta base.`);
  process.exit(1);
}
const roles = (perfil.user_roles ?? [])
  .map((ur) => (Array.isArray(ur.roles) ? ur.roles[0]?.name : ur.roles?.name))
  .filter(Boolean);
console.log(
  `identidad: user ${perfil.id} · estado ${perfil.status} · rol(es) ${roles.join(", ") || "(ninguno)"}`,
);

// ── 2 · SU SESION, para que la RLS la evalue a ELLA ──────────────────────────────────────────────
let comoElla = null;
if (soloServiceRole) {
  console.log("sesion: NO se pide (--solo-service-role). Solo se mide con la service role.");
} else if (!ANON) {
  console.log("sesion: NO se puede pedir (falta NEXT_PUBLIC_SUPABASE_ANON_KEY). Solo service role.");
} else {
  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: correo,
  });
  if (errEnlace || !enlace?.properties?.hashed_token) {
    console.log(`! no se pudo generar su enlace de un solo uso: ${errEnlace?.message ?? "sin token"}`);
  } else {
    const anonimo = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data: sesion, error: errSesion } = await anonimo.auth.verifyOtp({
      type: "magiclink",
      token_hash: enlace.properties.hashed_token,
    });
    if (errSesion || !sesion?.session?.access_token) {
      console.log(`! no se pudo canjear su enlace: ${errSesion?.message ?? "sin sesion"}`);
    } else {
      comoElla = createClient(URL_SB, ANON, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${sesion.session.access_token}` } },
      });
      // LOS CLAIMS QUE DE VERDAD VIAJAN, no los que suponemos: las policies leen de aqui. Se imprimen
      // los que deciden (sub, role, aal, y el rol de la app si viaja en el token), nunca el token.
      const cuerpo = JSON.parse(
        Buffer.from(sesion.session.access_token.split(".")[1], "base64").toString("utf8"),
      );
      const claves = ["sub", "role", "aal", "aud", "app_metadata", "user_metadata"];
      console.log(
        `sesion: creada. claims -> ${claves
          .filter((k) => cuerpo[k] != null)
          .map((k) => `${k}=${typeof cuerpo[k] === "object" ? JSON.stringify(cuerpo[k]) : cuerpo[k]}`)
          .join(" · ")}`,
      );
    }
  }
}

// ── 3 · LOS LECTORES DE LA PESTAÑA, uno por uno ──────────────────────────────────────────────────
//
// SON LAS CONSULTAS DE LOS LECTORES, COPIADAS DE SUS ARCHIVOS, no una aproximacion: lo que se quiere
// reproducir es el fallo, y un `select` parecido puede pasar donde el real falla (un embed ambiguo de
// PostgREST es exactamente asi, y ya rompio tres pantallas el 2026-08-12).
//
// Al lado de cada una, de donde se copio, para poder volver a cotejarla cuando el lector cambie.
const LECTURAS = [
  {
    nombre: "bis-evaluations-reader · getBisImportEvaluationForId",
    corre: (sb) =>
      sb
        .from("evaluations")
        .select(
          "id, type, created_at, patient_id, patients!inner(document_type, document_number, patient_profiles!inner(first_name, last_name)), bis_measurements(id, measurement_date, no_es_del_paciente_at)",
        )
        .eq("id", idConsulta)
        .eq("status", "in_progress")
        .maybeSingle(),
  },
  {
    nombre: "bis-conditions-reader · getBisIntakeForEvaluation (intake)",
    corre: (sb) =>
      sb
        .from("evaluation_bis_intake")
        .select("bis_condition_version_id, condition_answers, contraindicated, grip_strength_kg, updated_at")
        .eq("evaluation_id", idConsulta)
        .maybeSingle(),
  },
  {
    nombre: "bis-conditions-reader · peso meta",
    corre: (sb) => sb.from("evaluations").select("weight_goal_kg").eq("id", idConsulta).maybeSingle(),
  },
  {
    nombre: "bis-conditions-reader · sexo del paciente (embed de dos saltos)",
    corre: (sb) =>
      sb
        .from("evaluations")
        .select("patients!inner(patient_profiles!inner(sex))")
        .eq("id", idConsulta)
        .maybeSingle(),
  },
  {
    nombre: "bis-conditions-reader · catalogo de condiciones (version vigente)",
    corre: (sb) => sb.from("bis_condition_versions").select("id, version_number").order("version_number", { ascending: false }).limit(1),
  },
  {
    nombre: "composition-reader · medicion",
    corre: (sb) => sb.from("bis_measurements").select("id, measurement_date").eq("evaluation_id", idConsulta),
  },
  {
    nombre: "composition-reader · crudos de la medicion",
    corre: async (sb) => {
      const { data, error } = await sb
        .from("bis_measurements")
        .select("id")
        .eq("evaluation_id", idConsulta)
        .limit(1);
      if (error) return { data: null, error };
      const id = data?.[0]?.id;
      if (!id) return { data: [], error: null };
      return sb.from("bis_raw_values").select("variable_name, value, origin").eq("measurement_id", id);
    },
  },
  {
    nombre: "composition-reader · correcciones de valores",
    corre: async (sb) => {
      const { data, error } = await sb
        .from("bis_measurements")
        .select("id")
        .eq("evaluation_id", idConsulta)
        .limit(1);
      if (error) return { data: null, error };
      const id = data?.[0]?.id;
      if (!id) return { data: [], error: null };
      return sb
        .from("bis_value_corrections")
        .select("variable_name, original_value, corrected_by_email, corrected_at")
        .eq("measurement_id", id);
    },
  },
];

/** Corre una lectura midiendo el tiempo, y devuelve lo que paso SIN datos de paciente. */
async function medir(sb, lectura) {
  const t0 = Date.now();
  try {
    const { data, error } = await lectura.corre(sb);
    const ms = Date.now() - t0;
    if (error) return { ms, estado: "ERROR", detalle: error.message };
    const filas = data == null ? 0 : Array.isArray(data) ? data.length : 1;
    return { ms, estado: filas === 0 ? "VACIO" : "OK", detalle: `${filas} fila(s)` };
  } catch (e) {
    // UN LANZAMIENTO NO ES UN `error` DE POSTGREST: un corte de red o un tiempo limite del cliente llega
    // asi, y es justo la familia del caso de ella. Se distingue en la salida.
    return { ms: Date.now() - t0, estado: "LANZO", detalle: e instanceof Error ? e.message : String(e) };
  }
}

console.log(`\n${"lectura".padEnd(62)} ${"con ELLA".padEnd(26)} con service role`);
console.log("-".repeat(112));
const fallanConElla = [];
for (const lectura of LECTURAS) {
  const conServicio = await medir(admin, lectura);
  const conSesion = comoElla ? await medir(comoElla, lectura) : null;
  const izq = conSesion ? `${conSesion.estado} ${conSesion.ms}ms` : "(no se midio)";
  console.log(`${lectura.nombre.padEnd(62)} ${izq.padEnd(26)} ${conServicio.estado} ${conServicio.ms}ms`);
  if (conSesion && conSesion.estado !== "OK" && conSesion.estado !== "VACIO") {
    fallanConElla.push({ lectura: lectura.nombre, conSesion, conServicio });
  }
  if (conServicio.estado === "ERROR" || conServicio.estado === "LANZO") {
    console.log(`    service role: ${conServicio.detalle}`);
  }
}

// ── 4 · EL VEREDICTO, separando las tres causas ──────────────────────────────────────────────────
console.log("");
if (!comoElla) {
  console.log("Sin su sesion no se puede separar la RLS de la consulta. Lo que si se midio son los");
  console.log("MILISEGUNDOS: si alguna lectura va cerca del tiempo limite de la base, el fallo es de");
  console.log("tiempo y no de permiso, y eso ya cambia por donde se busca.");
} else if (fallanConElla.length === 0) {
  console.log("TODAS las lecturas pasan con SU identidad. O sea que lo que se cayo no es ninguna de");
  console.log("estas, o se cayo por TIEMPO en el momento en que ella entro. Mirar los milisegundos de");
  console.log("arriba y buscar el codigo de la pantalla en Sentry con  digest:<codigo>  para ver la");
  console.log("traza: ahi sale el lector exacto y la fila de la que colgaba.");
} else {
  for (const f of fallanConElla) {
    console.log(`FALLA CON ELLA: ${f.lectura}`);
    console.log(`  con su identidad -> ${f.conSesion.estado}: ${f.conSesion.detalle}`);
    console.log(`  con service role -> ${f.conServicio.estado}: ${f.conServicio.detalle}`);
    console.log(
      f.conServicio.estado === "OK" || f.conServicio.estado === "VACIO"
        ? "  LECTURA: es la RLS o un claim suyo, no la consulta (con service role pasa)."
        : "  LECTURA: es la CONSULTA, no un permiso (falla con las dos identidades).",
    );
  }
}

// La sesion se cierra: no se deja abierta una sesion de otra persona creada por un script.
if (comoElla) {
  await comoElla.auth.signOut().catch(() => {});
  console.log("\nsesion cerrada.");
}
console.log("Fin. No se escribio ninguna fila de datos.");
