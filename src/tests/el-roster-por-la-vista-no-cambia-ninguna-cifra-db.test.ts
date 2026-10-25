import { describe, expect, it, vi } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA PRUEBA DE QUE LA 0228 NO MOVIO NINGUNA CIFRA
//
// ── QUE SE COMPRUEBA ────────────────────────────────────────────────────────────────────────────
//
// La fila de /pacientes se arma ahora desde la vista `pacientes_del_roster` (una fila por paciente) en
// vez de la cadena de embeds que traia 8,3 filas por paciente. El cambio es de RENDIMIENTO, asi que la
// unica forma de darlo por bueno es demostrar que la pantalla dice EXACTAMENTE lo mismo.
//
// Esta prueba arma la misma fila por los DOS caminos, con la MISMA funcion de mapeo
// (`filaDelRoster`), y compara los resultados paciente por paciente y campo por campo:
//
//   CAMINO VIEJO   la cadena de embeds de PostgREST, conservada aqui verbatim, con el mapeo que el
//                  lector hacia antes de la 0228. Es la unica copia que queda de el, y es a proposito:
//                  es la referencia contra la que se mide, no codigo vivo.
//   CAMINO NUEVO   `pacientes_del_roster` + `crudaDeLaVista`, que es lo que la pantalla usa hoy.
//
// ── POR QUE CON SERVICE ROLE ────────────────────────────────────────────────────────────────────
//
// Porque la comparacion tiene que cubrir a TODOS los pacientes, no a los de un profesional. Lo que se
// compara es la cifra, no el alcance: que la RLS siga decidiendo quien ve que se prueba aparte (la
// vista es `security_invoker`, y lo cubre `rls.test.ts` mas la suite de RLS entera).
//
// ── Y LA MEDICION, QUE ES EL MOTIVO DEL CAMBIO ──────────────────────────────────────────────────
//
// Imprime el tiempo y el tamaño de los dos caminos. NO los asevera: en la base local hay dos ordenes de
// magnitud menos de datos que en produccion, asi que un umbral aqui seria una cifra inventada. La
// medicion que decide es la de produccion, y esta sirve para ver la direccion.
//
// Se AUTO-SALTA sin las variables. Requiere `supabase start` y las migraciones aplicadas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

vi.mock("server-only", () => ({}));

let HAS_DB = false;
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local: el guard salta el bloque.
}
HAS_DB = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

// LA CADENA DE EMBEDS DE ANTES DE LA 0228, verbatim. No se toca: es la referencia.
const EMBEDS_DE_ANTES =
  "id, created_at, document_type, document_number, status, is_test, cuenta_como_de_prueba, " +
  "test_proposed_at, patient_profiles!inner(first_name, last_name, birth_date), " +
  "patient_consents(consent_type, revoked_at, signed_at), " +
  "evaluations(id, type, superseded_at, retirada_at, status, created_at, import_batch_id, " +
  "bis_measurements(measurement_date), evaluation_bis_intake(evaluation_id), diagnoses(id), reports(status))";

