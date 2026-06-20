"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { baseFromTotal, ivaFromTotal } from "@/core/iva";

function cop(n: number): string {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

// Campo de precio (PVP con IVA incluido) con desglose informativo en vivo:
// "Base: X + IVA 19%: Y = Total: Z". El valor que se persiste sigue siendo el PVP;
// el desglose es solo orientativo para el admin. name fijo "unitPrice" (lo lee el
// form action); id e initial vienen por props para reusarlo en crear y editar.
export function PriceIvaField({ id, initialValue }: { id: string; initialValue?: number | null }) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const total = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(total) && total > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Precio unitario, PVP con IVA (COP)</Label>
      <Input
        id={id}
        name="unitPrice"
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {valid ? (
        <p className="text-xs text-muted-foreground">
          Base: {cop(baseFromTotal(total))} + IVA 19%: {cop(ivaFromTotal(total))} = Total:{" "}
          {cop(total)}
        </p>
      ) : null}
    </div>
  );
}
