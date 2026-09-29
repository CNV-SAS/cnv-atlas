"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { declararDevolucionFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

export type LoteParaDevolver = {
  lotId: string;
  nutraceuticalId: string;
  producto: string;
  codigo: string;
  vence: string;
  disponible: number;
};

// EL INTEGRANTE DECLARA lo que despacha de vuelta a CNV.
//
// SE ELIGE UN LOTE, NO UN PRODUCTO: el motivo mas comun de devolver es el vencimiento, y ese es del lote. Y
// el desplegable trae el vencimiento a la vista, porque es lo que hace la eleccion obvia.
export function DeclararDevolucionForm({ lotes }: { lotes: LoteParaDevolver[] }) {
  const [state, action, pending] = useActionState(declararDevolucionFormAction, initial);
  useFormToastAndRefresh(state);
  const [lotId, setLotId] = useState("");
  const elegido = lotes.find((l) => l.lotId === lotId);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3">
      {/* El producto viaja junto al lote, resuelto aqui: el servidor no tiene por que deducirlo y el
          Integrante no tiene por que elegirlo dos veces. */}
      <input type="hidden" name="nutraceuticalId" value={elegido?.nutraceuticalId ?? ""} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dev-lote">Lote que devuelves</Label>
        <select
          id="dev-lote"
          name="lotId"
          required
          value={lotId}
          onChange={(e) => setLotId(e.target.value)}
          className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Elige el lote</option>
          {lotes.map((l) => (
            <option key={l.lotId} value={l.lotId}>
              {l.producto} · lote {l.codigo} · vence {l.vence} · tienes {l.disponible}
            </option>
          ))}
        </select>
      </div>

      {elegido ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev-cantidad">Cuántas unidades despachas</Label>
            <Input
              id="dev-cantidad"
              name="quantity"
              type="number"
              min={1}
              max={elegido.disponible}
              required
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">
              Tienes {elegido.disponible} de ese lote sin devolver.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev-motivo">Por qué lo devuelves</Label>
            <Input
              id="dev-motivo"
              name="reason"
              required
              maxLength={300}
              placeholder="Ej. no rota en mi consultorio, o está cerca de vencer"
              className="max-w-md"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Declarando..." : "Declarar la devolución"}
            </Button>
            {/* SE DICE ANTES DE PULSAR, no solo despues: si creyera que su saldo baja ya, su proximo conteo
                le parecería un sobrante y podria "corregirlo" contando mal. */}
            <span className="text-xs text-muted-foreground">
              Tu saldo baja cuando CNV confirme lo que recibió, no ahora.
            </span>
          </div>
        </>
      ) : null}
    </form>
  );
}
