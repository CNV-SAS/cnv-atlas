"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { addNoteAction } from "@/modules/treatment/actions";
import { PROFESION_NOTA } from "@/modules/treatment/data/treatment-view-types";

// OBSERVACIONES DE LA CONSULTA · EN SEGUIMIENTO, QUE ES DONDE SU ARCHIVO LAS TIENE (2026-09-08).
//
// LA HISTORIA COMPLETA, porque sin ella esto parece un campo que va y viene:
//
//   · 2026-08-26 §8.3 — Gildardo: "deben aparecer en la historia. Y POR CONSULTA, NO POR PACIENTE". Se
//     cablearon a la HC (`HcObservaciones`), que es donde siguen apareciendo hoy.
//   · 2026-09-05, cotejo punto 26 — Santiago retiro el CAMPO del panel de Tratamiento: "el html no lo
//     tiene... de momento yo quitaria este bloque". Y tenia razon: su archivo NO las tiene en
//     Tratamiento. Las tiene en SEGUIMIENTO, dentro del formulario de proximo control.
//   · Resultado: quedaron con LECTOR y SIN ESCRITOR. Aparecen en la historia clinica y no habia donde
//     escribirlas. Esta pantalla es la mitad que faltaba, en el sitio que su archivo indica.
//
// NO SE CREO UNA TABLA NUEVA, y esa fue la decision que casi se toma mal: iba a añadir una columna
// `treatments.observaciones`, mutable y unica. Habria sido una CUARTA superficie de nota que ademas
// reintroducia el defecto que el mismo diagnostico en su archivo (`onConflict: 'documento'`, cada control
// pisando al anterior). Se escribe en `treatment_notes`, que ya es POR CONSULTA, APPEND-ONLY y con la
// PROFESION sellada en el acto (su §8 del 2026-08-30: "cada rol escribe lo suyo y no se pisan").

export function ObservacionesConsulta({
  evaluationId,
  notas,
  puedeEscribir,
}: {
  evaluationId: string;
  notas: { id: string; note: string; createdAt: string; profession: string | null }[];
  /** Sin tratamiento no hay donde colgar la nota (el diagnostico todavia no se confirmó). */
  puedeEscribir: boolean;
}) {
  const [state, action, pending] = useActionState(addNoteAction, {
    error: null,
    success: null,
    warning: null,
  });
  // El formulario NO desaparece al guardar, pero la lista de abajo tiene que refrescarse para que la nota
  // recien escrita aparezca. Sin el refresco, el profesional guarda y no ve nada: la lee como perdida.
  useFormToastAndRefresh(state);

  // AGRUPADAS POR PROFESION y no ocultas: el medico necesita leer lo que anoto la nutricionista. Misma
  // disposicion que el historico del panel, para que no se lean como dos cosas distintas.
  const porProfesion = new Map<string, typeof notas>();
  for (const n of notas) {
    // LA CLAVE ES LA DEL MAPA, con guion. Escribi `sin_profesion` con guion bajo y el rotulo no habria
    // salido: la nota sin profesion aparecia sin encabezado, que es justo lo que su §8 pide evitar (no se
    // les inventa un rol, pero se dice que no lo tienen). Lo atrapo el candado de notas por profesion.
    const k = n.profession ?? "sin-profesion";
    porProfesion.set(k, [...(porProfesion.get(k) ?? []), n]);
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-foreground">Observaciones de la consulta</h3>
        {/* QUE PASA CON LO QUE ESCRIBE, dicho donde lo escribe. Estas notas SI salen en un documento, y
            eso cambia como se redacta una nota: no es lo mismo un recordatorio privado que un texto que
            va a la historia clinica del paciente. */}
        <p className="text-xs text-muted-foreground">
          Tu registro clínico de esta consulta. <strong>Aparecen en la historia clínica</strong>, agrupadas
          por profesión. No se pueden borrar ni editar: si te corriges, agrega una nueva.
        </p>
      </div>

      {notas.length > 0 ? (
        <div className="flex flex-col gap-3">
          {[...porProfesion.entries()].map(([prof, lista]) => (
            <div key={prof} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {PROFESION_NOTA[prof] ?? "Sin profesión registrada"}
              </p>
              <ul className="flex flex-col gap-2">
                {lista.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-3 text-sm text-foreground">
                    <p className="whitespace-pre-wrap">{n.note}</p>
                    <p className="pt-1 text-xs text-muted-foreground">{n.createdAt}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {puedeEscribir ? (
        // NO se usa la prop `action`: en React 19 resetea los inputs no controlados tras la accion, asi
        // que una nota rechazada borraria lo que el profesional acaba de escribir (hazard 2 de
        // CLAUDE.md). Lo atrapo su candado el mismo dia que escribi esto.
        <form
          onSubmit={enviarSinReset(action)}
          className="flex flex-col gap-2 border-t border-border pt-4"
        >
          <input type="hidden" name="evaluationId" value={evaluationId} />
          <Textarea
            name="note"
            rows={4}
            placeholder="Qué observaste en esta consulta, qué acordaste con el paciente, qué vigilar en el próximo control"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "Agregando..." : "Agregar observación"}
            </Button>
            {/* LA CONSECUENCIA, DONDE SE PULSA. La leccion del punto 13: a media pantalla del boton no se
                lee, y esto es append-only igual que el criterio lo era. */}
            <span className="text-xs text-muted-foreground">
              Queda registrada y sale en la historia clínica. No se puede borrar.
            </span>
          </div>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Podrás escribir observaciones cuando el diagnóstico esté confirmado y exista el tratamiento.
        </p>
      )}
    </section>
  );
}
