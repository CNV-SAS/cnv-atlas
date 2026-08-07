"use client";

import { useActionState, useState } from "react";

import { useFormToast } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { submitJustificationFormAction } from "../actions";
import type { NutraceuticalFormState } from "../validations";

const initial: NutraceuticalFormState = { error: null, success: null, warning: null };

// Etiqueta de cada categoria y QUE REFERENCIA pide: un numero de denuncia, una guia o un id de movimiento no
// son lo mismo. El campo pide lo que corresponde a la categoria elegida, no un texto generico: sin eso,
// "referencia obligatoria" se cumpliria escribiendo cualquier cosa.
const CATEGORIES: { value: string; label: string; refLabel: string; refPlaceholder: string }[] = [
  { value: "hurto_denuncia", label: "Hurto o robo (con denuncia)", refLabel: "Número de denuncia", refPlaceholder: "Ej. 2026-123456" },
  { value: "transporte_documentado", label: "Daño o pérdida en transporte (documentado)", refLabel: "Número de guía de transporte", refPlaceholder: "Ej. GUIA-987654" },
  { value: "venta_no_registrada", label: "Venta no registrada (se corrige en Atlas)", refLabel: "ID del movimiento de venta o despacho", refPlaceholder: "Pega el id del movimiento" },
  { value: "devolucion_guia", label: "Devolución a CNV (con guía)", refLabel: "Número de guía de devolución", refPlaceholder: "Ej. DEV-456789" },
];

export function JustificarFaltanteForm({ caseId }: { caseId: string }) {
  const [state, action, pending] = useActionState(submitJustificationFormAction, initial);
  useFormToast(state);
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const cat = CATEGORIES.find((c) => c.value === category);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`cat-${caseId}`}>Motivo</Label>
        <select
          id={`cat-${caseId}`}
          name="category"
          required
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setReference("");
          }}
          className="flex h-9 w-full max-w-md rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Selecciona el motivo</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {cat ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`ref-${caseId}`}>{cat.refLabel}</Label>
          <Input
            id={`ref-${caseId}`}
            name="reference"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={cat.refPlaceholder}
            className="w-full max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            La referencia es obligatoria: no basta afirmar la pérdida, hay que soportarla.
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={pending || !category || reference.trim() === ""} className="w-fit">
        {pending ? "Enviando..." : "Enviar justificación"}
      </Button>
    </form>
  );
}
