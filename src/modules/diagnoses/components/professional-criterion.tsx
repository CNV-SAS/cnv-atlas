"use client";

import { useActionState, useState, useTransition } from "react";
import { NotebookPen, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormToast } from "@/components/shared/use-form-toast";

import { formatDateTime } from "@/lib/format/date";

import {
  addDiagnosisNoteAction,
  type DiagnosisActionState,
  generateCriterionAction,
} from "../actions";
import type { DiagnosisNote } from "../data/diagnosis-notes-types";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const EMPTY: DiagnosisActionState = { error: null, success: null, warning: null };

// Capa del CRITERIO DEL PROFESIONAL, deliberadamente distinta de la evidencia del modelo. La
// evidencia (indicadores, Diana, DFI, composicion) es calculo inmutable del motor; esto es la
// interpretacion del profesional, editable en el sentido de que se construye con el tiempo
// (append-only: cada criterio se agrega, no se reescribe). El tratamiento visual (borde
// punteado, acento, rotulo explicito) evita que se lea como parte del diagnostico del motor.
export function ProfessionalCriterion({
  evaluationId,
  notes,
}: {
  evaluationId: string;
  notes: DiagnosisNote[];
}) {
  const [state, formAction, pending] = useActionState(addDiagnosisNoteAction, EMPTY);
  useFormToast(state);
  const [note, setNote] = useState("");
  // "Hubo asistencia de IA" en esta composicion: se marca true al generar un borrador (aunque el
  // profesional lo reescriba entero). Viaja como campo oculto y se guarda en la nota (solo traza). Si
  // guarda sin generar, queda false. Se reinicia al guardar (empieza una composicion nueva).
  const [aiAssisted, setAiAssisted] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  // Append-only: al guardar con exito hay que limpiar el campo. Si no, el texto recien enviado
  // queda visible como si fuera una nota nueva por agregar, y el profesional podria darle a
  // "Agregar" otra vez y crear un duplicado permanente (la nota no se puede editar ni borrar).
  // Se ajusta en render al cambiar el estado de la accion (patron oficial de React de "ajustar
  // estado en render", guardando el estado previo en estado; sin efecto ni mutacion de ref).
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    if (state.success && note !== "") {
      setNote("");
      setAiAssisted(false);
      setGenError(null);
    }
  }

  // Genera el borrador por IA. Si el campo ya tiene texto, NO lo pisa: lo agrega debajo (nunca se
  // pierde lo escrito a mano). Si falla, lo dice sin bloquear: el profesional escribe a mano.
  function handleGenerate() {
    setGenError(null);
    const fd = new FormData();
    fd.set("evaluationId", evaluationId);
    startGenerating(async () => {
      const res = await generateCriterionAction({ error: null, text: null }, fd);
      if (res.text) {
        setNote((prev) => (prev.trim() === "" ? res.text! : `${prev.trimEnd()}\n\n${res.text}`));
        setAiAssisted(true);
      } else {
        setGenError(res.error ?? "No se pudo generar el borrador. Escribe tu criterio a mano.");
      }
    });
  }

  return (
    // EL BLOQUE, REDISEÑADO (cotejo 2026-09-05, punto 11). Antes era un recuadro de borde DISCONTINUO
    // sobre fondo tenido, y eso se lee como zona de arrastre o como maqueta sin terminar ("muy simple y
    // extraño", textual de Santiago). La distincion respecto de la evidencia del motor sigue siendo
    // necesaria, pero se dice CON PALABRAS y con una franja de encabezado, no con un borde que en el
    // resto de la app significa "aqui no hay nada todavia".
    //
    // EL ROTULO DE ARRIBA ES SUYO. Su archivo titula esta seccion "Diagnóstico Integrado ANI BIS-E", y
    // Santiago propuso adoptarlo. Va de ANTETITULO y no en lugar del nuestro, y la razon importa: en su
    // archivo ese titulo encabeza un panel de SOLO LECTURA con el texto que escribe la IA, sin campo
    // para el profesional. Aqui el profesional ESCRIBE. Poner su titulo solo diria que lo redacto la
    // maquina, que es lo contrario de para lo que existe el bloque. Con los dos, la seccion se llama
    // como en su modelo y la firma sigue siendo de quien la escribe.
    <section className="flex flex-col overflow-hidden rounded-xl border border-primary/40 bg-card">
      <div className="flex flex-col gap-2 border-b border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Diagnóstico Integrado ANI BIS-E
          </span>
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            Lo escribes tú
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotebookPen className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">Criterio del profesional</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tu interpretación clínica del diagnóstico. No forma parte del cálculo del modelo, que es
          inmutable y queda como evidencia arriba. Se agrega al historial interno (no se reescribe)
          y no se envía al paciente. Distinta de las notas del tratamiento y de las notas del
          reporte.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">
        {/* EL HISTORIAL, NUMERADO. La numeracion no es adorno: dice que esto es una SECUENCIA que se
            agrega, no una lista de notas sueltas, y por tanto que el criterio mas alto es el ultimo. Es
            lo que contesta sin leer nada la pregunta de "y si me equivoque": se agrega el corregido, y
            se ve cual vino despues. */}
        {notes.length ? (
          <ol className="flex flex-col gap-3">
            {notes.map((n, i) => (
              <li key={n.id} className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Criterio {i + 1} de {notes.length}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{n.note}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm italic text-muted-foreground">
            Aún no has registrado tu criterio para esta evaluación.
          </p>
        )}

        {/* EL COMPOSITOR, separado del historial por una linea: arriba lo que YA quedo registrado,
            abajo lo que se esta escribiendo. Sin la separacion, el campo vacio parecia una entrada mas
            de la lista. */}
        <form
          onSubmit={enviarSinReset(formAction)}
          className="flex flex-col gap-2 border-t border-border pt-4"
        >
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <input type="hidden" name="aiAssisted" value={aiAssisted ? "true" : "false"} />

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating || pending}
            >
              <Sparkles className="size-4" aria-hidden />
              {generating ? "Generando borrador..." : "Generar borrador con IA"}
            </Button>
            {note.trim() !== "" ? (
              <span className="text-xs text-muted-foreground">
                El borrador se agrega debajo de lo que ya escribiste.
              </span>
            ) : null}
          </div>

          {aiAssisted ? (
            <p className="text-xs text-muted-foreground">
              Borrador generado por el sistema. Revísalo y edítalo; al guardarlo lo asumes como tu
              criterio.
            </p>
          ) : null}
          {genError ? <p className="text-sm text-destructive">{genError}</p> : null}

          <Textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escribe tu interpretación clínica de estos resultados, o genera un borrador con IA para partir de ahí"
            rows={8}
          />
          {/* LA CONSECUENCIA, DONDE SE DECIDE (cotejo 2026-09-05, punto 13). Que el criterio sea
              append-only ya lo decia el parrafo de arriba, pero a media pantalla del boton: Santiago
              pregunto justo eso ("que pasa si se equivoco"), que es la señal de que ahi no se lee. Un
              acto irreversible dice lo que hace en el sitio donde se pulsa. */}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending || generating || note.trim() === ""}>
              {pending ? "Agregando..." : "Agregar criterio"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Queda registrado y no se puede borrar. Si te equivocas, agrega uno nuevo: el último es el
              vigente.
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
