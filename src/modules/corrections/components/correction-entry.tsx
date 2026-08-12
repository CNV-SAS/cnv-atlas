import Link from "next/link";

import { Button } from "@/components/ui/button";

import type { CorrectionAvailability } from "../data/correction-availability-reader";

// Punto de entrada al flujo de CORRECCIÓN (S2). DELIBERADAMENTE distinto de los actos de SELLADO
// (confirmar diagnóstico, aprobar protocolo, aprobar reporte): esos son primarios/rellenos y avanzan;
// corregir es lo opuesto (rehace una emisión ya sellada). Por eso vive en un recuadro tenue aparte, con
// botón de contorno (no relleno) y una pregunta que invita a pensarlo, no un CTA que empuja a hacerlo.
// Aparece al pie de las tres pestañas donde el profesional PODRÍA notar el error (Evaluación,
// Diagnóstico, Tratamiento). Solo cuando ya hay un diagnóstico: sin emisión sellada no hay nada que
// rehacer (antes del diagnóstico se edita la entrada directamente).
//
// availability lo resuelve la página una vez (no tres); CP3: si la evaluación es de una versión anterior
// de la encuesta, el botón se muestra DESHABILITADO con la razón (estado, no un error al pulsar).
export function CorrectionEntry({
  evaluationId,
  availability,
}: {
  evaluationId: string;
  availability: CorrectionAvailability;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold text-foreground">¿Un dato de la encuesta quedó mal?</h3>
      <p className="max-w-prose text-sm text-muted-foreground">
        Corrige la respuesta equivocada. Se genera una versión nueva del diagnóstico, el tratamiento y el
        reporte con el dato corregido; la versión actual no se borra, queda registrada como reemplazada.
      </p>
      {/* Alcance honesto (CP3): aquí solo se corrige la encuesta. La medición del equipo y la identidad
          no se corrigen aquí, y el Biody equivocado se resuelve cerrando la evaluación (vía aún no
          construida): sin este aviso el profesional busca, no encuentra y cree que no se permite. */}
      <p className="max-w-prose text-xs text-muted-foreground">
        Aquí corriges las respuestas de la encuesta. La medición del equipo (Biody) y la identidad del
        paciente no se corrigen aquí. Si importaste la medición del paciente equivocado, esa evaluación
        debe cerrarse y hacerse de nuevo con el archivo correcto; esa opción todavía no está disponible,
        escríbele a soporte.
      </p>
      {availability.available ? (
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/evaluaciones/${evaluationId}/corregir`}>Corregir la evaluación</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Button variant="outline" size="sm" disabled>
            Corregir la evaluación
          </Button>
          {availability.blockedReason ? (
            <p className="text-xs text-muted-foreground">{availability.blockedReason}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
