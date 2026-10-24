import "server-only";

import { reportServerError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ConsentType } from "@/modules/consent/validations";
import {
  hechosDelConsentimiento,
  motivoDeRegularizacion,
} from "@/modules/consent/regularizacion";
import { canCreateEvaluation } from "@/modules/evaluations/policies/can-create-evaluation";

import { NON_COUNTING_EVALUATION_STATUSES } from "../labels";
import { pendienteDelPaciente } from "../pendientes";
import type { DocumentType, PatientListItem } from "../types";

// Roster de pacientes para la UI autenticada (regla 1). Cliente anon + RLS:
// patients_select / patient_profiles_select dejan al profesional ver solo los suyos
// (via is_patient_professional) y a admin todos. La app no filtra por profesional, lo
// hace RLS (regla 3). El conteo de evaluaciones va por embed, tambien gateado por RLS.

type ProfileEmbed = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
};

function one<T>(embed: T | T[] | null): T | undefined {
  return Array.isArray(embed) ? embed[0] : (embed ?? undefined);
}

// ═══ SI LA LISTA NO SE PUEDE TRAER, LA PANTALLA LO DICE (Sentry, 2026-10-23) ═══
//
// ── EL CASO ──────────────────────────────────────────────────────────────────────────────────────
//
// `canceling statement due to statement timeout`, cuatro eventos, Unhandled, en `GET /pacientes`. Esta
// funcion LANZABA, la excepcion salia del Server Component, la peticion moria con un 500 y la pantalla
// quedaba caida: ni la lista, ni las cifras, ni una frase. El profesional no podia ni saber que habia
// pasado ni que hacer.
//
// ── EL FRENO ES DE LA BASE Y ESTA BIEN QUE EXISTA. LA FORMA DEL FALLO NO ──────────────────────────
//
// El `statement_timeout` protege la base de una consulta que se desboca. Lo que estaba mal es que una
// consulta cancelada se tratara como un fallo del sistema. Es la MISMA leccion del sexo y de la
// capacitancia de 16,22 nF, por tercera vez: la regla se queda, el rechazo se traduce.
//
// ── Y POR QUE UN RESULTADO Y NO UN `catch` EN LA PAGINA ───────────────────────────────────────────
//
// Porque la pagina necesita distinguir "no hay pacientes" de "no se pudieron traer", y esas dos cosas
// con un arreglo vacio son indistinguibles. Una lista vacia que en realidad es un fallo le dice al
// profesional que sus pacientes desaparecieron, que es peor que el 500.
export type RosterDePacientes =
  | { ok: true; items: PatientListItem[] }
  /** `demasiado` = la base canceló la consulta por tiempo; el remedio que se ofrece es distinto. */
  | { ok: false; demasiado: boolean; message: string };

// El codigo de Postgres para `query_canceled` (lo que emite el statement_timeout). Se mira el codigo y no
// el texto del mensaje: el texto viene en el idioma del servidor y cambia entre versiones.
const QUERY_CANCELED = "57014";

