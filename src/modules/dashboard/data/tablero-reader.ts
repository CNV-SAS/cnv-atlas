import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  brutoReconocido,
  COLUMNA_VENTA_DE_PRUEBA,
  COLUMNA_EFECTIVO_NO_RECIBIDO,
  COLUMNA_PRODUCTO_DE_PRUEBA,
  EMBED_PRODUCTO_NO_DE_PRUEBA,
  ESTADO_DEVUELTA,
  ESTADO_DISPUTA_PERDIDA,
  FILTRO_FUERA_DE_REVISION,
} from "@/modules/payments/cobro-reconocido";
import { hoyEnColombia, inicioDelMesEnBogota } from "@/modules/payments/arranque";
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
  /**
   * Si quien mira TIENE perfil profesional. Sin el, las tres cifras de "Tu mes" serian ceros que no
   * significan nada, y un cero sin significado se lee como "no vendi" en vez de "esto no es tuyo".
   */
  esIntegrante: boolean;
};

// EL CORTE DEL MES VIVE EN EL MODULO NEUTRO (ver `arranque.ts`): es aritmetica de fechas y tiene que
// poder probarse con un reloj fijo, que es la unica forma de atrapar un error de zona horaria.
const inicioDelMes = () => inicioDelMesEnBogota(new Date());

