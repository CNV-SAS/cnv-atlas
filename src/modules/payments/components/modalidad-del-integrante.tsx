"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cambiarModalidadFormAction } from "../actions";
import { MODALIDAD_LABEL, type Modalidad } from "../modalidad";

// ═══ LA MODALIDAD DE UN INTEGRANTE, DESDE ADMIN (2026-09-25) ═══
//
// LAS DOS CARDS SON TEXTO DEL MODELO COMERCIAL §13, no redaccion nuestra: ese texto esta validado y dice cosas
// con consecuencia tributaria y legal (quien practica retencion, quien asume el retracto). Se porta, no se
// mejora. La nota de diseño del propio §13 dice ademas que las dos dejan el MISMO margen del 20 % y que "las
// cards deben transmitir eso, para que la decision se tome por el criterio correcto"; por eso el margen no se
// usa como argumento de venta de ninguna de las dos.
//
// EL CAMBIO NO ES INMEDIATO Y LA PANTALLA LO DICE ANTES de pulsar, no solo despues: rige desde el inicio del
// siguiente corte (§2). Un boton que parece instantaneo y no lo es se interpreta como que fallo.

const initial = { error: null as string | null, success: null as string | null, warning: null as string | null };

const REQUISITOS = [
  "Ser responsable de IVA (protege al Integrante: si no lo es, el IVA que CNV le factura se vuelve costo no descontable)",
  "Estar habilitado como facturador electrónico ante la DIAN",
  "Aceptar cupo de crédito, plazos de pago y registro obligatorio de ventas en Atlas",
  "Estar al día en sus obligaciones económicas con CNV",
];

const CARDS: Record<Modalidad, { encabezado: string; explicacion: string; aFavor: string[]; enContra: string[] }> = {
  comision: {
    encabezado: "CNV cobra al paciente y él recibe una comisión.",
    explicacion:
      "El paciente paga directamente a CNV por el enlace de pago que genera Atlas. CNV emite la factura al paciente. Él recibe su comisión en la liquidación mensual.",
    aFavor: [
      "No maneja facturación al paciente, ni notas crédito, ni pagos a CNV.",
      "No requiere ser responsable de IVA.",
      "Sin cupo de crédito ni plazos de pago que cumplir.",
      "No asume el riesgo de la relación de consumo con el paciente (garantías, retracto en ventas a domicilio).",
      "No necesita capital de trabajo: nunca le compra inventario a CNV.",
    ],
    enContra: [
      "Si él también le cobra al paciente por consulta u otros productos, el paciente hace dos pagos a dos destinatarios.",
      "No define el precio de venta al público.",
      "CNV le practica retención en la fuente sobre su comisión (10 % u 11 % según su situación).",
      "Si es responsable de IVA, su comisión lleva IVA del 19 % y debe declararlo; si está obligado a facturar, debe emitirle factura a CNV por cada liquidación.",
    ],
  },
  distribucion: {
    encabezado: "Él cobra y factura al paciente, y CNV le factura a él.",
    explicacion:
      "El paciente le paga a él, y él le factura con su propia facturación, en un solo documento junto con sus demás servicios. Cada quincena CNV le factura los productos vendidos al precio base menos su descuento comercial, más IVA.",
    aFavor: [
      "El paciente hace un solo pago por todo.",
      "Él define el precio final de venta.",
      "Mayor control sobre su relación comercial con el paciente.",
      "No se le practica retención sobre su margen, porque su ganancia es un descuento comercial y no un pago de CNV a él.",
      "El IVA que CNV le factura es descontable para él, así que no es un costo.",
      "Paga después de vender: la factura quincenal cubre solo lo efectivamente vendido en el período.",
    ],
    enContra: [
      "Asume su propia facturación al paciente y las notas crédito de estos productos.",
      "Recibe factura de CNV cada quincena y debe pagarla en el plazo acordado.",
      "Opera con un cupo de crédito que, al agotarse, suspende los despachos.",
      "Asume la relación de consumo con el paciente: garantías, reclamos y, en ventas a domicilio, el derecho de retracto.",
      "Requiere estar al día en sus obligaciones tributarias, porque él factura y declara el IVA de estas ventas.",
      "Si es agente de retención, deberá practicarle retención a CNV y expedirle el certificado.",
    ],
  },
};

