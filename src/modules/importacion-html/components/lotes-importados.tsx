"use client";

import { useActionState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/date";

import { deshacerLoteAction, type DeshacerState } from "../actions";
import type { LoteImportado } from "../data/contexto-reader";

// LOS LOTES IMPORTADOS, SIEMPRE A LA VISTA (smoke de Santiago, 2026-09-22). Antes el boton de deshacer solo
// aparecia tras importar, y apuntaba al ultimo lote: quien importaba dos veces se quedaba sin forma de
// deshacer el primero. Cada lote dice de que archivo es, cuando entro y cuantas consultas tiene HOY.
//
// UN LOTE CON DIAGNOSTICO YA NO SE DESHACE: eso ya es trabajo clinico de Atlas. Se dice en la fila, no al
// pulsar, para que no se intente.

const inicial: DeshacerState = { error: null, mensaje: null };

function FilaDeLote({ lote }: { lote: LoteImportado }) {
  const [state, action, pending] = useActionState(deshacerLoteAction, inicial);
  const bloqueado = lote.deshechoEn != null || lote.conDiagnostico > 0;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-medium text-foreground">{lote.archivo}</span>
        <span className="text-muted-foreground">
          {formatDateTime(lote.importadoEn)} · a la cuenta de {lote.profesional}
        </span>
      </div>
      <span className="text-muted-foreground">
        {lote.consultasActuales === 1 ? "1 consulta" : `${lote.consultasActuales} consultas`} ·{" "}
        {lote.pacientesCreados === 1 ? "1 paciente creado" : `${lote.pacientesCreados} pacientes creados`}
        {lote.conDiagnostico > 0
          ? ` · ${lote.conDiagnostico === 1 ? "1 consulta ya tiene" : `${lote.conDiagnostico} consultas ya tienen`} diagnóstico`
          : ""}
      </span>
      {lote.deshechoEn ? (
        <span className="text-muted-foreground">Deshecho el {formatDateTime(lote.deshechoEn)}.</span>
      ) : (
        <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="batchId" value={lote.id} />
          <Button type="submit" variant="secondary" disabled={pending || bloqueado} className="w-fit">
            {pending ? "Deshaciendo..." : "Deshacer este lote"}
          </Button>
          {lote.conDiagnostico > 0 ? (
            <span className="text-xs text-muted-foreground">
              No se puede deshacer: ya se generó un diagnóstico sobre una de sus consultas, y un diagnóstico
              firmado no se borra. Lo importado pasó a ser parte de su historia clínica; si hay algo que
              corregir, se corrige la evaluación.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Retira sus consultas y los pacientes que creó. A un paciente que ya existía solo le quita las
              consultas.
            </span>
          )}
        </form>
      )}
      {state.error ? <p className="text-destructive">{state.error}</p> : null}
      {state.mensaje ? <p className="text-foreground">{state.mensaje}</p> : null}
    </li>
  );
}

export function LotesImportados({ lotes }: { lotes: LoteImportado[] }) {
  if (lotes.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-foreground">Lotes importados</h2>
      <ul className="flex flex-col gap-3">
        {lotes.map((l) => (
          <FilaDeLote key={l.id} lote={l} />
        ))}
      </ul>
    </section>
  );
}
