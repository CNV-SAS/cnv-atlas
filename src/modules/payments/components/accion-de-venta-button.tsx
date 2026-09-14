"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  anularLinkFormAction,
  entregarVentaFormAction,
  resolverComoDevueltoFormAction,
  resolverComoSegundaCompraFormAction,
} from "../actions";
import type { AccionDeVentaState } from "../validations";

const initial: AccionDeVentaState = { error: null, success: null, warning: null };

// LOS BOTONES QUE ACTUAN SOBRE UNA VENTA, en dos pasos porque ninguno se deshace:
//
//   · ANULAR LINK (decision (a) de Santiago, 2026-09-14): el link deja de servir y sus unidades quedan libres.
//     Si el paciente ya tenia abierta la pagina de Wompi y paga igual, Atlas no lo factura solo.
//   · ENTREGAR: el paciente se llevo el producto. Queda en la auditoria clinica.
//   · SEGUNDA COMPRA / DEVUELTO: la decision sobre un pago que llego sobre un link anulado.
//
// EL REFRESCO LO HACE LA PANTALLA, DESPUES DEL TOAST (`useFormToastAndRefresh`): el boton desaparece al
// actuar, y si la accion revalidara, se desmontaria antes de mostrar el mensaje.

const ACCIONES = {
  anular: {
    accion: anularLinkFormAction,
    pedir: "Anular link",
    aviso: "El paciente ya no podrá pagarlo.",
    confirmar: "Sí, anular",
    enCurso: "Anulando...",
    variante: "destructive" as const,
  },
  entregar: {
    accion: entregarVentaFormAction,
    pedir: "Entregar",
    aviso: "Confirma que el paciente se lleva el producto.",
    confirmar: "Sí, lo entregué",
    enCurso: "Registrando...",
    variante: "default" as const,
  },
  segunda_compra: {
    accion: resolverComoSegundaCompraFormAction,
    pedir: "Fue una segunda compra",
    aviso: "Atlas descuenta el inventario y emite la factura.",
    confirmar: "Sí, facturar",
    enCurso: "Resolviendo...",
    variante: "default" as const,
  },
  devuelto: {
    accion: resolverComoDevueltoFormAction,
    pedir: "Ya se devolvió el pago",
    aviso: "Confirma que devolviste el pago desde Wompi. No se factura.",
    confirmar: "Sí, está devuelto",
    enCurso: "Resolviendo...",
    variante: "destructive" as const,
    // El comprobante es soporte obligatorio de una devolucion (contabilidad, 2026-09-14).
    campo: { name: "comprobante", label: "Comprobante de la devolución en Wompi", placeholder: "Referencia de la devolución" },
  },
};

type Campo = { name: string; label: string; placeholder: string };

export type AccionDeVenta = keyof typeof ACCIONES;

export function AccionDeVentaButton({ transactionId, tipo }: { transactionId: string; tipo: AccionDeVenta }) {
  const a = ACCIONES[tipo];
  const campo = ("campo" in a ? a.campo : null) as Campo | null;
  const [state, action, pending] = useActionState(a.accion, initial);
  useFormToastAndRefresh(state);
  const [confirmando, setConfirmando] = useState(false);
  // Controlado: un error del servidor (por ejemplo, falta la version) no borra lo escrito (hazard 2).
  const [valor, setValor] = useState("");

  if (!confirmando) {
    return (
      <Button key="pedir" type="button" size="sm" variant="outline" onClick={() => setConfirmando(true)}>
        {a.pedir}
      </Button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <span className="text-xs text-muted-foreground">{a.aviso}</span>
      {campo ? (
        <Input
          name={campo.name}
          aria-label={campo.label}
          placeholder={campo.placeholder}
          required
          maxLength={200}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-8 w-56"
        />
      ) : null}
      {/* `key` distinta de la del primer boton: el mismo nodo pasando de type=button a submit dentro del
          clic se enviaria solo (hazard 1 de CLAUDE.md). */}
      <Button
        key="confirmar"
        type="submit"
        size="sm"
        variant={a.variante}
        disabled={pending || (campo != null && valor.trim().length < 3)}
      >
        {pending ? a.enCurso : a.confirmar}
      </Button>
      <Button
        key="cancelar"
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => setConfirmando(false)}
      >
        Cancelar
      </Button>
    </form>
  );
}