describe.skipIf(!HAS_DB)("la vista del roster no cambia ninguna cifra (BD real)", () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */

  it("cada paciente sale identico por los dos caminos", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const { filaDelRoster } = await import("@/modules/patients/roster-fila");
    const { crudaDeLaVista } = await import("@/modules/patients/data/patients-list-reader");

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // ── CAMINO VIEJO ──────────────────────────────────────────────────────────────────────────────
    const t0 = Date.now();
    const viejo = await sb.from("patients").select(EMBEDS_DE_ANTES).is("deleted_at", null);
    const msViejo = Date.now() - t0;
    expect(viejo.error, viejo.error?.message).toBeNull();
    const bytesViejo = JSON.stringify(viejo.data ?? []).length;

    // ── CAMINO NUEVO ──────────────────────────────────────────────────────────────────────────────
    const t1 = Date.now();
    const nuevo = await sb
      .from("pacientes_del_roster")
      .select(
        "patient_id, created_at, document_type, document_number, status, cuenta_como_de_prueba, " +
          "test_proposed_at, first_name, last_name, birth_date, consentimientos_vigentes, evaluaciones",
      );
    const msNuevo = Date.now() - t1;
    expect(nuevo.error, nuevo.error?.message).toBeNull();
    const bytesNuevo = JSON.stringify(nuevo.data ?? []).length;

    // EL MAPEO VIEJO, conservado aqui. Lo unico que hace es traducir los embeds a los mismos hechos que
    // la vista resuelve en SQL; de ahi en adelante los dos caminos llaman a la MISMA funcion.
    const porElCaminoViejo = (viejo.data ?? []).map((row: any) => {
      const perfil = Array.isArray(row.patient_profiles)
        ? row.patient_profiles[0]
        : row.patient_profiles;
      const evals = (row.evaluations ?? []) as any[];
      const enPie = evals.filter((e) => e.superseded_at == null && e.retirada_at == null);
      return filaDelRoster({
        patientId: row.id,
        createdAt: row.created_at,
        documentType: row.document_type,
        documentNumber: row.document_number,
        status: row.status,
        cuentaComoDePrueba: row.cuenta_como_de_prueba === true,
        testProposedAt: row.test_proposed_at,
        firstName: perfil?.first_name ?? "",
        lastName: perfil?.last_name ?? "",
        birthDate: perfil?.birth_date ?? null,
        consentimientosVigentes: ((row.patient_consents ?? []) as any[])
          .filter((c) => c.revoked_at === null)
          .map((c) => ({ consent_type: c.consent_type, signed_at: c.signed_at })),
        evaluaciones: enPie.map((e) => ({
          evaluationId: e.id,
          type: e.type,
          status: e.status,
          createdAt: e.created_at,
          fechaDeMedicion: e.bis_measurements?.[0]?.measurement_date ?? null,
          tieneBis: (e.bis_measurements ?? []).length > 0,
          tieneCondicionesBis: (e.evaluation_bis_intake ?? []).length > 0,
          tieneDiagnostico: (e.diagnoses ?? []).length > 0,
          reporte: e.reports?.[0]?.status ?? null,
          importada: e.import_batch_id != null,
        })),
      });
    });

    const porLaVista = (nuevo.data ?? []).map((row: any) => filaDelRoster(crudaDeLaVista(row)));

    console.log(
      `\n  Roster por embeds: ${msViejo} ms · ${(bytesViejo / 1024).toFixed(0)} KB` +
        `\n  Roster por la vista: ${msNuevo} ms · ${(bytesNuevo / 1024).toFixed(0)} KB` +
        `\n  Pacientes comparados: ${porLaVista.length}\n`,
    );

    expect(porLaVista.length, "los dos caminos tienen que traer los mismos pacientes").toBe(
      porElCaminoViejo.length,
    );
    expect(porLaVista.length, "sin pacientes la comparacion no prueba nada").toBeGreaterThan(0);

    // CAMPO POR CAMPO, Y CON EL PACIENTE NOMBRADO EN EL FALLO: un `toEqual` de los dos arreglos diria
    // "no son iguales" sobre 150 objetos anidados, y encontrar cual difiere seria el trabajo entero.
    const viejoPorId = new Map(porElCaminoViejo.map((f) => [f.patientId, f]));
    const diferencias: string[] = [];
    const corregidas: string[] = [];
    for (const fila of porLaVista) {
      const antes = viejoPorId.get(fila.patientId);
      if (!antes) {
        diferencias.push(`${fila.patientId}: no estaba en el camino viejo`);
        continue;
      }
      for (const campo of Object.keys(fila) as (keyof typeof fila)[]) {
        const a = JSON.stringify(antes[campo]);
        const b = JSON.stringify(fila[campo]);
        if (a === b) continue;
        // ═══ LA UNICA DIFERENCIA PERMITIDA, Y ES UNA CORRECCION (hallada por esta prueba) ═══
        //
        // El camino viejo pedia `evaluation_bis_intake(evaluation_id)` como embed, y esa tabla tiene un
        // UNIQUE sobre `evaluation_id`, asi que PostgREST la devuelve como OBJETO y no como arreglo. El
        // lector hacia `(e.evaluation_bis_intake ?? []).length > 0`, que sobre un objeto es
        // `undefined > 0`: SIEMPRE false. O sea que la columna NO PODIA decir nunca que las condiciones
        // de la toma estaban registradas, y a quien ya las habia registrado le seguia pidiendo
        // "Registrar condiciones de la toma" en vez de "Generar diagnóstico".
        //
        // La vista lo resuelve con un `exists`, que no tiene esa ambiguedad. Asi que esta diferencia es
        // la unica que se acepta, se exige que sea EXACTAMENTE esta, y se cuenta: cualquier otra falla.
        const esLaCorreccionDelIntake =
          campo === "pendiente" &&
          a.includes("Registrar condiciones de la toma") &&
          !b.includes("Registrar condiciones de la toma");
        if (esLaCorreccionDelIntake) {
          // Y LA CORRECCION NO MUEVE EL CONTEO DEL TABLERO, que cuenta pacientes CON algo pendiente:
          // "Registrar condiciones" y "Generar diagnóstico" son los dos un pendiente, asi que el paciente
          // sigue contando. Si alguna correccion dejara el pendiente en null, la cifra de /inicio
          // cambiaria y habria que decirlo en vez de descubrirlo.
          expect(
            (antes[campo] as { principal: unknown } | null)?.principal,
            "la correccion no puede dejar a un paciente sin pendiente: eso mueve la cifra del tablero",
          ).not.toBeNull();
          expect((fila[campo] as { principal: unknown } | null)?.principal).not.toBeNull();
          corregidas.push(`${fila.documentNumber}: ${a} -> ${b}`);
          continue;
        }
        diferencias.push(`${fila.documentNumber} · ${String(campo)}: ${a} -> ${b}`);
      }
    }

    if (corregidas.length > 0) {
      console.log(
        `  Pendientes CORREGIDOS por la vista (el embed to-one siempre daba false): ${corregidas.length}`,
      );
      for (const c of corregidas) console.log(`    · ${c}`);
    }
    expect(
      diferencias,
      "la 0228 es de rendimiento: aparte de la correccion del intake, ninguna cifra puede moverse",
    ).toEqual([]);
  }, 60000);

  it("la correccion es real: la evaluacion tiene su fila de condiciones en la base", async () => {
    // Que la vista diga `tieneCondicionesBis` no basta: hay que verificar contra la tabla que esas filas
    // existen de verdad. Si no existieran, la vista estaria mintiendo al revés y seria peor que el bug.
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const vista = await sb.from("pacientes_del_roster").select("evaluaciones");
    expect(vista.error).toBeNull();
    const conCondiciones = new Set<string>();
    for (const row of (vista.data ?? []) as any[]) {
      for (const e of (row.evaluaciones ?? []) as any[]) {
        if (e.tieneCondicionesBis) conCondiciones.add(e.evaluationId);
      }
    }
    const intake = await sb.from("evaluation_bis_intake").select("evaluation_id");
    expect(intake.error).toBeNull();
    const enLaTabla = new Set((intake.data ?? []).map((r: any) => r.evaluation_id));
    const inventadas = [...conCondiciones].filter((id) => !enLaTabla.has(id));
    expect(
      inventadas,
      "la vista no puede decir que hay condiciones donde la tabla no tiene fila",
    ).toEqual([]);
    expect(conCondiciones.size, "sin ninguna, la comparacion de arriba no prueba nada").toBeGreaterThan(
      0,
    );
  }, 30000);

  it("security_invoker: un profesional ve por la vista SOLO sus pacientes", async () => {
    // ES LA AFIRMACION MAS GRAVE DE LA 0228: abrir una vista a `authenticated` podria ser una puerta
    // alrededor de la RLS. Con `security_invoker = true` no lo es, pero eso es una afirmacion sobre la
    // RLS, y la RLS solo se prueba corriendola. Se compara contra el total que ve el dueño: si la vista
    // filtrara mal, el profesional veria los 143 en vez de los suyos.
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      // EL PROFESIONAL CON MAS PACIENTES, y NO el primero que aparezca: uno sin pacientes ve cero por la
      // vista y tambien tendria cero asignados, asi que la comparacion saldria verde sin probar nada. Y
      // se exige que NO sea admin: un admin ve a todos por policy, y entonces esto no mediria el filtro.
      const [elQueTieneMas] = await sql`
        select pp.profile_id, count(*)::int as n
          from public.patient_professional_relationships rel
          join public.professional_profiles pp on pp.id = rel.professional_id
          join public.patients pa on pa.id = rel.patient_id
         where rel.status = 'active' and pa.deleted_at is null
           and not exists (
             select 1 from public.user_roles ur
             join public.roles r on r.id = ur.role_id
             where ur.user_id = pp.profile_id and r.name = 'admin'
           )
         group by pp.profile_id
         order by 2 desc
         limit 1`;
      const profileId = elQueTieneMas.profile_id as string;
      const suyos = elQueTieneMas.n as number;
      const [{ n: total }] = await sql`select count(*)::int as n from public.pacientes_del_roster`;

      let vistos = -1;
      await sql.begin(async (tx) => {
        await tx.unsafe("set local role authenticated");
        const claims = JSON.stringify({ sub: profileId, role: "authenticated" });
        await tx`select set_config('request.jwt.claims', ${claims}, true)`;
        const [{ n }] = await tx`select count(*)::int as n from public.pacientes_del_roster`;
        vistos = n;
      });

      expect(vistos, "la vista no puede mostrarle mas pacientes de los que tiene asignados").toBe(
        suyos,
      );
      expect(vistos, "y menos que el total: si viera todos, la vista seria una puerta").toBeLessThan(
        total,
      );
      expect(suyos, "sin pacientes asignados la comparacion no prueba nada").toBeGreaterThan(0);
    } finally {
      await sql.end();
    }
  }, 30000);

  it("la vista devuelve UNA fila por paciente, que es el punto del cambio", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await sb.from("pacientes_del_roster").select("patient_id");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: any) => r.patient_id);
    expect(new Set(ids).size, "una fila por paciente, sin duplicar por su evaluacion").toBe(
      ids.length,
    );
  }, 30000);
});
