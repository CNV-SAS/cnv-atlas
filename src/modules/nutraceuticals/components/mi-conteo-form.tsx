"use client";

import { useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { recordCountFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Conteo fisico (T3b-3 ST2). A CIEGAS a proposito: NO se muestra el saldo del sistema, para que el conteo sea
// lo que hay en la vitrina y no una copia del numero esperado. El diff lo computa el servidor. PARCIAL
// permitido: los productos que se dejen en blanco no entran en este conteo (se registra QUE se conto).
export function MiConteoForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(recordCountFormAction, initial);
  useFormToast(state);
  const [rows, setRows] = useState<Record<string, { qty: string; lote: string }>>({});

  const set = (id: string, field: "qty" | "lote", value: string) =>
    setRows((prev) => {
      const cur = prev[id] ?? { qty: "", lote: "" };
      return { ...prev, [id]: { ...cur, [field]: value } };
    });

  const lines = products
    .filter((p) => (rows[p.id]?.qty ?? "").trim() !== "")
    .map((p) => ({
      nutraceuticalId: p.id,
      lote: rows[p.id]?.lote.trim() ? rows[p.id].lote.trim() : undefined,
      physicalQty: Number(rows[p.id].qty),
    }));

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-4">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="flex flex-col gap-2">
        {products.map((p) => (
          <div key={p.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
            <span className="min-w-[12rem] flex-1 font-medium text-foreground">{p.name}</span>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qty-${p.id}`}>Contado</Label>
              <Input
                id={`qty-${p.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={rows[p.id]?.qty ?? ""}
                onChange={(e) => set(p.id, "qty", e.target.value)}
                className="w-28"
                placeholder="-"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`lote-${p.id}`}>Lote (opcional)</Label>
              <Input
                id={`lote-${p.id}`}
                value={rows[p.id]?.lote ?? ""}
                onChange={(e) => set(p.id, "lote", e.target.value)}
                className="w-36"
                placeholder="Lote"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input id="note" name="note" className="w-full" placeholder="Observaciones del conteo" />
      </div>
      <Button type="submit" disabled={pending || lines.length === 0}>
        {pending ? "Registrando..." : "Registrar conteo"}
      </Button>
      <p className="max-w-prose text-xs text-muted-foreground">
        Cuenta lo que puedas; los productos que dejes en blanco no entran en este conteo. Si cuentas menos de
        lo que el sistema tiene, se abre un caso de faltante que espera tu justificación.
      </p>
    </form>
  );
}
