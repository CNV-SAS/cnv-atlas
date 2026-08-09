"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { declareRemesaFormAction } from "../actions";
// Tipos desde el módulo neutro, NO desde el service `server-only` (este es un componente cliente).
import type { EligibleProfessional, RemesableProduct } from "../remesa-types";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

const selectClass =
  "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Declarar una remesa (CNV envía a un integrante). Solo se ofrecen los integrantes que pueden sostener
// consignación (nutricionistas o con inventario) y los productos en_consultorio.
export function DeclararRemesaForm({
  professionals,
  products,
}: {
  professionals: EligibleProfessional[];
  products: RemesableProduct[];
}) {
  const [state, action, pending] = useActionState(declareRemesaFormAction, initial);
  useFormToast(state);

  if (professionals.length === 0 || products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {professionals.length === 0
          ? "No hay integrantes que puedan sostener consignación todavía."
          : "No hay productos en consultorio para enviar."}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="professionalId">Integrante</Label>
        <select id="professionalId" name="professionalId" required className={`${selectClass} w-56`}>
          <option value="">Selecciona un integrante</option>
          {professionals.map((p) => (
            <option key={p.professionalId} value={p.professionalId}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nutraceuticalId">Producto</Label>
        <select id="nutraceuticalId" name="nutraceuticalId" required className={`${selectClass} w-56`}>
          <option value="">Selecciona un producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quantity">Cantidad enviada</Label>
        <Input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} required className="w-32" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lote">Lote (opcional)</Label>
        <Input id="lote" name="lote" placeholder="Lote" className="w-40" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Declarando..." : "Declarar remesa"}
      </Button>
    </form>
  );
}
