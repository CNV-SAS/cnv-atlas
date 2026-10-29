"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";

import type { QcBiologicoDeLaConsulta } from "../data/qc-biologico-reader";
import { darVistoBuenoAction, type VistoBuenoState } from "../qc-biologico-actions";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL PANEL DEL CONTROL DE CALIDAD BIOLOGICO
//
// ═══ SU DISEÑO, LITERAL (v12, 2026-10-12) ═══
//
// *"El panel sale en rojo encima de la importacion y la navegacion no deja salir de Antropometria. El
// profesional tiene dos caminos: corregir el dato o volver a subir el Excel -y el panel desaparece
// solo-, o pulsar «Revise la curva de Cole y los datos: continuar con esta medicion»."*
//
// *"El control avisa y frena, pero no decide. La decision de continuar es del profesional y queda
// registrada. No lo conviertas en un bloqueo sin salida."*
//
// ═══ POR QUE AQUI SI VA EL ROJO CLINICO, cuando casi nunca va ═══
//
// En esta pantalla llevamos tres defectos por usar la capa clinica donde no tocaba (el verde de "medicion
// importada", el azul del radar, el semaforo de la capacitancia): esos colores significan riesgo del
// PACIENTE, y ponerlos sobre un estado de proceso afirma algo falso.
//
// Aqui no es un estado de proceso. Un cuerpo cuya masa grasa es negativa no existe, asi que TODO lo que
// esta pantalla muestra debajo (la composicion, los indices, y el diagnostico que saldria de ellos)
// describe a nadie. El rojo dice exactamente eso, y el lo pidio en rojo.
//
// ═══ LO QUE NO HACE: ESCONDER LA SALIDA ═══
//
// El boton de continuar esta visible desde el primer momento, no detras de un desplegable. *"Un freno sin
// salida no es un guard: detiene a una persona."* Y el rotulo dice lo que el escribio, que es una frase
// que compromete a quien la pulsa: no "continuar", sino "revise la curva de Cole y los datos".
//
// ═══ Y CUANDO YA SE REVISO, EL PANEL SE QUEDA, EN GRIS ═══
//
// No desaparece: el hallazgo sigue ahi y el profesional que abra la consulta manana tiene que poder
// verlo. Lo que desaparece es el freno. Esconderlo del todo convertiria el visto bueno en una forma de
// borrar un hallazgo de la pantalla, y eso es lo contrario de registrarlo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const inicial: VistoBuenoState = { error: null, success: null, warning: null };

export function PanelDeCalidadBiologica({
  evaluationId,
  qc,
}: {
  evaluationId: string;
  qc: QcBiologicoDeLaConsulta;
}) {
  const [state, action, pending] = useActionState(darVistoBuenoAction, inicial);
  useFormToastAndRefresh(state);

  // SIN HALLAZGOS NO HAY PANEL, y eso es el 99,5 % de las consultas (2 de 400 el 2026-10-29). Un panel
  // verde de "la medicion es fisicamente posible" seria ruido en cada consulta.
  if (qc.hallazgos.length === 0) return null;

  const revisado = qc.visto;

  return (
    <section
      className={
        revisado
          ? "flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
          : "flex flex-col gap-3 rounded-xl border border-clinical-critical/40 bg-clinical-critical-bg p-4"
      }
      aria-live="polite"
    >
      <h3
        className={
          revisado
            ? "flex items-start gap-2 text-sm font-semibold text-foreground"
            : "flex items-start gap-2 text-sm font-semibold text-clinical-critical"
        }
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {revisado
          ? "Esta medición tiene un hallazgo del control de calidad, ya revisado"
          : qc.hallazgos.length === 1
            ? "Esta medición no es físicamente posible"
            : `Esta medición tiene ${qc.hallazgos.length} valores que no son físicamente posibles`}
      </h3>

      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {qc.hallazgos.map((h) => (
          <li key={h.codigo}>{h.texto}</li>
        ))}
      </ul>

      <p className="max-w-prose text-sm text-muted-foreground">
        {/* LO QUE ESTO ES Y LO QUE NO ES. Un profesional que lee "no es físicamente posible" sobre su
            paciente necesita saber que no se le está diciendo nada del paciente: se le está diciendo que
            el dato está mal. Sin esta frase, el panel se lee como un hallazgo clínico gravísimo. */}
        No es un hallazgo sobre el paciente: son valores que no pueden coexistir en ningún cuerpo, así que
        el dato está mal. Suele ser el archivo equivocado, una columna desplazada o una toma fallida.
        Mientras el hallazgo esté, la composición y el diagnóstico de esta consulta describen un cuerpo que
        no existe.
      </p>

      {revisado ? (
        <p className="text-sm text-muted-foreground">
          Alguien revisó la curva de Cole y los datos
          {qc.vistoEl ? ` el ${new Date(qc.vistoEl).toLocaleDateString("es-CO")}` : ""} y decidió continuar
          con esta medición. Si vuelves a subir el archivo y aparece otro hallazgo, se pedirá de nuevo.
        </p>
      ) : (
        <>
          <p className="max-w-prose text-sm text-foreground">
            Corrige el dato o vuelve a subir el Excel, y este aviso desaparece solo. Si la medición es
            correcta tal como está, puedes continuar dejándolo registrado.
          </p>
          <form onSubmit={enviarSinReset(action)}>
            <input type="hidden" name="evaluationId" value={evaluationId} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending
                ? "Registrando..."
                : "Revisé la curva de Cole y los datos: continuar con esta medición"}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
