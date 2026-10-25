import "server-only";

import { reportServerError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  filaDelRoster,
  ordenarElRoster,
  type EvaluacionDelRoster,
  type FilaCrudaDelRoster,
} from "../roster-fila";
import type { DocumentType, PatientListItem } from "../types";

// Roster de pacientes para la UI autenticada (regla 1). Cliente anon + RLS: la vista
// `pacientes_del_roster` se declaro con `security_invoker = true`, asi que las policies de `patients`,
// `patient_profiles`, `patient_consents` y `evaluations` siguen decidiendo quien ve que: el profesional
// solo los suyos (via is_patient_professional) y admin todos. La app no filtra por profesional (regla 3).

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

// ═══ UNA FILA POR PACIENTE, NO 8,3 (0228) ═══
//
// Antes esta funcion pedia `patients` con cuatro embeds y, dentro del de evaluaciones, otros cuatro:
// ~4.598 filas para pintar 553. Cada fila embebida paga su policy, que es lo que midio la 0222 (489 ms
// sin RLS contra timeout con ella). La vista resuelve los HECHOS en la base y devuelve una fila por
// paciente; las REGLAS siguen en TypeScript, en `roster-fila.ts`, en una sola escritura.
//
// LAS COLUMNAS SE PIDEN UNA POR UNA Y NO CON `*`: un `*` traeria lo que la vista gane manana sin que
// nadie lo decida, y esta consulta existe precisamente para no traer lo que no se pinta.
const COLUMNAS =
  "patient_id, created_at, document_type, document_number, status, cuenta_como_de_prueba, " +
  "test_proposed_at, first_name, last_name, birth_date, consentimientos_vigentes, evaluaciones";

/** Lo que la vista devuelve en sus dos columnas jsonb, antes de que TypeScript decida nada. */
type FilaDeLaVista = {
  patient_id: string;
  created_at: string;
  document_type: string;
  document_number: string;
  status: string;
  cuenta_como_de_prueba: boolean | null;
  test_proposed_at: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  consentimientos_vigentes: { consent_type: string; signed_at: string | null }[] | null;
  evaluaciones: EvaluacionDelRoster[] | null;
};

// LA FUNCION QUE LANZABA (`listPatientsForProfessional`) SE RETIRO, no se dejo envolviendo a esta. Dejarla
// habria sido una puerta abierta a volver al 500 con una sola linea: el siguiente llamador la habria usado
// por tener el nombre mas corto. Si hace falta un lector que lance, se decide entonces y se escribe con su
// razon.
export async function readRosterDePacientes(): Promise<RosterDePacientes> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("pacientes_del_roster").select(COLUMNAS);
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

  const items = ((data ?? []) as unknown as FilaDeLaVista[]).map((row) =>
    filaDelRoster(crudaDeLaVista(row)),
  );
  return { ok: true, items: ordenarElRoster(items) };
}

/**
 * De la fila de la vista a los hechos que el mapeo compartido espera.
 *
 * ESTA FUNCION ES EXPORTADA A PROPOSITO: la prueba de inercia arma la MISMA fila por el camino viejo (la
 * cadena de embeds) y por este, y compara los resultados. Sin un punto de entrada comun, la comparacion
 * tendria que reescribir el mapeo y no probaria nada.
 */
export function crudaDeLaVista(row: FilaDeLaVista): FilaCrudaDelRoster {
  return {
    patientId: row.patient_id,
    createdAt: row.created_at,
    documentType: row.document_type as DocumentType,
    documentNumber: row.document_number,
    status: row.status,
    cuentaComoDePrueba: row.cuenta_como_de_prueba === true,
    testProposedAt: row.test_proposed_at,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    birthDate: row.birth_date,
    consentimientosVigentes: row.consentimientos_vigentes ?? [],
    evaluaciones: row.evaluaciones ?? [],
  };
}
