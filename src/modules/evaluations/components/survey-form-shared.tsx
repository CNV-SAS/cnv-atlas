"use client";

import { Label } from "@/components/ui/label";

// Piezas compartidas por las dos fases del intake (firmar y encuesta). Modulo NEUTRO de cliente: solo
// presentacion, sin server-only ni acciones. Asi ambos formularios se ven igual sin duplicar estilos.

export const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

export const checkboxClass = "mt-1 size-4 shrink-0 accent-primary";

// Campo etiquetado (label arriba, control abajo).
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
