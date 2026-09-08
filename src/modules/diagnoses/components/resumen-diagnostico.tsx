"use client";

import { startTransition, useActionState, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

import { generateCriterionAction } from "../actions";

// RESUMEN DEL DIAGNOSTICO · SOLO IA, NO EDITABLE (2026-09-08).
//
// DE DONDE SALE ESTA PIEZA. Al portar su paso 4, pulsar "Agregar criterio" empezo a dar "El criterio es
// demasiado largo". El limite de 2.000 caracteres no era el defecto: era la SEÑAL de que un solo campo
// estaba haciendo dos trabajos. Se diseño para una nota corta del profesional y ahora recibia un resumen
// del modelo.
//
// VERIFICADO EN SU ARCHIVO antes de partirlo (v8 del 4 de septiembre):
//   · su "Resumen del Diagnostico" se pinta en un <div> con `whiteSpace: pre-wrap`, NO en un textarea:
//     el profesional no lo edita;
//   · y SI SE GUARDA (`onUpdate({ analisisIA })`, rehidratado con `enc.analisisIA`): no se regenera al
//     volver a la pantalla. Por eso vive en `diagnoses.ai_summary` y llega ya escrito.
//
// LO QUE ESCRIBE EL PROFESIONAL SE FUE A SEGUIMIENTO, como en el suyo: "Observaciones", junto a la
// proxima cita.
//
// Y LOS CRITERIOS YA GUARDADOS NO SE PIERDEN NI SE MIGRAN. `diagnosis_notes` guarda texto que un
// profesional escribio y ASUMIO al guardar (append-only por diseño; 3 filas en produccion). Moverlo a
// otra pieza seria reescribir el acto de otro. Se muestran aqui, en solo lectura y rotulados como lo que
// son: criterios registrados antes de que esto se separara.

export function ResumenDiagnostico({
  evaluationId,
  resumen,
  criteriosPrevios,
}: {
  evaluationId: string;
  /** El resumen vigente, ya guardado. null = todavia no se ha generado. */
  resumen: string | null;
  /** Criterios que el profesional registro cuando esto era un solo campo. Solo lectura. */
  criteriosPrevios: { texto: string; fecha: string }[];
}) {
  const [texto, setTexto] = useState(resumen);
  const [state, action, generando] = useActionState(generateCriterionAction, {
    error: null,
    text: null,
  });
  // El texto recien generado gana sobre el que llego del servidor, para que la pantalla no espere a un
  // refresco. El servidor ya lo guardo: esto es solo lo que se ve mientras tanto.
  const visible = state.text ?? texto;
  if (state.text && state.text !== texto) setTexto(state.text);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-foreground">Resumen del diagnóstico</h3>
          {/* QUIEN LO ESCRIBE, dicho donde se lee. Un texto clinico sin procedencia se lee como si lo
              hubiera escrito el profesional, y este no. */}
          <p className="text-xs text-muted-foreground">
            Lo redacta el sistema a partir del diagnóstico funcional. No es editable: si quieres otro,
            vuelve a generarlo. Tus observaciones de la consulta van en Seguimiento.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={generando}
          onClick={() => {
            const fd = new FormData();
            fd.set("evaluationId", evaluationId);
            startTransition(() => action(fd));
          }}
        >
          <Sparkles className="size-4" aria-hidden />
          {generando ? "Generando..." : visible ? "Volver a generar" : "Generar resumen"}
        </Button>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      {/* SIN LIMITE DE LONGITUD y en un bloque de lectura, no en un campo: son cinco parrafos, uno por
          dominio. `whitespace-pre-wrap` conserva los saltos que el modelo escribe, igual que el suyo. */}
      {visible ? (
        <div className="whitespace-pre-wrap rounded-xl border border-border bg-card p-6 text-sm leading-relaxed text-foreground">
          {visible}
        </div>
      ) : (
        <p className="w-fit rounded-md border border-dashed border-border px-3 py-1 text-sm italic text-muted-foreground">
          Todavía no se ha generado. El resumen aparece aquí cuando lo pidas.
        </p>
      )}

      {criteriosPrevios.length > 0 ? (
        <details className="rounded-xl border border-border bg-card">
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-medium text-foreground">
            Criterios del profesional, registrados antes ({criteriosPrevios.length}) · ya no se
            escriben aquí
          </summary>
          <div className="flex flex-col gap-4 border-t border-border px-6 py-4">
            {/* POR QUE SIGUEN AQUI Y NO SE MIGRARON: los escribio y los asumio un profesional. Se
                conservan tal cual, y se dice de cuando son para que no se lean como el resumen de hoy. */}
            {/* QUIEN LOS ESCRIBIO Y CUANDO, en la primera linea. Sin eso, un profesional nuevo abre el
                desplegable debajo del resumen del modelo y no sabe cual de los dos textos es de quien,
                que es justo lo que Santiago señalo en el smoke. */}
            <p className="text-xs text-muted-foreground">
              <strong>Los escribió un profesional</strong>, no el sistema, cuando este bloque era un campo
              de texto. Se conservan como quedaron y no se pueden editar. Lo que escribas ahora va en{" "}
              <strong>Seguimiento, Observaciones de la consulta</strong>, y sale en la historia clínica.
            </p>
            {criteriosPrevios.map((c, i) => (
              <div key={i} className="flex flex-col gap-1">
                {/* La fecha y nada mas: `diagnosis_notes` no guarda el autor por fila, y ponerle uno
                    seria inventarlo. */}
                <span className="text-xs text-muted-foreground">{c.fecha}</span>
                <p className="whitespace-pre-wrap text-sm text-foreground">{c.texto}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
