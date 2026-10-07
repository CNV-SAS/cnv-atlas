"use server";

import { revalidatePath } from "next/cache";

import { getClientIp } from "@/core/http/client-ip";
import { reportServerError } from "@/lib/observability/report-error";
import { limitImportByUser } from "@/core/rate-limit";
import { getEvaluationOwnership, getPatientSex } from "@/modules/evaluations/data/evaluations-repository";
import { getBisIntakeForEvaluation } from "@/modules/bis-intake/data/bis-conditions-reader";
import { evaluarRequisitosDelImport } from "@/modules/bis-intake/services/import-gate";
import { computeSurveyGapsFromDomains } from "@/modules/clinical-pipeline/services/survey-completeness";
import { getSurveyAnswersForEvaluation } from "@/modules/evaluations/data/survey-answers-reader";
import { requireUser } from "@/modules/auth/session";

import { CircunferenciasNoEditablesError, guardarCircunferenciasTecleadas } from "./data/circunferencias-writer";
import { canImportBis } from "./policies/can-import-bis";
import { circunferenciasSchema } from "./validations/circunferencias";
import { importBisMeasurement } from "./services/bis-import";

// Estado del formulario de import (useActionState). Incluye la forma de
// FormToastState (error/success/warning) para que el componente dispare el toast con
// useFormToast; ademas lleva el detalle por variable y el resultado del import.
export type ImportBisState = {
  error: string | null;
  success: string | null;
  warning: string | null;
  fields: Record<string, string> | null;
  imported: boolean;
  valueCount: number | null;
  /** La fecha de la medicion que entro (AAAA-MM-DD). null en un fallo. */
  fechaImportada?: string | null;
  /**
   * Las otras mediciones del archivo, cuando traia varias. VACIO cuando traia una sola.
   *
   * La pantalla la usa para ofrecer cambiar de medicion: se tomo la mas reciente, y en una consulta
   * RETROACTIVA la que corresponde es la de la fecha de esa consulta. Sin esta lista, cambiarla obligaria a
   * editar el archivo a mano, que es justo lo que este cambio vino a quitar.
   */
  fechasDisponibles?: string[];
};

// Tope de tamano y MIME aceptados (SECURITY.md: allowlist + tope). El export real
// pesa pocos KB; 5 MB es muy holgado. La frontera de confianza real es el parser.
const MAX_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isAllowedXlsx(file: File): boolean {
  const okName = file.name.toLowerCase().endsWith(".xlsx");
  // Algunos navegadores no envian el MIME del xlsx; aceptamos el oficial, el generico
  // y vacio, apoyandonos en la extension y, sobre todo, en el parser.
  const okType = file.type === XLSX_MIME || file.type === "application/octet-stream" || file.type === "";
  return okName && okType;
}