// LA FUNCION QUE LANZABA (`listPatientsForProfessional`) SE RETIRO, no se dejo envolviendo a esta. Dejarla
// habria sido una puerta abierta a volver al 500 con una sola linea: el siguiente llamador la habria usado
// por tener el nombre mas corto. Si hace falta un lector que lance, se decide entonces y se escribe con su
// razon.
export async function readRosterDePacientes(): Promise<RosterDePacientes> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("patients")
    .select(
      // superseded_at por evaluacion (no `evaluations(count)`): el conteo debe excluir las
      // reemplazadas por correccion (contarlas infla el numero de consultas del paciente). Se cuentan
      // las vigentes del lado del cliente; el volumen por paciente es chico y va gateado por RLS.
      // EL DIAGNOSTICO Y EL REPORTE entran en la MISMA consulta, para la columna de pendientes: sin
      // ellos no se puede decir si lo que falta es generar el diagnostico o enviar el reporte. Es un
      // embed mas en la consulta que ya se hacia, no una consulta nueva por paciente.
      // `created_at` DEL PACIENTE (no de su evaluacion): es la columna "Fecha de creacion", y la tiene
      // tambien quien no tiene ninguna evaluacion, que es justo cuando mas informa.
      // `retirada_at` (0212): la consulta que NO OCURRIO no cuenta en ninguna de las cifras de esta fila.
      "id, created_at, document_type, document_number, status, is_test, cuenta_como_de_prueba, test_proposed_at, patient_profiles!inner(first_name, last_name, birth_date), patient_consents(consent_type, revoked_at, signed_at), evaluations(id, type, superseded_at, retirada_at, status, created_at, import_batch_id, bis_measurements(measurement_date), evaluation_bis_intake(evaluation_id), diagnoses(id), reports(status))",
    )
    .is("deleted_at", null);
  if (error) {
    // SE REPORTA IGUAL: que la pantalla no reviente no significa que el fallo deje de contarse. Sentry es
    // lo que destapo este caso, y sin el aviso el timeout se volveria invisible.
    reportServerError(
      "pacientes.roster",
      new Error(`${error.code ?? "sin-codigo"}: ${error.message}`),
    );
    const demasiado = error.code === QUERY_CANCELED;
    return {
      ok: false,
      demasiado,
      message: demasiado
        ? "La lista de pacientes tardó demasiado y la base canceló la consulta. No es que no tengas pacientes: no se pudieron traer en este intento. Vuelve a intentarlo; si sigue pasando, avísale a quien administra Atlas."
        : "No se pudo traer la lista de pacientes. Vuelve a intentarlo; si sigue pasando, avísale a quien administra Atlas.",
    };
  }

  const items = (data ?? []).map((row) => {
    const profile = one<ProfileEmbed>(
      row.patient_profiles as ProfileEmbed | ProfileEmbed[] | null,
    );
    // Cuenta solo evaluaciones REALES: vigentes (no supersedidas) y que no sean un shell firmado sin
    // responder ni una abandonada (esas existen pero no son una evaluacion hecha).
    const evals =
      (row.evaluations as
        | {
            id: string;
            type: string;
            superseded_at: string | null;
            retirada_at: string | null;
            status: string;
            created_at: string;
            import_batch_id: string | null;
            bis_measurements: { measurement_date: string | null }[] | null;
            evaluation_bis_intake: { evaluation_id: string }[] | null;
            diagnoses: { id: string }[] | null;
            reports: { status: string }[] | null;
          }[]
        | null) ?? [];
    // Las que CUENTAN: vigentes y que sean una evaluacion hecha. La misma condicion sirve para el
    // conteo y para la ultima fecha; separarlas dejaria "3 consultas · Ultima: <de una reemplazada>".
    // ── Y LA QUE NO OCURRIO TAMPOCO CUENTA (0212, Santiago 2026-10-07) ──────────────────────────────
    //
    // Retirarla ocultaba la fila en la FICHA del paciente y la dejaba intacta aqui: su conteo de consultas,
    // su "ultima evaluacion" y sus tres mas recientes seguian contandola. Dos pantallas diciendo cosas
    // distintas de la misma consulta, que es el defecto que mas nos ha costado.
    const enPie = evals.filter((e) => e.superseded_at == null && e.retirada_at == null);
    const reales = enPie.filter((e) => !NON_COUNTING_EVALUATION_STATUSES.has(e.status));
    // FECHA DE MEDICION, no la de creacion del registro: es la cronologia clinica, la misma que usa la
    // ficha del paciente. Si no se midio, cae a created_at para no perder la fila del listado.
    const fechas = reales
      .map((e) => e.bis_measurements?.[0]?.measurement_date ?? e.created_at)
      .filter(Boolean)
      .sort();
    // AUTORIZACIONES VIGENTES, para avisar en la LISTA y no al intentar (hallazgo 2026-08-28: hoy el
    // profesional descubre el bloqueo de la regla dura 15 cuando ya esta creando la evaluacion). Se
    // pregunta a la MISMA policy que gatea la creacion, no a una copia del criterio: la regla vive en un
    // solo sitio, asi que la lista y el gate no pueden discrepar.
    const consents =
      (row.patient_consents as
        | { consent_type: string; revoked_at: string | null; signed_at: string | null }[]
        | null) ?? [];
    const soloVigentes = consents.filter((c) => c.revoked_at === null);
    const vigentes = soloVigentes.map((c) => c.consent_type as ConsentType);
    // ── EL SEGUNDO INSUMO DEL GATE (pieza 2) ────────────────────────────────────────────────────────
    //
    // Los HECHOS se arman con la funcion compartida y no a mano aqui, para que la lista y la ficha no
    // puedan decir cosas distintas del mismo paciente.
    //
    // SIN LAS SESIONES PRESENCIALES, y es una ausencia deliberada: el motivo que sale de ellas (una fecha
    // corregida que cambia la rama) NO frena evaluaciones, asi que no cambia esta columna, y traerlas
    // costaria un embed mas en la consulta de TODO el roster. Ese motivo se ve en la ficha, que es donde
    // se puede actuar sobre el.
    const regularizar = motivoDeRegularizacion(
      hechosDelConsentimiento({
        fechaDeNacimiento: profile?.birth_date ?? null,
        consents: soloVigentes,
      }),
    );
    return {
      patientId: row.id,
      createdAt: row.created_at as string,
      documentType: row.document_type as DocumentType,
      documentNumber: row.document_number,
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      birthDate: profile?.birth_date ?? null,
      status: row.status,
      evaluationCount: reales.length,
      lastEvaluationDate: fechas.length ? fechas[fechas.length - 1] : null,
      // SOLO LAS QUE FALTAN, y por eso pasa `null` aqui: este rotulo dice "Sin autorizacion vigente", y
      // un menor sin representante NO retiro ninguna. Meter los dos casos en el mismo booleano hacia que la
      // lista afirmara una revocacion que no existe y mandara al profesional a pedir algo que ya tiene.
      sinAutorizacionVigente: !canCreateEvaluation(vigentes, null).ok,
      // EL MOTIVO, dicho para que la lista pueda rotularlo sin volver a derivarlo.
      pendienteDeRegularizar: regularizar,
      // QUE LE FALTA, dicho como accion. La regla vive en un modulo puro (`pendientes.ts`) para que se
      // pueda probar corriendola; aqui solo se le pasan los hechos. Se mira sobre `enPie` (ni supersedidas
      // ni retiradas), no sobre `reales`: una que espera la encuesta no cuenta como consulta hecha pero SI
      // es algo pendiente, que es justo lo que esta columna busca.
      // LAS TRES ULTIMAS, con su rotulo. La NUMERACION del seguimiento sale del orden entre las
      // evaluaciones REALES del paciente (el primer seguimiento es el 1, no el numero de fila), asi que se
      // calcula aqui, que es donde estan todas juntas. La vista solo pinta.
      ultimasEvaluaciones: (() => {
        const enOrden = [...reales].sort((a, b) =>
          (a.bis_measurements?.[0]?.measurement_date ?? a.created_at).localeCompare(
            b.bis_measurements?.[0]?.measurement_date ?? b.created_at,
          ),
        );
        let n = 0;
        const conRotulo = enOrden.map((e) => {
          const rotulo = e.type === "inicial" ? "Inicial" : `Seguimiento ${++n}`;
          return {
            evaluationId: e.id,
            rotulo,
            fecha: e.bis_measurements?.[0]?.measurement_date ?? e.created_at,
          };
        });
        // LAS ULTIMAS TRES, y de la mas reciente a la mas antigua: es el orden en que se buscan.
        return conRotulo.slice(-3).reverse();
      })(),
      pendiente: pendienteDelPaciente(
        enPie
          .map((e) => ({
            evaluationId: e.id,
            status: e.status,
            tieneBis: (e.bis_measurements ?? []).length > 0,
            importada: e.import_batch_id != null,
            tieneCondicionesBis: (e.evaluation_bis_intake ?? []).length > 0,
            tieneDiagnostico: (e.diagnoses ?? []).length > 0,
            reporte: e.reports?.[0]?.status ?? null,
          })),
        !canCreateEvaluation(vigentes, regularizar).ok,
      ),
      // LA LISTA SI LOS MUESTRA (capa de TRABAJO), marcados. El conteo del tablero no los cuenta.
      // LA DERIVADA (0202): si sus cifras lo excluyen, su ficha tiene que decirlo. Mostrar la marca solo
      // cuando alguien la escribio a mano dejaria al profesional viendo un paciente sin rotulo que las
      // cifras ya no cuentan, y esa contradiccion entre pantalla y cifra es la que mas cuesta diagnosticar.
      esDePrueba: row.cuenta_como_de_prueba === true,
      propuestoDePrueba: row.cuenta_como_de_prueba !== true && row.test_proposed_at != null,
    } satisfies PatientListItem;
  });

  // Orden alfabetico POR EL NOMBRE COMO SE MUESTRA ("nombre apellido"), no por apellido (2026-09-09).
  //
  // Ordenaba por "apellido nombre" mientras la lista pinta "nombre apellido", asi que se veia desordenada:
  // ordenaba por algo que no esta a la vista (lo cazo Santiago). La vista tiene ademas su propio orden
  // (conmutador A-Z / evaluacion reciente); esto es la base estable con la que llega, y las dos tienen que
  // decir lo mismo: dos ordenes distintos en dos capas es como se consigue que la lista salte al hidratar.
  items.sort((a, b) =>
    `${a.firstName} ${a.lastName}`.trim().localeCompare(`${b.firstName} ${b.lastName}`.trim(), "es"),
  );
  return { ok: true, items };
}
