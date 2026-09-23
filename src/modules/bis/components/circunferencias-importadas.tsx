"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";

import { guardarCircunferenciasAction, type CircunferenciasState } from "../actions";

// LA CINTURA Y LA CADERA DE UNA CONSULTA IMPORTADA DEL HTML (Santiago, 2026-09-22).
//
// Solo aparece aqui, y solo si falta alguna: el tamizaje de ese paciente fue hace meses y no se puede
// repetir. Para una medicion tomada en Atlas la regla sigue siendo la de siempre (volver a medir con el
// equipo y re-importar el XLSX), porque ahi el paciente esta delante.
//
// Y AL GUARDAR SE RECALCULAN EL ICC Y EL ICT con la formula de Gildardo, que es lo que hace su HTML: sin eso,
// teclear la cadera dejaria los dos indices con el valor viejo.
//
// SIN PLACEHOLDER (Santiago, 2026-09-23): decia "84" y "106", que son EL VALOR CORRECTO de un paciente de
// prueba. Un ejemplo que parece un dato invita a teclearlo, y aqui lo tecleado se guarda como si lo hubiera
// medido alguien. La unidad ya la dice el rotulo ("Cintura (cm)"), asi que el ejemplo no hacia falta.

const inicial: CircunferenciasState = { error: null, success: null, warning: null };

export function CircunferenciasImportadas({
  evaluationId,
  cintura,
  cadera,
}: {
  evaluationId: string;
  cintura: number | null;
  cadera: number | null;
}) {
  const [state, action, pending] = useActionState(guardarCircunferenciasAction, inicial);
  useFormToastAndRefresh(state);
  const faltan = [cintura == null ? "la cintura" : null, cadera == null ? "la cadera" : null].filter(Boolean);
  if (faltan.length === 0) return null;

  return (
    <form
      onSubmit={enviarSinReset(action)}
      className="flex flex-col gap-3 rounded-lg border border-clinical-warning/40 bg-clinical-warning-bg p-4"
    >
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-clinical-warning">
          A esta medición importada del HTML le falta {faltan.join(" y ")}
        </span>
        <span className="text-sm text-foreground">
          Sin esas medidas no se puede generar el diagnóstico. Como la toma fue en el HTML y no se puede
          repetir, escríbelas aquí tal como quedaron registradas. El índice cintura-cadera y el
          cintura-talla se recalculan con ellas.
        </span>
      </div>
      <div className="flex flex-wrap gap-4">
        {cintura == null ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`cintura-${evaluationId}`} className="text-sm font-medium">
              Cintura (cm)
            </label>
            <Input
              id={`cintura-${evaluationId}`}
              name="cintura"
              inputMode="decimal"
              className="w-32"
              disabled={pending}
            />
          </div>
        ) : null}
        {cadera == null ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={`cadera-${evaluationId}`} className="text-sm font-medium">
              Cadera (cm)
            </label>
            <Input
              id={`cadera-${evaluationId}`}
              name="cadera"
              inputMode="decimal"
              className="w-32"
              disabled={pending}
            />
          </div>
        ) : null}
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Guardando..." : "Guardar las medidas"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
