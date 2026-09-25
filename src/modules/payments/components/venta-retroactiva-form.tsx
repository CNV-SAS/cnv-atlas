"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enteroDeTexto, pesosDeTexto } from "@/core/pesos";
import { Label } from "@/components/ui/label";

import { registrarVentaRetroactivaAction, type DevolucionState } from "../actions";

// ═══ REGISTRAR UNA VENTA QUE YA OCURRIO (Bloque R) ═══
//
// Es una pantalla de reconstruccion, no de operacion: se usa una vez, para poner en Atlas las ventas que una
// integrante hizo con el HTML y facturo a mano. Por eso pide cosas que ninguna otra venta pide (la fecha
// real, el numero de la factura que ya existe, el precio de ese dia) y no ofrece nada de lo que una venta
// normal ofrece (no genera link, no cobra, no factura).

const inicial: DevolucionState = { error: null, success: null, warning: null };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

export type OpcionSimple = { id: string; nombre: string };

type Linea = { nutraceuticalId: string; cantidad: string; precioUnitario: string };

export function VentaRetroactivaForm({
  organizationId,
  profesionales,
  pacientes,
  productos,
}: {
  organizationId: string;
  profesionales: OpcionSimple[];
  pacientes: OpcionSimple[];
  productos: OpcionSimple[];
}) {
  const [state, action, pending] = useActionState(registrarVentaRetroactivaAction, inicial);
  useFormToastAndRefresh(state);
  const [lineas, setLineas] = useState<Linea[]>([
    { nutraceuticalId: productos[0]?.id ?? "", cantidad: "1", precioUnitario: "" },
  ]);

  const cambiar = (i: number, campo: Partial<Linea>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  const anadir = () =>
    setLineas((prev) => [...prev, { nutraceuticalId: productos[0]?.id ?? "", cantidad: "1", precioUnitario: "" }]);
  const quitar = (i: number) => setLineas((prev) => prev.filter((_, j) => j !== i));

  // SE LEE COMO LO TECLEA UNA PERSONA, no con `Number()`: "11.900" son once mil novecientos, y `Number()`
  // lo leía como 11,9 y lo dejaba pasar. Una venta de doce pesos entra en la comisión y en la liquidación
  // sin que nada avise.
  const leidas = lineas.map((l) => ({
    nutraceuticalId: l.nutraceuticalId,
    cantidad: enteroDeTexto(l.cantidad),
    precioUnitario: pesosDeTexto(l.precioUnitario),
  }));
  const total = leidas.reduce((s, l) => s + (l.precioUnitario ?? 0) * (l.cantidad ?? 0), 0);
  // El aviso dice QUÉ línea y QUÉ campo, aquí mismo, antes de enviar: el servidor volvía a validar y
  // respondía "Revisa los productos, las cantidades y los precios", que no dice cuál ni por qué.
  const problemas = leidas
    .map((l, i) => {
      const faltan = [
        l.cantidad == null || l.cantidad <= 0 ? "la cantidad" : null,
        l.precioUnitario == null || l.precioUnitario <= 0 ? "el precio" : null,
      ].filter(Boolean);
      return faltan.length ? `Producto ${i + 1}: revisa ${faltan.join(" y ")}.` : null;
    })
    .filter((x): x is string => x != null);

  // Las lineas viajan como JSON: el servidor las valida enteras con Zod. `enviarSinReset` evita que un error
  // borre lo tecleado (React 19 resetea los campos con `action` como prop).
  const paraEnviar = JSON.stringify(
    leidas.map((l) => ({
      nutraceuticalId: l.nutraceuticalId,
      cantidad: l.cantidad ?? 0,
      precioUnitario: l.precioUnitario ?? 0,
    })),
  );

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="lineas" value={paraEnviar} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="vr-profesional">Quién la vendió</Label>
          <select id="vr-profesional" name="professionalId" className={selectClass} disabled={pending}>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vr-paciente">A quién</Label>
          <select id="vr-paciente" name="patientId" className={selectClass} disabled={pending}>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vr-fecha">Cuándo ocurrió</Label>
          <Input id="vr-fecha" name="fecha" type="date" disabled={pending} />
          <span className="text-xs text-muted-foreground">
            La fecha real de la venta, no la de hoy: es la que tiene que coincidir con la factura.
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vr-factura">Número de la factura que ya se emitió</Label>
          <Input id="vr-factura" name="numeroDeFactura" placeholder="FE-1234" disabled={pending} />
          <span className="text-xs text-muted-foreground">
            Atlas no va a facturar esta venta. Guarda el número para poder cotejarla con Alegra.
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vr-medio">Cómo pagó</Label>
          <select id="vr-medio" name="medioDePago" className={selectClass} disabled={pending} defaultValue="efectivo">
            <option value="efectivo">Efectivo</option>
            <option value="wompi">Pasarela</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Qué se vendió</span>
        {lineas.map((l, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <select
              aria-label="Producto"
              className={`${selectClass} min-w-48 flex-1`}
              value={l.nutraceuticalId}
              onChange={(e) => cambiar(i, { nutraceuticalId: e.target.value })}
              disabled={pending}
            >
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <Input
              aria-label="Cantidad"
              inputMode="numeric"
              className="w-20"
              value={l.cantidad}
              onChange={(e) => cambiar(i, { cantidad: e.target.value })}
              disabled={pending}
            />
            <Input
              aria-label="Precio unitario de ese día"
              inputMode="numeric"
              placeholder="Precio de ese día"
              className="w-40"
              value={l.precioUnitario}
              onChange={(e) => cambiar(i, { precioUnitario: e.target.value })}
              disabled={pending}
            />
            {lineas.length > 1 ? (
              <Button type="button" variant="ghost" onClick={() => quitar(i)} disabled={pending}>
                Quitar
              </Button>
            ) : null}
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={anadir} disabled={pending} className="w-fit">
            Añadir producto
          </Button>
          <span className="text-sm text-muted-foreground">
            Total: ${total.toLocaleString("es-CO")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          El precio es el que tenía el producto ese día, el que dice la factura. No se toma del catálogo de
          hoy: eso reescribiría la historia con los precios de ahora.
        </p>
      </div>

      <Button type="submit" disabled={pending || problemas.length > 0} className="w-fit">
        Registrar la venta
      </Button>
      {problemas.map((x) => (
        <p key={x} className="text-sm text-destructive">
          {x}
        </p>
      ))}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
