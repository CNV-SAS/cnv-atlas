import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { ConsentType } from "@/modules/consent/validations";
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

export async function listPatientsForProfessional(): Promise<PatientListItem[]> {
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
      "id, document_type, document_number, status, patient_profiles!inner(first_name, last_name, birth_date), patient_consents(consent_type, revoked_at), evaluations(id, type, superseded_at, status, created_at, bis_measurements(measurement_date), diagnoses(id), reports(status))",
    )
    .is("deleted_at", null);
  if (error) {
    throw new Error(`patients-list-reader: listPatientsForProfessional: ${error.message}`);
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
            status: string;
            created_at: string;
            bis_measurements: { measurement_date: string | null }[] | null;
            diagnoses: { id: string }[] | null;
            reports: { status: string }[] | null;
          }[]
        | null) ?? [];
    // Las que CUENTAN: vigentes y que sean una evaluacion hecha. La misma condicion sirve para el
    // conteo y para la ultima fecha; separarlas dejaria "3 consultas · Ultima: <de una reemplazada>".
    const reales = evals.filter(
      (e) => e.superseded_at == null && !NON_COUNTING_EVALUATION_STATUSES.has(e.status),
    );
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
      (row.patient_consents as { consent_type: string; revoked_at: string | null }[] | null) ?? [];
    const vigentes = consents
      .filter((c) => c.revoked_at === null)
      .map((c) => c.consent_type as ConsentType);
    return {
      patientId: row.id,
      documentType: row.document_type as DocumentType,
      documentNumber: row.document_number,
      firstName: profile?.first_name ?? "",
      lastName: profile?.last_name ?? "",
      birthDate: profile?.birth_date ?? null,
      status: row.status,
      evaluationCount: reales.length,
      lastEvaluationDate: fechas.length ? fechas[fechas.length - 1] : null,
      sinAutorizacionVigente: !canCreateEvaluation(vigentes).ok,
      // QUE LE FALTA, dicho como accion. La regla vive en un modulo puro (`pendientes.ts`) para que se
      // pueda probar corriendola; aqui solo se le pasan los hechos. Se mira sobre las evaluaciones
      // VIGENTES (no supersedidas), no sobre `reales`: una que espera la encuesta no cuenta como consulta
      // hecha pero SI es algo pendiente, que es justo lo que esta columna busca.
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
        evals
          .filter((e) => e.superseded_at == null)
          .map((e) => ({
            evaluationId: e.id,
            status: e.status,
            tieneBis: (e.bis_measurements ?? []).length > 0,
            tieneDiagnostico: (e.diagnoses ?? []).length > 0,
            reporte: e.reports?.[0]?.status ?? null,
          })),
        !canCreateEvaluation(vigentes).ok,
      ),
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
  return items;
}
