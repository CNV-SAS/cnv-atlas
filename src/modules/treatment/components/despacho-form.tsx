"use client";

import { useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordDespachoFormAction } from "@/modules/nutraceuticals/actions";
import type { NutraceuticalFormState } from "@/modules/nutraceuticals/validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

type Product = { id: string; name: string; stock: number };

// Formulario de entrega (despacho) al paciente. Descuenta el inventario en consignacion del profesional.
// Muestra el saldo por producto y, si la entrega dejaria el inventario en negativo, avisa ANTES de enviar
// (permite entregar igual: la diferencia queda visible, nunca se calla). El descuento real y el aviso final
// los confirma la action tras registrar el movimiento.
export function DespachoForm({
  evaluationId,
  treatmentId,
  products,
}: {
  evaluationId: string;
  treatmentId: string;
  products: Product[];
}) {
  const [state, action, pending] = useActionState(recordDespachoFormAction, initial);
  useFormToast(state);
  const [selected, setSelected] = useState("");
  const [qty, setQty] = useState("");

  const prod = products.find((p) => p.id === selected);
  const q = Number(qty);
  const resulting = prod && Number.isInteger(q) && q > 0 ? prod.stock - q : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="treatmentId" value={treatmentId} />
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="despacho-nutra">Producto</Label>
          <select
            id="despacho-nutra"
            name="nutraceuticalId"
            required
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Selecciona un producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (tienes {p.stock})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="despacho-qty">Cantidad entregada</Label>
          <Input
            id="despacho-qty"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-32"
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar entrega"}
        </Button>
      </div>
      {resulting !== null && resulting < 0 ? (
        <p className="max-w-prose rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Tu inventario de {prod?.name} quedaria en {resulting}. Puedes entregar igual; la diferencia quedara
          visible en Mi inventario para que la revises (registra la recepcion que falte o repórtala en el conteo).
        </p>
      ) : null}
    </form>
  );
}