export async function getTablero(userId: string): Promise<Tablero> {
  const supabase = await createSupabaseServerClient();

  // ═══ "TU MES" TIENE QUE SER SUYO, Y LA RLS NO ALCANZA A DECIRLO (Santiago, 2026-10-01) ═══
  //
  // ESTE ARCHIVO DECIA, Y ERA MIO: "no se filtra por profesional: se pregunta con su sesion y la RLS decide
  // que ve. Un filtro escrito aqui seria una segunda copia de la regla de alcance". El razonamiento vale
  // para un INTEGRANTE y se rompe para un ADMIN: su RLS le deja ver TODAS las ventas, asi que su tarjeta
  // "Tu mes" le mostraba el mes de la organizacion entera, incluida la cuenta de demostracion.
  //
  // El sintoma que lo destapo: /direccion decia 0 pagos y su Inicio decia 11.900 de las MISMAS ventas. Una
  // cifra no estaba mal: estaban contestando preguntas distintas, y solo una lo decia en su rotulo.
  //
  // ASI QUE EL ALCANCE SE ESCRIBE. No es duplicar la RLS: la RLS dice QUE PUEDE VER, y esta tarjeta promete
  // algo mas estrecho, LO SUYO. Cuando las dos cosas no coinciden, la que manda es la promesa del rotulo.
  const { data: suPerfil } = await supabase
    .from("professional_profiles")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  const miProfesional = suPerfil?.id ?? null;
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
        // `retirada_at` (0212): una consulta que no ocurrio no es un pendiente de nadie.
        "id, status, patient_consents(consent_type, revoked_at), evaluations(id, superseded_at, retirada_at, status, import_batch_id, bis_measurements(id), evaluation_bis_intake(evaluation_id), diagnoses(id), reports(status))",
      )
      .is("deleted_at", null)
      // FUERA LOS DE PRUEBA: esto es una CIFRA (ver `patients/de-prueba.ts`, capa 1). Un profesional que se
      // creo a si mismo como paciente para probar veia su tablero diciendo un paciente mas, y lo mismo sus
      // pendientes. La LISTA si los muestra, marcados, porque ahi es donde se trabaja con ellos.
      // LA DERIVADA, no la decision (0202): un paciente de un profesional de prueba cuenta como de prueba
      // sin que nadie lo marque. Filtrar por `is_test` dejaria fuera la derivacion.
      .eq("cuenta_como_de_prueba", false),
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
      // LA FECHA DE HOY EN COLOMBIA, no en UTC: despues de las 7 de la tarde `toISOString()` ya devuelve el
      // dia siguiente, y las citas de HOY desaparecian de "tus proximas consultas" justo al final de la
      // jornada. Es el mismo defecto que el corte del mes, encontrado el mismo dia.
      .gte("proxima_cita", hoyEnColombia())
      .order("proxima_cita", { ascending: true })
      .limit(4),
    // ═══ LA COMISION DEL MES SE ANCLA A LA FECHA DE LA VENTA, NO A LA DE SU FILA (Santiago, 2026-09-30) ═══
    //
    // LAS DOS TARJETAS DE ESTA MISMA PANTALLA SE CONTRADECIAN. Una venta retroactiva escribe su
    // `transactions.created_at` en la fecha real (es el unico camino de la app que lo hace), pero su fila de
    // comision nace HOY. Asi que al registrar una venta de enero: "Ventas" no se movia (correcto, no es de
    // este mes) y "Tu comisión" subia 5.042. El mismo mes, la misma venta, dos respuestas.
    //
    // Y es la clase de contradiccion que ya nos costo un diagnostico equivocado: no es que una este mal, es
    // que LEEN FUENTES DISTINTAS. Se une la fuente, y la que manda es la de la venta.
    //
    // POR QUE LA DE LA VENTA Y NO LA DE LA FILA: es la convencion que este mismo archivo ya aplica a las
    // devoluciones ("se acota por la FECHA DE LA VENTA, porque lo que se corrige es lo que ese mes
    // facturo"). Tener dos criterios para el mismo mes es como se llega aqui otra vez.
    miProfesional
      ? supabase
          .from("professional_revenue")
          .select("commission_amount, transaction_id, transactions!inner(created_at, patient_id)")
          .eq("professional_id", miProfesional)
          .gte("transactions.created_at", desde)
      : Promise.resolve({
          data: [] as { commission_amount: string; transaction_id: string; transactions: unknown }[],
        }),
    // Sin las ventas en revision: su dinero es un pasivo hasta resolverse (contabilidad, 2026-09-14).
    miProfesional
      ? supabase.from("transactions").select("id, amount, patient_id").eq("status", "paid").eq("professional_id", miProfesional).or(FILTRO_FUERA_DE_REVISION).is(COLUMNA_EFECTIVO_NO_RECIBIDO, null).gte("created_at", desde)
      : Promise.resolve({ data: [] as { id: string; amount: string; patient_id: string | null }[] }),
    // LO QUE VOLVIO NO SE FACTURO, y esta tarjeta no lo restaba (smoke del 2026-09-29): la venta devuelta de
    // LUVIA seguia en el bruto, 90.000 de mas. La cuenta la hace ahora el mismo modulo neutro que Direccion.
    supabase.from("sale_reversals").select("transaction_id").eq("state", ESTADO_DISPUTA_PERDIDA),
    // ACOTADA AL MISMO PERIODO QUE LAS VENTAS, y esto no es un detalle: esta tarjeta es DEL MES. Restar una
    // devolucion de una venta de otro mes bajaria un bruto que nunca subio, y la cifra quedaria mal por el
    // lado contrario. Se acota por la FECHA DE LA VENTA (el embed), no por la de la devolucion, porque lo
    // que se corrige es lo que ese mes facturo.
    supabase
      .from("sale_reversals")
      .select("debited_amount, transaction_id, transactions!inner(created_at, patient_id)")
      .eq("state", ESTADO_DEVUELTA)
      .gte("transactions.created_at", desde),
    // SIN PRODUCTOS DE PRUEBA, igual que Direccion (smoke del 2026-09-29): esta tarjeta decia 1.903 y la de
    // Direccion 1.820 sobre el mismo hecho, y las 83 de diferencia eran saldo de los productos de prueba,
    // que no se puede borrar porque los movimientos son inmutables.
    // Y LAS UNIDADES TAMBIEN SON LAS SUYAS: la tarjeta dice "unidades en inventario" en SU pantalla, asi que
    // es su vitrina. A un admin le mostraba el saldo de la organizacion entera, que es la cifra de /direccion
    // con otro rotulo.
    miProfesional
      ? supabase
          .from("nutraceutical_inventory")
          .select(`stock_quantity, ${EMBED_PRODUCTO_NO_DE_PRUEBA}`)
          .eq("professional_id", miProfesional)
          .eq(COLUMNA_PRODUCTO_DE_PRUEBA, false)
      : Promise.resolve({ data: [] as { stock_quantity: number }[] }),
  ]);

  type FilaEval = {
    id: string;
    superseded_at: string | null;
    retirada_at: string | null;
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
    const evals = ((p.evaluations as FilaEval[] | null) ?? []).filter(
      (e) => e.superseded_at == null && e.retirada_at == null,
    );
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

  // Y LAS VENTAS QUE NO CUENTAN, de la MISMA columna que Direccion (0203): la regla vive en la base, asi que
  // las dos pantallas no pueden volver a discrepar sobre la misma venta.
  const { data: ventasMarcadas } = await supabase
    .from("transactions")
    .select("id")
    .eq(COLUMNA_VENTA_DE_PRUEBA, true);
  const ventaDePrueba = new Set((ventasMarcadas ?? []).map((t) => t.id));
  const noEsVentaDePrueba = (id: string | null | undefined) => id == null || !ventaDePrueba.has(id);

  const suma = (filas: { [k: string]: unknown }[] | null, campo: string): number =>
    (filas ?? []).reduce((n, f) => n + Number(f[campo] ?? 0), 0);

  return {
    pacientesConPendiente: conPendiente,
    proximasConsultas,
    // ── Y SUS CIFRAS TAMPOCO CUENTAN AL PACIENTE DE PRUEBA (Santiago, 2026-10-01) ──
    //
    // El conteo de pacientes ya los excluia desde septiembre y sus VENTAS no: marcar un paciente sacaba su
    // diagnostico de las cifras y dejaba su dinero dentro. Un profesional que se registra a si mismo para
    // probar veia su propio mes inflado con sus pruebas, en la pantalla que usa para saber como le fue.
    comisionDelMes: suma(
      (comision.data ?? []).filter((r) => noEsVentaDePrueba(r.transaction_id)),
      "commission_amount",
    ),
    ventasDelMes: brutoReconocido({
      pagadas: (ventas.data ?? []).filter((r) => noEsVentaDePrueba(r.id)),
      disputasPerdidas: (perdidas.data ?? []).map((r) => r.transaction_id),
      devoluciones: (devueltas.data ?? [])
        .filter((r) => noEsVentaDePrueba(r.transaction_id))
        .map((r) => r.debited_amount),
    }),
    unidadesEnInventario: suma(inventario.data, "stock_quantity"),
    desdeElArranque: recortaElMes,
    esIntegrante: miProfesional != null,
  };
}
