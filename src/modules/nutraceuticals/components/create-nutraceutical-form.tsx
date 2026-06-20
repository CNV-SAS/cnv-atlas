"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createNutraceuticalFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";
import { PriceIvaField } from "./price-iva-field";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

export function CreateNutraceuticalForm() {
  const [state, action, pending] = useActionState(createNutraceuticalFormAction, initial);
  useFormToast(state);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required placeholder="Nutraceutico A" />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="description">Descripcion</Label>
          <Input id="description" name="description" placeholder="Opcional" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unit">Unidad</Label>
          <Input id="unit" name="unit" placeholder="capsula, sobre" />
        </div>
        <PriceIvaField id="unitPrice" />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creando..." : "Crear nutraceutico"}
        </Button>
      </div>
    </form>
  );
}
