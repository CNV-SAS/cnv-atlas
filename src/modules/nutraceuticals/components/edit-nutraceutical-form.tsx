"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateNutraceuticalFormAction } from "../actions";
import type { Nutraceutical } from "../types";
import type { NutraceuticalFormState } from "../validations";
import { PriceIvaField } from "./price-iva-field";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

export function EditNutraceuticalForm({ nutraceutical: n }: { nutraceutical: Nutraceutical }) {
  const [state, action, pending] = useActionState(updateNutraceuticalFormAction, initial);
  useFormToast(state);

  return (
    <form action={action} className="mt-2 flex flex-col gap-3">
      <input type="hidden" name="id" value={n.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`name-${n.id}`}>Nombre</Label>
          <Input id={`name-${n.id}`} name="name" required defaultValue={n.name} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`desc-${n.id}`}>Descripcion</Label>
          <Input id={`desc-${n.id}`} name="description" defaultValue={n.description ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`unit-${n.id}`}>Unidad</Label>
          <Input id={`unit-${n.id}`} name="unit" defaultValue={n.unit ?? ""} />
        </div>
        <PriceIvaField
          id={`price-${n.id}`}
          initialValue={n.unit_price != null ? Number(n.unit_price) : null}
        />
      </div>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
