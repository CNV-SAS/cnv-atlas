"use client";

import { useActionState, useState } from "react";
import { NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormToast } from "@/components/shared/use-form-toast";

import { addDiagnosisNoteAction, type DiagnosisActionState } from "../actions";
import type { DiagnosisNote } from "../data/diagnosis-notes-reader";

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

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <NotebookPen className="size-4 text-primary" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">Criterio del profesional</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Tu interpretacion clinica. No forma parte del calculo del modelo, que es inmutable y
          queda como evidencia arriba. Este es tu criterio: se agrega al historial y no se
          reescribe.
        </p>
      </div>

      {notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-background p-3 text-sm text-foreground">
              <p className="whitespace-pre-wrap">{n.note}</p>
              <p className="pt-1 text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString("es-CO")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aun no has registrado tu criterio para esta evaluacion.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="evaluationId" value={evaluationId} />
        <Textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Escribe tu interpretacion clinica de estos resultados"
          rows={3}
        />
        <div>
          <Button type="submit" disabled={pending || note.trim() === ""}>
            {pending ? "Agregando..." : "Agregar criterio"}
          </Button>
        </div>
      </form>
    </section>
  );
}
