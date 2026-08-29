"use client";

import { Panel } from "@/components/shared/panel";
import { startTransition, useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormToast } from "@/components/shared/use-form-toast";
import type { CompositionCorrections } from "@/modules/diagnoses/data/composition-map";

import { clearBisCorrectionAction, correctBisValueAction, type BisCorrectionState } from "../actions";
import { variableCruda } from "../services/medidas-corregibles";

// ANTROPOMETRIA EDITABLE. Porte del bloque "Datos Personales" de su archivo, con su nota:
//
//   "Peso, estatura, cintura y cadera son editables (si faltan en el archivo o llegaron mal). Los
//    indices IMC, ICC, ICT, ASMI y las clasificaciones de AF/FFMI/FMI se recalculan automaticamente
//    al editar."
//
// POR QUE HACIA FALTA: si el archivo del equipo trae la cintura mal, hoy la unica salida es cerrar la
// evaluacion y rehacerla. Para un digito es desproporcionado.
//
// EDAD Y SEXO NO SE EDITAN, como en su archivo (alli van en gris, sin borde). No son medidas: son
// identidad del paciente, y cambiarlas no es corregir una medicion.
//
// LA FUERZA PRENSIL TAMPOCO, aunque su bloque la tenga: en Atlas YA se captura en las condiciones BIS.
// Tener dos sitios para editar el mismo dato es peor que no tener ninguno.
//
// SOLO ANTES DEL DIAGNOSTICO. Despues la medicion queda sellada y el camino es "Corregir la
// evaluacion", que versiona. El gate de verdad esta en la transaccion del writer; esto solo evita
// ofrecer lo que el servidor va a rechazar.

const CAMPOS = [
  { key: "peso", label: "Peso", unidad: "kg" },
  { key: "talla", label: "Estatura", unidad: "cm" },
  { key: "cintura", label: "Cintura", unidad: "cm" },
  { key: "cadera", label: "Cadera", unidad: "cm" },
] as const;

const EMPTY: BisCorrectionState = { error: null, success: null, warning: null };

const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "" : String(Math.round(n * 100) / 100).replace(".", ",");

export function AntropometriaEditable({
  evaluationId,
  valores,
  corrections = {},
  sellada,
}: {
  evaluationId: string;
  valores: Partial<Record<(typeof CAMPOS)[number]["key"], number | null>>;
  corrections?: CompositionCorrections;
  /** true tras el diagnostico: la medicion ya no se toca aqui. */
  sellada: boolean;
}) {
  const [state, corregir, pending] = useActionState(correctBisValueAction, EMPTY);
  const [limpiarState, limpiar, limpiando] = useActionState(clearBisCorrectionAction, EMPTY);
  useFormToast(state);
  useFormToast(limpiarState);

  return (
    <Panel>
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-foreground">Medidas del paciente</h4>
        <p className="text-xs text-muted-foreground">
          {sellada
            ? "El diagnóstico ya se generó sobre estas medidas, así que aquí no se cambian. Para corregirlas, usa Corregir la evaluación: queda una versión nueva y no se reescribe lo emitido."
            : "Puedes corregirlas si faltan en el archivo del equipo o llegaron mal. Los índices (IMC, ICC, ICT, ASMI) y las clasificaciones de AF, FFMI y FMI se recalculan al guardar."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS.map((c) => {
          // Las correcciones vienen keyed por el nombre CRUDO (el encabezado normalizado del Biody),
          // que es como se guardan. La traduccion la hace el MISMO helper que usa el writer: con dos
          // traducciones distintas volveriamos al fallo mudo de buscar en un sitio y guardar en otro.
          const fix = corrections[variableCruda(c.key)];
          const actual = valores[c.key];
          return (
            <div key={c.key} className="flex flex-col gap-1">
              <label htmlFor={`antro-${c.key}`} className="text-xs font-medium text-foreground">
                {c.label} ({c.unidad})
              </label>
              {sellada ? (
                <p className="text-sm text-foreground">{fmt(actual) || "sin dato"}</p>
              ) : (
                // NO se usa la prop `action`: en React 19 resetea los inputs no controlados tras la
                // accion, asi que un valor rechazado borraria lo que el profesional acaba de escribir
                // (hazard 2 de CLAUDE.md).
                <form
                  // KEY DERIVADA DEL VALOR GUARDADO: sin esto el input es no controlado y conserva lo
                  // que el profesional escribio, asi que al restaurar "el del equipo" el aviso decia
                  // que se restauro y el campo seguia mostrando lo otro. Con la key, el campo se
                  // remonta cuando el valor del servidor cambia. Mismo patron que el panel.
                  key={`${c.key}-${actual ?? "sin"}`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const datos = new FormData(e.currentTarget);
                    startTransition(() => corregir(datos));
                  }}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="evaluationId" value={evaluationId} />
                  <input type="hidden" name="variableName" value={c.key} />
                  <Input
                    id={`antro-${c.key}`}
                    name="value"
                    defaultValue={fmt(actual)}
                    inputMode="decimal"
                    className="h-9 w-28"
                  />
                  <Button type="submit" variant="outline" size="sm" disabled={pending}>
                    Guardar
                  </Button>
                </form>
              )}

              {/* CUAL ES CUAL. Un valor corregido que se ve igual que uno medido deja al profesional
                  sin saber que esta mirando, y el crudo del equipo sigue siendo la evidencia de lo que
                  ese aparato midio. Por eso el medido se conserva y se muestra al lado. */}
              {fix ? (
                <p className="text-xs text-clinical-warning">
                  Corregido. El equipo midió {fmt(fix.medido) || "sin dato"} · {fix.porEmail}
                  {sellada ? null : (
                    <>
                      {" · "}
                      <button
                        type="button"
                        disabled={limpiando}
                        onClick={() => {
                          const datos = new FormData();
                          datos.set("evaluationId", evaluationId);
                          datos.set("variableName", c.key);
                          startTransition(() => limpiar(datos));
                        }}
                        className="underline"
                      >
                        volver al del equipo
                      </button>
                    </>
                  )}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
