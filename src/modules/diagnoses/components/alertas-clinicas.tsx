import type { AlertaClinica } from "@/clinical-engine/alertas-disponibles";
import { ALERTAS_NO_DISPONIBLES } from "@/clinical-engine/alertas-disponibles";
import { Bloque } from "@/components/shared/bloque";

// ALERTAS CLINICAS de la encuesta, en la etapa de Evaluacion.
//
// Es nivel DECISION y no de registro: una bandera de conducta alimentaria manda derivar hoy,
// no queda anotada para despues.
//
// VA EN EVALUACION Y NO EN DIAGNOSTICO POR INSTRUCCION SUYA (2026-08-28, 11a): "Esas alertas aparecen al
// inicio, cuando el profesional abre la informacion de la encuesta del paciente. Son lo que le dice que
// mirar ANTES de evaluar, no una conclusion del diagnostico".
//
// LA NOTA DE ABAJO NO ES UN DESCARGO, ES LA PIEZA PRINCIPAL. De sus quince reglas corren cinco: las diez
// restantes necesitan el consumo de nutrientes, que todavia no se calcula. Sin decirlo, "ninguna alerta"
// se lee como "el paciente esta bien", cuando significa "de lo nutricional no estamos evaluando nada". El
// silencio de un sistema que el profesional cree completo pesa mas que un aviso.

const ESTILO: Record<string, { caja: string; texto: string }> = {
  crítico: {
    caja: "border-clinical-critical bg-clinical-critical-bg",
    texto: "text-clinical-critical",
  },
  alto: { caja: "border-attention bg-attention-bg", texto: "text-attention" },
  moderado: { caja: "border-attention bg-attention-bg", texto: "text-attention" },
  positivo: { caja: "border-clinical-optimal bg-clinical-optimal-bg", texto: "text-clinical-optimal" },
};

export function AlertasClinicas({ alertas }: { alertas: AlertaClinica[] }) {
  return (
    <Bloque nivel="decision" titulo="Alertas clínicas de la encuesta">
      {alertas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin banderas en las respuestas que hoy se evalúan.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {alertas.map((a) => {
            const est = ESTILO[a.niv] ?? ESTILO.moderado;
            return (
              // La clave es el TITULO, que es su identificador estable dentro de la función; el índice
              // del arreglo cambia en cuanto una regla deja de aplicar.
              <li key={a.t} className={`rounded-lg border-2 p-3 ${est.caja}`}>
                <p className={`text-sm font-semibold ${est.texto}`}>{a.t}</p>
                <p className="mt-1 text-sm text-foreground">{a.txt}</p>
                <p className="mt-1 text-xs text-muted-foreground">Dominio {a.dom}</p>
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-t border-border pt-3 text-xs text-muted-foreground">
        El cuadro nutricional todavía no se evalúa. De las quince alertas del modelo,{" "}
        {ALERTAS_NO_DISPONIBLES.porConsumo} necesitan el consumo de nutrientes, que aún no se calcula. La
        ausencia de avisos no equivale a ausencia de riesgo.
      </p>
    </Bloque>
  );
}
