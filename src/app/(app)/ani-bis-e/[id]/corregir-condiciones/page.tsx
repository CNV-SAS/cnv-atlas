import { notFound, redirect } from "next/navigation";

import { TituloPantalla } from "@/components/shared/titulo-pantalla";
import { VolverA } from "@/components/shared/volver-a";
import { requireUser } from "@/modules/auth/session";
import { BisConditionsCapture } from "@/modules/bis-intake/components/bis-conditions-capture";
import {
  getActiveBisConditionCatalog,
  getBisIntakeForEvaluation,
  getEvaluationPatientSex,
} from "@/modules/bis-intake/data/bis-conditions-reader";
import { canCaptureBisConditions } from "@/modules/bis-intake/policies/can-capture-bis-conditions";
import { getEvaluationHeaderForSession } from "@/modules/diagnoses/data/results-reader";

export const metadata = { title: "Corregir las condiciones de la toma - Atlas" };

// ═══ CORREGIR LAS CONDICIONES DE LA TOMA BIS (Santiago, 2026-09-28) ═══
//
// EL CASO REAL, de una integrante: el paciente va al baño DESPUES de que ella guardó las condiciones, así que
// "fue al baño antes" queda mal. Con el diagnóstico generado las condiciones quedaban de SOLO LECTURA y no había
// forma de arreglarlo.
//
// ── POR QUE ES UNA PANTALLA APARTE Y NO UN BOTON EN LA PESTAÑA ──
//
// Porque corregirlas REHACE el diagnóstico, y eso no puede pasar como efecto lateral de editar un campo donde el
// profesional estaba mirando. Es el mismo criterio que la corrección de encuesta, que también vive en su
// pantalla: un acto que sustituye una emisión sellada se hace a propósito, con su motivo, no de pasada.
//
// EL FORMULARIO ES EL MISMO de la captura, en modo corrección. No se escribió otro: ahí viven las reglas
// clínicas (qué advertencias hay que reconocer, qué condiciones son obligatorias según el sexo, que una
// contraindicación bloquea el import), y un segundo formulario se separaría del primero en el siguiente cambio.
export default async function CorregirCondicionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  // MISMA POLICY QUE CAPTURAR: quien responde las condiciones las corrige. La autoridad fina (profesional
  // asignado, evaluación vigente) la impone el servicio de corrección, como en la corrección de encuesta.
  if (!canCaptureBisConditions(user)) redirect("/no-autorizado");

  const header = await getEvaluationHeaderForSession(id);
  if (!header) notFound(); // no existe o no es suya (RLS)

  const [catalog, intake, sexo] = await Promise.all([
    getActiveBisConditionCatalog(),
    getBisIntakeForEvaluation(id),
    getEvaluationPatientSex(id),
  ]);
  // SIN CONDICIONES GUARDADAS NO HAY NADA QUE CORREGIR, y se dice en vez de mostrar un formulario vacío que
  // escribiría una primera captura por la puerta de la corrección.
  if (!catalog || !intake) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <VolverA padre={`/ani-bis-e/${id}`} />
        <TituloPantalla titulo="Corregir las condiciones de la toma" />
        <p className="text-sm text-muted-foreground">
          Esta evaluación no tiene condiciones de la toma registradas, así que no hay nada que corregir.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <VolverA padre={`/ani-bis-e/${id}`} />
      <TituloPantalla
        titulo="Corregir las condiciones de la toma"
        descripcion="Cambia lo que quedó mal y escribe por qué. Se genera una versión nueva del diagnóstico con la condición corregida; la actual no se borra, queda registrada como reemplazada."
      />
      <BisConditionsCapture
        evaluationId={id}
        catalog={catalog}
        intake={intake}
        // EL SEXO SALE DEL SERVIDOR en la acción (es quien decide si las condiciones femeninas son
        // obligatorias); aquí solo gobierna qué campos se pintan.
        patientIsFemale={sexo === "F"}
        modoCorreccion
      />
    </div>
  );
}
