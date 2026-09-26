"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCheckoutFormAction, registerCashSaleFormAction } from "@/modules/payments/actions";
import type { CashSaleFormState, PaymentFormState } from "@/modules/payments/validations";
import { MENSAJE_MINIMO_WOMPI, WOMPI_MONTO_MINIMO } from "@/modules/payments/wompi-minimo";

export type ProductoVendible = {
  id: string;
  name: string;
  /** Null si el producto no tiene precio: no se puede cobrar. */
  unitPrice: number | null;
  /** Saldo menos reservas vivas en la ubicacion de donde sale la venta. */
  disponible: number;
  /**
   * Lo que hay en la BODEGA CENTRAL del mismo producto. Solo para DECIRLO cuando su vitrina esta en cero: un
   * "Sin unidades disponibles" a secas dejaba al profesional bloqueado sin saber que si habia producto, y
   * pidiendoselo al paciente para otro dia cuando bastaba pedir una remesa.
   */
  enCentral: number;
};

const checkoutInicial: PaymentFormState = { error: null, success: null, checkoutUrl: null, duplicateWarning: null };
const efectivoInicial: CashSaleFormState = { error: null, success: null, duplicateWarning: null, pendingLinkWarning: null };

// ═══ COBRAR EN CONSULTA (Bloque 3, sesion 2) ═══
//
// Reemplaza a "Registrar entrega". El profesional marca lo que el paciente se lleva de lo prescrito, y cobra:
// con QR (el paciente paga en Wompi desde su telefono) o en efectivo. La entrega va DESPUES, sobre la venta
// pagada. Asi no hay camino para que un producto salga del consultorio sin venta.
//
// Las MISMAS acciones que `/pagos`, con el tratamiento: una sola regla de venta, dos pantallas.
//
// TODO EL ENVIO ARMA SU FormData A MANO (`ejecutarAccion`): las confirmaciones (duplicado, anular el link)
// viajan como campos, no como name/value de un boton, que `new FormData(form)` no incluye (hazard 5).
export function VentaEnConsultaForm({
  evaluationId,
  treatmentId,
  patientId,
  productos,
}: {
  evaluationId: string;
  treatmentId: string;
  patientId: string;
  productos: ProductoVendible[];
}) {
  const [checkout, accionCheckout, generando] = useActionState(createCheckoutFormAction, checkoutInicial);
  const [efectivo, accionEfectivo, registrando] = useActionState(registerCashSaleFormAction, efectivoInicial);
  const pending = generando || registrando;

  // Lo marcado y su cantidad. Nada marcado al abrir: el paciente dijo que SI los adquiere, no cuales ni
  // cuantos, y un producto marcado por defecto es un cobro que nadie eligio.
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const marcar = (id: string, si: boolean) =>
    setCantidades((prev) => {
      const next = { ...prev };
      if (si) next[id] = "1";
      else delete next[id];
      return next;
    });
  const lineas = Object.entries(cantidades).map(([nutraceuticalId, quantity]) => ({ nutraceuticalId, quantity }));

  const total = useMemo(
    () =>
      lineas.reduce((suma, l) => {
        const p = productos.find((x) => x.id === l.nutraceuticalId);
        const q = Number(l.quantity);
        return suma + (p?.unitPrice != null && Number.isFinite(q) && q > 0 ? p.unitPrice * q : 0);
      }, 0),
    [lineas, productos],
  );

  // Clave de idempotencia del intento de EFECTIVO: un doble clic manda la misma; tras una venta, una nueva.
  const claveEfectivo = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  const [confirmandoEfectivo, setConfirmandoEfectivo] = useState(false);
  // Si el profesional ya confirmo anular el link y despues sale el aviso de duplicado, confirmar el duplicado
  // no puede olvidar la anulacion: la accion volveria a avisar del link y el profesional daria vueltas.
  const anularConfirmado = useRef(false);

  // AL COBRAR, LA SELECCION SE LIMPIA: dejar marcado lo que ya se cobro invita a cobrarlo otra vez. Se hace
  // al RENDERIZAR el estado nuevo (el patron de React para ajustar estado cuando cambia otro), no en el efecto:
  // un setState dentro del efecto pinta una vez con la seleccion vieja.
  const [checkoutVisto, setCheckoutVisto] = useState(checkout);
  if (checkout !== checkoutVisto) {
    setCheckoutVisto(checkout);
    if (checkout.success) setCantidades({});
  }
  const [efectivoVisto, setEfectivoVisto] = useState(efectivo);
  if (efectivo !== efectivoVisto) {
    setEfectivoVisto(efectivo);
    if (efectivo.success) {
      setCantidades({});
      setConfirmandoEfectivo(false);
    }
  }

  const ultimoCheckout = useRef(checkout);
  useEffect(() => {
    if (checkout === ultimoCheckout.current) return;
    ultimoCheckout.current = checkout;
    if (checkout.error) toast.error(checkout.error);
    else if (checkout.duplicateWarning) toast.warning(checkout.duplicateWarning);
    else if (checkout.success) {
      toast.success("Link de pago creado. Muéstrale el QR al paciente.");
    }
  }, [checkout]);

  const ultimoEfectivo = useRef(efectivo);
  useEffect(() => {
    if (efectivo === ultimoEfectivo.current) return;
    ultimoEfectivo.current = efectivo;
    if (efectivo.error) toast.error(efectivo.error);
    else if (efectivo.pendingLinkWarning) toast.warning(efectivo.pendingLinkWarning);
    else if (efectivo.duplicateWarning) toast.warning(efectivo.duplicateWarning);
    else if (efectivo.success) {
      toast.success(efectivo.success);
      claveEfectivo.current = crypto.randomUUID();
      anularConfirmado.current = false;
    }
  }, [efectivo]);

  const base = () => {
    const fd = new FormData();
    fd.set("patientId", patientId);
    fd.set("treatmentId", treatmentId);
    fd.set("evaluationId", evaluationId);
    fd.set("lineas", JSON.stringify(lineas));
    return fd;
  };
  const cobrarConQr = (confirmDuplicate = false) => {
    const fd = base();
    if (confirmDuplicate) fd.set("confirmDuplicate", "true");
    ejecutarAccion(accionCheckout, fd);
  };
  const cobrarEnEfectivo = (opciones: { confirmDuplicate?: boolean; anularLinks?: boolean } = {}) => {
    const fd = base();
    fd.set("idempotencyKey", claveEfectivo.current);
    if (opciones.anularLinks) anularConfirmado.current = true;
    if (opciones.confirmDuplicate) fd.set("confirmDuplicate", "true");
    if (anularConfirmado.current) fd.set("anularLinks", "true");
    ejecutarAccion(accionEfectivo, fd);
  };

  const excede = lineas.some((l) => {
    const p = productos.find((x) => x.id === l.nutraceuticalId);
    return p != null && Number(l.quantity) > p.disponible;
  });
  const listo = lineas.length > 0 && lineas.every((l) => Number.isInteger(Number(l.quantity)) && Number(l.quantity) > 0);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {productos.map((p) => {
          const marcado = p.id in cantidades;
          const sinPrecio = p.unitPrice == null;
          const agotado = p.disponible <= 0;
          const campo = `venta-${p.id}`;
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
              <input
                id={campo}
                type="checkbox"
                checked={marcado}
                disabled={sinPrecio || agotado || pending}
                onChange={(e) => marcar(p.id, e.target.checked)}
                className="size-4 accent-primary"
              />
              <label htmlFor={campo} className="flex min-w-[12rem] flex-1 flex-col">
                <span className="text-sm font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {sinPrecio
                    ? "Sin precio configurado: no se puede cobrar."
                    : `${p.unitPrice!.toLocaleString("es-CO")} COP · disponibles: ${p.disponible}`}
                </span>
              </label>
              {marcado ? (
                <Input
                  aria-label={`Unidades de ${p.name}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={p.disponible}
                  step={1}
                  value={cantidades[p.id]}
                  onChange={(e) => setCantidades((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="h-9 w-24"
                />
              ) : agotado && !sinPrecio ? (
                // ── NO BASTA CON DECIR QUE NO HAY: HAY QUE DECIR DONDE SI (Santiago, 2026-09-26) ──
                // El producto puede estar en bodega central, y entonces lo que falta no es producto sino una
                // remesa. La frase nombra la accion y a quien pedirsela; sin eso el profesional le dice al
                // paciente que vuelva otro dia por algo que CNV tiene en existencia.
                <span className="flex flex-col text-xs text-clinical-warning">
                  <span>No tienes unidades en tu vitrina.</span>
                  {p.enCentral > 0 ? (
                    <span className="text-muted-foreground">
                      Hay {p.enCentral} en la bodega de CNV: pídele una remesa a un administrador.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Tampoco hay en la bodega de CNV.</span>
                  )}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {lineas.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{total.toLocaleString("es-CO")} COP</span> (IVA
          incluido).
        </p>
      ) : null}
      {excede ? (
        <p className="text-sm text-clinical-warning">Pides más unidades de las que tienes disponibles.</p>
      ) : null}
      {lineas.length > 0 && total > 0 && total < WOMPI_MONTO_MINIMO ? (
        <p className="text-sm text-attention">{MENSAJE_MINIMO_WOMPI}</p>
      ) : null}

      {confirmandoEfectivo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-3">
          <span className="text-sm text-foreground">
            ¿Recibiste {total.toLocaleString("es-CO")} COP en efectivo? Ese dinero es de CNV y lo custodias hasta
            consignar.
          </span>
          <Button key="efectivo-si" type="button" size="sm" disabled={pending || !listo} onClick={() => cobrarEnEfectivo()}>
            {registrando ? "Registrando..." : "Sí, lo recibí"}
          </Button>
          <Button
            key="efectivo-no"
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setConfirmandoEfectivo(false)}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            key="qr"
            type="button"
            disabled={pending || !listo || excede || total < WOMPI_MONTO_MINIMO}
            onClick={() => cobrarConQr()}
          >
            {generando ? "Generando..." : "Cobrar con QR"}
          </Button>
          <Button
            key="efectivo"
            type="button"
            variant="outline"
            disabled={pending || !listo || excede}
            onClick={() => setConfirmandoEfectivo(true)}
          >
            Cobrar en efectivo
          </Button>
        </div>
      )}

      {checkout.duplicateWarning ? (
        <div className="flex flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
          <p className="text-attention">{checkout.duplicateWarning}</p>
          <Button type="button" variant="outline" disabled={pending} onClick={() => cobrarConQr(true)} className="self-start">
            Generar otro link de todos modos
          </Button>
        </div>
      ) : null}
      {efectivo.pendingLinkWarning ? (
        <div className="flex flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
          <p className="text-attention">{efectivo.pendingLinkWarning}</p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => cobrarEnEfectivo({ anularLinks: true })}
            className="self-start"
          >
            Anular el link y cobrar en efectivo
          </Button>
        </div>
      ) : null}
      {efectivo.duplicateWarning ? (
        <div className="flex flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
          <p className="text-attention">{efectivo.duplicateWarning}</p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => cobrarEnEfectivo({ confirmDuplicate: true })}
            className="self-start"
          >
            Registrar de todos modos
          </Button>
        </div>
      ) : null}
    </div>
  );
}