function Card({ modalidad, activa }: { modalidad: Modalidad; activa: boolean }) {
  const c = CARDS[modalidad];
  return (
    <div
      className={[
        "flex flex-col gap-2 rounded-xl border p-4 text-sm",
        activa ? "border-primary/40 bg-primary/5" : "border-border bg-background",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">Modalidad {MODALIDAD_LABEL[modalidad]}</h3>
        {activa ? <span className="text-xs font-medium text-primary">La que le aplica hoy</span> : null}
      </div>
      <p className="font-medium">{c.encabezado}</p>
      <p className="text-muted-foreground">{c.explicacion}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">A favor</span>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
            {c.aFavor.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En contra</span>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
            {c.enContra.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function ModalidadDelIntegrante({
  professionalId,
  modalidad,
  rigeDesde,
  pendiente,
  proximoCorte,
  puedeCambiar,
}: {
  professionalId: string;
  modalidad: Modalidad;
  rigeDesde: string | null;
  pendiente: { modalidad: Modalidad; rigeDesde: string } | null;
  /** Desde cuando regiria un cambio pedido hoy. Se dice ANTES de pulsar. */
  proximoCorte: string;
  puedeCambiar: boolean;
}) {
  const [state, action, pending] = useActionState(cambiarModalidadFormAction, initial);
  const [hacia, setHacia] = useState<Modalidad>(modalidad === "comision" ? "distribucion" : "comision");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Hoy le aplica <strong className="text-foreground">{MODALIDAD_LABEL[modalidad]}</strong>
        {rigeDesde ? `, desde el ${rigeDesde}` : " (por defecto: nunca se le ha asignado otra)"}.
        {pendiente ? (
          <span className="ml-1 font-medium text-attention">
            Hay un cambio a {MODALIDAD_LABEL[pendiente.modalidad]} que empieza el {pendiente.rigeDesde}.
          </span>
        ) : null}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card modalidad="comision" activa={modalidad === "comision"} />
        <Card modalidad="distribucion" activa={modalidad === "distribucion"} />
      </div>

      {puedeCambiar ? (
        <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <input type="hidden" name="professionalId" value={professionalId} />
          <input type="hidden" name="hacia" value={hacia} />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Cambiar de modalidad</span>
            {/* LA FECHA SE DICE ANTES DE PULSAR. Es lo que evita que el cambio se sienta roto: rige desde el
                inicio del siguiente corte, no hoy. */}
            <span className="text-xs text-muted-foreground">
              Un cambio pedido hoy rige desde el <strong className="text-foreground">{proximoCorte}</strong>. Lo
              que se venda hasta ese día se liquida bajo {MODALIDAD_LABEL[modalidad]}, para no partir el
              período en dos regímenes.
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {(["comision", "distribucion"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="eleccion"
                  value={m}
                  checked={hacia === m}
                  onChange={() => setHacia(m)}
                  className="accent-primary"
                />
                Pasar a {MODALIDAD_LABEL[m]}
              </label>
            ))}
          </div>

          {/* LOS REQUISITOS NO LOS PUEDE COMPROBAR ATLAS (dos viven fuera: la DIAN y estar al dia con CNV), asi
              que no se simula la verificacion: se le pide a admin que declare que los verifico, y eso queda con
              su fecha. Marcar sin haber verificado es una decision de una persona, no un hueco del sistema. */}
          {hacia === "distribucion" ? (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Requisitos de Distribución (modelo comercial §2)
              </span>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-muted-foreground">
                {REQUISITOS.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="requisitos" className="mt-1 accent-primary" />
                <span>Confirmo que verifiqué los cuatro requisitos con él.</span>
              </label>
              <span className="text-xs text-muted-foreground">
                Si después pierde alguno, CNV puede revertirlo a Comisión con quince días de preaviso.
              </span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="nota-modalidad" className="text-xs">
              Nota (opcional)
            </Label>
            <Input id="nota-modalidad" name="nota" placeholder="Por qué se cambia" className="h-9" />
          </div>

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Registrando..." : `Pasar a ${MODALIDAD_LABEL[hacia]} desde el ${proximoCorte}`}
          </Button>

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-primary">{state.success}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