// Server action del import BIS. Orden: auth -> policy (rol) -> rate limit por usuario
// -> ownership bajo RLS -> estado in_progress -> validacion de archivo -> orquestacion.
// La autorizacion fina (que la evaluacion sea de su paciente) la impone la RLS.
export async function importBisAction(
  _prev: ImportBisState,
  form: FormData,
): Promise<ImportBisState> {
  const fail = (error: string, fields: Record<string, string> | null = null): ImportBisState => ({
    error,
    success: null,
    warning: null,
    fields,
    imported: false,
    valueCount: null,
  });

  const user = await requireUser();
  if (!canImportBis(user)) return fail("No autorizado.");

  const evaluationId = (form.get("evaluationId") as string | null)?.trim() ?? "";
  if (!evaluationId) return fail("Evaluación inválida.");

  // Rate limit por usuario (acotado por hora) antes de leer el archivo.
  const rl = await limitImportByUser(user.id);
  if (!rl.success) return fail("Has hecho demasiados imports. Espera unos minutos.");

  // Ownership bajo RLS: la sesion debe poder leer la evaluacion (su paciente o admin).
  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return fail("Evaluación no encontrada.");
  // El BIS se importa despues de confirmar la identidad (draft -> in_progress).
  if (ownership.status !== "in_progress") {
    return fail("La evaluación no esta lista para importar BIS. Confirma la identidad primero.");
  }

  // EL GUARDIAN ES ESTE BOTON (Santiago, 2026-09-22): el bloque ya no se deshabilita en pantalla, y aqui
  // se exige todo junto: condiciones de la toma guardadas y sin contraindicacion (ST-B3: nada se guarda sin
  // ellas) y la encuesta al 100 %, contada como la cuenta el diagnostico. Si falta algo, se dice todo.
  const [intake, domains] = await Promise.all([
    getBisIntakeForEvaluation(evaluationId),
    getSurveyAnswersForEvaluation(evaluationId),
  ]);
  const gate = evaluarRequisitosDelImport(intake, domains ? computeSurveyGapsFromDomains(domains) : null);
  if (!gate.allowed) return fail(gate.message);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Adjunta el archivo XLSX exportado de Biody Manager.");
  }
  if (file.size > MAX_BYTES) {
    return fail("El archivo supera el tamaño máximo permitido (5 MB).");
  }
  if (!isAllowedXlsx(file)) {
    return fail("El archivo debe ser un XLSX exportado de Biody Manager.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ip = await getClientIp();
  // Sexo del paciente: habilita las referencias poblacionales de composicion (§9). Best-effort; si no
  // esta, el import sigue y esas referencias quedan sin derivar (ISCM null honesto), no se cae.
  const patientSex = await getPatientSex(ownership.patientId);
  const result = await importBisMeasurement({
    buffer,
    evaluationId,
    deviceId: null, // enlace de equipo diferido (B8 minimo)
    actorId: user.id,
    actorEmail: user.email,
    ip: ip === "unknown" ? null : ip,
    patientSex,
    // CUAL MEDICION, cuando el archivo trae varias. Vacio = la mas reciente, que es el camino normal.
    fechaElegida: ((form.get("fechaDeLaMedicion") as string | null) ?? "").trim() || undefined,
  });

  if (!result.ok) return fail(result.error.message, result.error.fields ?? null);

  revalidatePath("/ani-bis-e");
  // Tambien la vista de la evaluacion: al importar desde la pestana Evaluacion, la composicion
  // (que lee de bis_raw_values) debe aparecer sin recargar a mano.
  revalidatePath("/ani-bis-e/[id]", "page");
  // ═══ SE DICE CUAL MEDICION ENTRO, CUANDO EL ARCHIVO TRAIA VARIAS (2026-10-06) ═══
  //
  // La fecha de la medicion es un dato del REGISTRO CLINICO, no un detalle de la carga: decide la cronologia
  // del seguimiento. Con un archivo de varias filas, el profesional tiene que poder ver cual se importo sin
  // ir a buscarla, porque la que el queria puede no ser la ultima (una consulta retroactiva).
  const { filasEnElArchivo, fechaImportada, fechasDisponibles } = result.value;
  const varias = filasEnElArchivo > 1;
  return {
    error: null,
    // EL TOAST ES CORTO Y NO REPITE LAS CIFRAS (Santiago, 2026-10-06): el detalle de cuantas traia y cual
    // entro vive en el bloque de la pantalla, que se queda. Un toast se va en segundos, asi que decir ahi la
    // fecha de la medicion es decirla donde no se puede volver a leer.
    success: varias
      ? `Medición BIS importada. Se cargó la más reciente; puedes cambiarla en el selector.`
      : `Medición BIS importada (${result.value.valueCount} variables).`,
    warning: null,
    fields: null,
    imported: true,
    valueCount: result.value.valueCount,
    fechaImportada,
    // LAS OTRAS FECHAS VIAJAN para que la pantalla pueda ofrecer cambiar de medicion sin volver a subir el
    // archivo a ciegas. Vacio cuando solo habia una: entonces no hay nada que elegir.
    fechasDisponibles: varias ? fechasDisponibles : [],
  };
}

// ── LA CINTURA Y LA CADERA TECLEADAS (solo consultas importadas del HTML, 2026-09-22) ──────────────────
// La forma de FormToastState (error/success/warning), para que la pantalla dispare el toast y refresque.
export type CircunferenciasState = { error: string | null; success: string | null; warning: string | null };

export async function guardarCircunferenciasAction(
  _prev: CircunferenciasState,
  form: FormData,
): Promise<CircunferenciasState> {
  const user = await requireUser();
  if (!canImportBis(user)) return { error: "No autorizado.", success: null, warning: null };
  const evaluationId = String(form.get("evaluationId") ?? "");
  if (!evaluationId) return { error: "Evaluación inválida.", success: null, warning: null };
  // Ownership bajo RLS: la sesion debe poder leer la evaluacion (su paciente o admin).
  const ownership = await getEvaluationOwnership(evaluationId);
  if (!ownership) return { error: "Evaluación no encontrada.", success: null, warning: null };

  const datos = circunferenciasSchema.safeParse({
    cintura: String(form.get("cintura") ?? ""),
    cadera: String(form.get("cadera") ?? ""),
  });
  if (!datos.success) {
    return { error: datos.error.issues[0]?.message ?? "Revisa las medidas.", success: null, warning: null };
  }
  try {
    const ip = await getClientIp();
    const r = await guardarCircunferenciasTecleadas({
      evaluationId,
      cintura: datos.data.cintura,
      cadera: datos.data.cadera,
      actorId: user.id,
      actorEmail: user.email,
      ip: ip === "unknown" ? null : ip,
    });
    // SIN revalidatePath: la pantalla ya refresca con `useFormToastAndRefresh`, y los dos juntos montan
    // los segmentos dos veces (candado `refresco-una-sola-vez`).
    return { error: null, success: `Medidas guardadas (${r.escritas} valores, con el ICC y el ICT al día).`, warning: null };
  } catch (e) {
    if (e instanceof CircunferenciasNoEditablesError) return { error: e.message, success: null, warning: null };
    reportServerError("guardarCircunferenciasAction", e);
    return { error: "No se pudieron guardar las medidas.", success: null, warning: null };
  }
}
