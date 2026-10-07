"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { abrirElConteoFormAction, type AperturaDeConteoState } from "../actions";

const INICIAL: AperturaDeConteoState = { error: null, success: null, warning: null };

// ═══ PEDIRLE UN CONTEO A UN INTEGRANTE, FUERA DEL CALENDARIO (0208) ═══
//
// PARA QUE: el caso que la ventana mensual no cubre. Hay sospecha de una diferencia y hay que contar YA, sin
// esperar al dia 1. Y es tambien la salida de quien se paso su ventana.
//
// EL MOTIVO ES OBLIGATORIO Y SE LE MUESTRA AL INTEGRANTE, y el formulario lo dice antes de que se escriba:
// abrirle un conteo es pedirle trabajo, y el resultado puede ser un caso de faltante con consecuencia
// economica. Una peticion sin explicacion se lee como una acusacion.
//
// SIN `<form>` PROPIO (hazard 7 de CLAUDE.md): esto se monta en pantallas que ya tienen formularios, y un
// `<form>` dentro de otro lo descarta el navegador. Los campos van sin `name` y controlados.
export function PedirConteoForm({
  professionalId,
  nombre,
}: {
  professionalId: string;
  /** Para decir a quien se le pide, que es lo que evita pedirselo al equivocado desde una lista. */
  nombre: string;
}) {
  const [state, action, pending] = useActionState(abrirElConteoFormAction, INICIAL);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  // POR DEFECTO, CINCO DIAS: el mismo largo que la ventana mensual, para no inventar un plazo distinto por
  // cada peticion. Se puede cambiar.
  const [hasta, setHasta] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });

  if (!abierto) {
    return (
      <Button
        key="abrir-peticion-de-conteo"
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setAbierto(true)}
        className="self-start"
      >
        Pedirle un conteo
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      <p className="max-w-prose text-xs text-muted-foreground">
        <strong className="text-foreground">{nombre}</strong> podrá registrar un conteo hasta la fecha que
        elijas, aunque su ventana del mes esté cerrada.{" "}
        <strong className="text-foreground">La razón que escribas se la vamos a mostrar a él.</strong>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`conteo-hasta-${professionalId}`} className="text-xs">
            Puede contar hasta
          </Label>
          <Input
            id={`conteo-hasta-${professionalId}`}
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1">
          <Label htmlFor={`conteo-motivo-${professionalId}`} className="text-xs">
            Por qué le pides el conteo
          </Label>
          {/* SIN `name`, a proposito: este bloque vive dentro de una pantalla con formularios y un campo con
              nombre viajaria en ESE envio. */}
          <Input
            id={`conteo-motivo-${professionalId}`}
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: una venta no cuadra con su saldo"
            autoFocus
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          key="confirmar-peticion-de-conteo"
          type="button"
          size="sm"
          disabled={pending || motivo.trim().length < 5 || hasta === ""}
          onClick={() => {
            const fd = new FormData();
            fd.set("professionalId", professionalId);
            fd.set("hasta", hasta);
            fd.set("motivo", motivo);
            ejecutarAccion(action, fd);
          }}
        >
          {pending ? "Pidiendo..." : "Pedir el conteo"}
        </Button>
        <Button
          key="cancelar-peticion-de-conteo"
          type="button"
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
