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
    <section className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <NotebookPen className="size-4 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">Criterio del profesional</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Tu interpretación clínica del diagnóstico. No forma parte del cálculo del modelo, que es
          inmutable y queda como evidencia arriba. Se agrega al historial interno (no se reescribe)
          y no se envía al paciente. Distinta de las notas del tratamiento y de las notas del
          reporte.
        </p>
      </div>

      {notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
              <p className="whitespace-pre-wrap">{n.note}</p>
              <p className="pt-1 text-xs text-muted-foreground">
                {formatDateTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aún no has registrado tu criterio para esta evaluación.
        </p>
      )}

      <form onSubmit={enviarSinReset(formAction)} className="flex flex-col gap-2">
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
        <div>
          <Button type="submit" disabled={pending || generating || note.trim() === ""}>
            {pending ? "Agregando..." : "Agregar criterio"}
          </Button>
        </div>
      </form>
    </section>
  );
}
