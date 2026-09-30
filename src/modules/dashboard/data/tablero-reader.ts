import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  brutoReconocido,
  COLUMNA_EFECTIVO_NO_RECIBIDO,
  COLUMNA_PRODUCTO_DE_PRUEBA,
  EMBED_PRODUCTO_NO_DE_PRUEBA,
  ESTADO_DEVUELTA,
  ESTADO_DISPUTA_PERDIDA,
  FILTRO_FUERA_DE_REVISION,
} from "@/modules/payments/cobro-reconocido";
import { desdeElArranque, elMasTardio, fechaDeArranque } from "@/modules/payments/data/fecha-de-arranque";
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
  // "REPORTES POR APROBAR" SE RETIRO (2026-09-18): con la aprobacion retirada, un reporte en borrador no
  // es un pendiente de nadie, es el estado normal de la fila que crea el pipeline. La tarjeta habria
  // pintado para siempre un numero que solo sube y que nadie puede bajar, y el pendiente que SI importa
  // ("no se le envio al paciente") ya lo dice el cierre de la consulta.
  /** Las TRES proximas, como listado. Ver la nota de la pantalla sobre por que no es un numero. */
  proximasConsultas: ProximaConsulta[];
  /** Comision del profesional en el mes en curso, en pesos. */
  comisionDelMes: number;
  /** Ventas del mes en curso (transacciones pagadas), en pesos. */
  ventasDelMes: number;
  /** Unidades en inventario de nutraceuticos. */
  unidadesEnInventario: number;
  /**
   * Null salvo en el mes del arranque: entonces las dos cifras del mes NO son del mes entero, sino desde
   * ese dia, y la pantalla tiene que decirlo o el profesional leera un mes flojo que nunca existio.
   */
  desdeElArranque: string | null;
};

function inicioDelMes(): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString();
}

export async function getTablero(): Promise<Tablero> {
  const supabase = await createSupabaseServerClient();
  // ── EL MES EN CURSO, PERO NUNCA ANTES DEL ARRANQUE (0198) ──
  //
  // El mes empieza el dia 1; si el arranque cae a mitad de mes, lo que hay que contar empieza en el
  // arranque. Sin esto, la primera tarjeta del mes del arranque sumaria las pruebas de los dias
  // anteriores, que es justo lo que la fecha viene a evitar. Los meses siguientes no lo notan.
  const arranque = await fechaDeArranque();
  const desde = elMasTardio(inicioDelMes(), desdeElArranque(arranque));
  // Solo se avisa cuando el corte MUERDE: en los meses siguientes la cifra vuelve a ser del mes entero y
  // un aviso permanente seria ruido que nadie lee.
  const recortaElMes = desde !== inicioDelMes() ? arranque : null;

  const [pacientes, citas, comision, ventas, perdidas, devueltas, inventario] = await Promise.all([
    // LOS PENDIENTES SALEN DE LA MISMA REGLA QUE LA COLUMNA (`pendienteDelPaciente`), no de un conteo
    // paralelo: si aqui se contara "evaluaciones en progreso" y alli se dijera otra cosa, el tablero y la
    // lista discreparian sobre el mismo paciente.
    supabase
      .from("patients")
      .select(
        "id, status, patient_consents(consent_type, revoked_at), evaluations(id, superseded_at, status, import_batch_id, bis_measurements(id), evaluation_bis_intake(evaluation_id), diagnoses(id), reports(status))",
      )
      .is("deleted_at", null)
      // FUERA LOS DE PRUEBA: esto es una CIFRA (ver `patients/de-prueba.ts`, capa 1). Un profesional que se
      // creo a si mismo como paciente para probar veia su tablero diciendo un paciente mas, y lo mismo sus
      // pendientes. La LISTA si los muestra, marcados, porque ahi es donde se trabaja con ellos.
      .eq("is_test", false),
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
    // Sin las ventas en revision: su dinero es un pasivo hasta resolverse (contabilidad, 2026-09-14).
    supabase.from("transactions").select("id, amount").eq("status", "paid").or(FILTRO_FUERA_DE_REVISION).is(COLUMNA_EFECTIVO_NO_RECIBIDO, null).gte("created_at", desde),
    // LO QUE VOLVIO NO SE FACTURO, y esta tarjeta no lo restaba (smoke del 2026-09-29): la venta devuelta de
    // LUVIA seguia en el bruto, 90.000 de mas. La cuenta la hace ahora el mismo modulo neutro que Direccion.
    supabase.from("sale_reversals").select("transaction_id").eq("state", ESTADO_DISPUTA_PERDIDA),
    // ACOTADA AL MISMO PERIODO QUE LAS VENTAS, y esto no es un detalle: esta tarjeta es DEL MES. Restar una
    // devolucion de una venta de otro mes bajaria un bruto que nunca subio, y la cifra quedaria mal por el
    // lado contrario. Se acota por la FECHA DE LA VENTA (el embed), no por la de la devolucion, porque lo
    // que se corrige es lo que ese mes facturo.
    supabase
      .from("sale_reversals")
      .select("debited_amount, transactions!inner(created_at)")
      .eq("state", ESTADO_DEVUELTA)
      .gte("transactions.created_at", desde),
    // SIN PRODUCTOS DE PRUEBA, igual que Direccion (smoke del 2026-09-29): esta tarjeta decia 1.903 y la de
    // Direccion 1.820 sobre el mismo hecho, y las 83 de diferencia eran saldo de los productos de prueba,
    // que no se puede borrar porque los movimientos son inmutables.
    supabase
      .from("nutraceutical_inventory")
      .select(`stock_quantity, ${EMBED_PRODUCTO_NO_DE_PRUEBA}`)
      .eq(COLUMNA_PRODUCTO_DE_PRUEBA, false),
  ]);

  type FilaEval = {
    id: string;
    superseded_at: string | null;
    status: string;
    import_batch_id: string | null;
    bis_measurements: { id: string }[] | null;
    evaluation_bis_intake: { evaluation_id: string }[] | null;
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
        importada: e.import_batch_id != null,
        tieneCondicionesBis: (e.evaluation_bis_intake ?? []).length > 0,
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
    proximasConsultas,
    comisionDelMes: suma(comision.data, "commission_amount"),
    ventasDelMes: brutoReconocido({
      pagadas: ventas.data ?? [],
      disputasPerdidas: (perdidas.data ?? []).map((r) => r.transaction_id),
      devoluciones: (devueltas.data ?? []).map((r) => r.debited_amount),
    }),
    unidadesEnInventario: suma(inventario.data, "stock_quantity"),
    desdeElArranque: recortaElMes,
  };
}
