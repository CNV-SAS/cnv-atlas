"use client";

import { useActionState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { setStockFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Ajuste de stock (cantidad absoluta). El padre lo remonta con key por stock para
// que el input tome el valor nuevo tras revalidar (lección del select de B4).
export function SetStockForm({
  nutraceuticalId,
  currentStock,
}: {
  nutraceuticalId: string;
  currentStock: number | null;
}) {
  const [state, action, pending] = useActionState(setStockFormAction, initial);
  useFormToast(state);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="nutraceuticalId" value={nutraceuticalId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`stock-${nutraceuticalId}`} className="text-xs">
          Nuevo stock
        </Label>
        <Input
          id={`stock-${nutraceuticalId}`}
          name="stockQuantity"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={currentStock ?? 0}
          className="h-8 w-28"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Ajustar stock"}
      </Button>
    </form>
  );
}
