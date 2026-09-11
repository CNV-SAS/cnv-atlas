import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { pendienteDelPaciente } from "@/modules/patients/pendientes";

// ═══ LO QUE EL TABLERO NECESITA SABER, Y NADA MAS ═══
//
// EL CORTE (Santiago, 2026-09-10), y su critica es la que lo define: "el riesgo no es que sea muy clinico,
// es que se llene de numeros que nadie mira. Un tablero con doce metricas se lee menos que uno con
// cuatro."
//
//   ARRIBA, lo accionable: tiene una cola Y un sitio a donde ir.
//   DEBAJO y mas pequeño, lo informativo: dice como va el mes, no que hacer hoy.
//   Y FUERA todo lo que no cambia una decision.
//
// LO QUE SE RETIRO, con su razon, para que no vuelva:
//   · "Pacientes: 73" y "evaluaciones acumuladas": contadores que solo suben. Nadie actua sobre ellos.
//   · "Sin evaluaciones": SI es accionable, pero la columna de pendientes de /pacientes ya lo dice
//     paciente por paciente y ahi si lleva a algun sitio. Aqui duplicaria ese trabajo.
//   · "Consultas cerradas" y "reportes enviados": cuentan lo HECHO, no lo que falta.
//
// ── TODO BAJO RLS, y eso es lo que hace que la cifra sea SUYA ───────────────────────────────────────
//
// No se filtra por profesional en el codigo: se pregunta con su sesion y la RLS decide que ve. Un filtro
// escrito aqui seria una segunda copia de la regla de alcance, y el dia que las dos discrepen la de la
// pantalla gana en silencio.

export type ProximaConsulta = {
  evaluationId: string;
  paciente: string;
  fecha: string;
};

export type Tablero = {
  /** Pacientes con algo parado. Lleva a /pacientes, donde la columna dice QUE es. */
  pacientesConPendiente: number;
  /** Reportes en borrador: falta aprobarlos y enviarlos. */
  reportesPorAprobar: number;
  /** Las TRES proximas, como listado. Ver la nota de la pantalla sobre por que no es un numero. */
  proximasConsultas: ProximaConsulta[];
  /** Comision del profesional en el mes en curso, en pesos. */
  comisionDelMes: number;
  /** Ventas del mes en curso (transacciones pagadas), en pesos. */
  ventasDelMes: number;
  /** Unidades en inventario de nutraceuticos. */
  unidadesEnInventario: number;
};

function inicioDelMes(): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString();
}

export async function getTablero(): Promise<Tablero> {
  const supabase = await createSupabaseServerClient();
  const desde = inicioDelMes();

  const [pacientes, reportes, citas, comision, ventas, inventario] = await Promise.all([
    // LOS PENDIENTES SALEN DE LA MISMA REGLA QUE LA COLUMNA (`pendienteDelPaciente`), no de un conteo
    // paralelo: si aqui se contara "evaluaciones en progreso" y alli se dijera otra cosa, el tablero y la
    // lista discreparian sobre el mismo paciente.
    supabase
      .from("patients")
      .select(
        "id, status, patient_consents(consent_type, revoked_at), evaluations(id, superseded_at, status, bis_measurements(id), diagnoses(id), reports(status))",
      )
      .is("deleted_at", null),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "draft"),
    // LA PROXIMA CITA VIVE EN EL TRATAMIENTO y es EN VIVO (no sellada): es la vigente, no la del dia de
    // la consulta. Se piden cuatro y se muestran tres: asi la pantalla sabe si hay mas sin otra consulta.
    supabase
      .from("treatments")
      // EL CAMINO PASA POR `diagnoses`, no directo a `evaluations`: `treatments` cuelga del diagnostico
      // (`diagnosis_id`), no de la evaluacion. Verificado contra la base real, que es lo unico que atrapa
      // un embed que no existe: tsc lo compila igual y solo revienta en runtime.
      .select(
        "id, proxima_cita, diagnoses!inner(evaluation_id, evaluations!inner(patients!inner(patient_profiles!inner(first_name, last_name))))",
      )
      .not("proxima_cita", "is", null)
      .gte("proxima_cita", new Date().toISOString().slice(0, 10))
      .order("proxima_cita", { ascending: true })
      .limit(4),
    supabase.from("professional_revenue").select("commission_amount").gte("created_at", desde),
    supabase.from("transactions").select("amount").eq("status", "paid").gte("created_at", desde),
    supabase.from("nutraceutical_inventory").select("stock_quantity"),
  ]);

  type FilaEval = {
    id: string;
    superseded_at: string | null;
    status: string;
    bis_measurements: { id: string }[] | null;
    diagnoses: { id: string }[] | null;
    reports: { status: string }[] | null;
  };

  const NECESARIAS = ["servicio", "datos_sensibles"];
  type FilaPaciente = {
    status: string;
    patient_consents: unknown;
    evaluations: unknown;
  };
  const conPendiente = ((pacientes.data ?? []) as unknown as FilaPaciente[]).filter((p) => {
    // Los archivados no cuentan: salieron de la lista de trabajo a proposito.
    if (p.status === "inactive") return false;
    const consents =
      (p.patient_consents as { consent_type: string; revoked_at: string | null }[] | null) ?? [];
    const vigentes = consents.filter((c) => c.revoked_at === null).map((c) => c.consent_type);
    const sinAutorizacion = NECESARIAS.some((n) => !vigentes.includes(n));
    const evals = ((p.evaluations as FilaEval[] | null) ?? []).filter((e) => e.superseded_at == null);
    const r = pendienteDelPaciente(
      evals.map((e) => ({
        evaluationId: e.id,
        status: e.status,
        tieneBis: (e.bis_measurements ?? []).length > 0,
        tieneDiagnostico: (e.diagnoses ?? []).length > 0,
        reporte: e.reports?.[0]?.status ?? null,
      })),
      sinAutorizacion,
    );
    return r.principal != null;
  }).length;

  const uno = <T,>(e: T | T[] | null | undefined): T | undefined =>
    Array.isArray(e) ? e[0] : (e ?? undefined);

  const proximasConsultas: ProximaConsulta[] = ((citas.data ?? []) as unknown as {
    proxima_cita: string;
    diagnoses: unknown;
  }[])
    .slice(0, 3)
    .map((t) => {
      const dx = uno(
        t.diagnoses as { evaluation_id: string; evaluations: unknown } | null,
      );
      const ev = uno((dx?.evaluations ?? null) as { patients: unknown } | null);
      const pac = uno((ev?.patients ?? null) as { patient_profiles: unknown } | null);
      const perfil = uno(
        (pac?.patient_profiles ?? null) as { first_name: string; last_name: string } | null,
      );
      return {
        evaluationId: dx?.evaluation_id ?? "",
        paciente: `${perfil?.first_name ?? ""} ${perfil?.last_name ?? ""}`.trim() || "Paciente",
        fecha: t.proxima_cita,
      };
    })
    .filter((c) => c.evaluationId !== "");

  const suma = (filas: { [k: string]: unknown }[] | null, campo: string): number =>
    (filas ?? []).reduce((n, f) => n + Number(f[campo] ?? 0), 0);

  return {
    pacientesConPendiente: conPendiente,
    reportesPorAprobar: reportes.count ?? 0,
    proximasConsultas,
    comisionDelMes: suma(comision.data, "commission_amount"),
    ventasDelMes: suma(ventas.data, "amount"),
    unidadesEnInventario: suma(inventario.data, "stock_quantity"),
  };
}
