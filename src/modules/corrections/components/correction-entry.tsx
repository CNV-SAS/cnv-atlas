import Link from "next/link";

import { Button } from "@/components/ui/button";

// Punto de entrada al flujo de CORRECCIÓN (S2). DELIBERADAMENTE distinto de los actos de SELLADO
// (confirmar diagnóstico, aprobar protocolo, aprobar reporte): esos son primarios/rellenos y avanzan;
// corregir es lo opuesto (rehace una emisión ya sellada). Por eso vive en un recuadro tenue aparte, con
// botón de contorno (no relleno) y una pregunta que invita a pensarlo, no un CTA que empuja a hacerlo.
// Aparece al pie de las tres pestañas donde el profesional PODRÍA notar el error (Evaluación,
// Diagnóstico, Tratamiento). Solo cuando ya hay un diagnóstico: sin emisión sellada no hay nada que
// rehacer (antes del diagnóstico se edita la entrada directamente).
export function CorrectionEntry({ evaluationId }: { evaluationId: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold text-foreground">¿Un dato de la encuesta quedó mal?</h3>
      <p className="max-w-prose text-sm text-muted-foreground">
        Corrige la respuesta equivocada. Se genera una versión nueva del diagnóstico, el tratamiento y el
        reporte con el dato corregido; la versión actual no se borra, queda registrada como reemplazada.
      </p>
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/evaluaciones/${evaluationId}/corregir`}>Corregir la evaluación</Link>
        </Button>
      </div>
    </section>
  );
}
