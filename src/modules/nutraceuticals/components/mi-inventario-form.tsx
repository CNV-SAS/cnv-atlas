"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { recordReceptionFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Registrar una recepcion (reconocimiento de custodia). Solo productos en_consultorio (los solo_tienda no
// se stockean). La cantidad la escribe el profesional; el lote es opcional (lo pide el reporte de faltante).
export function MiInventarioForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(recordReceptionFormAction, initial);
  useFormToast(state);

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nutraceuticalId">Producto</Label>
        <select
          id="nutraceuticalId"
          name="nutraceuticalId"
          required
          className="flex h-9 w-56 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Selecciona un producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Cantidad recibida</Label>
        <Input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} required className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lote">Lote (opcional)</Label>
        <Input id="lote" name="lote" placeholder="Lote" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Registrando..." : "Registrar recepción"}
      </Button>
    </form>
  );
}
