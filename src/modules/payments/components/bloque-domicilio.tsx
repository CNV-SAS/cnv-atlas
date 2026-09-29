"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CiudadParaElegir = { city: string; department: string };

// ═══ EL BLOQUE DE ENVIO A DOMICILIO (0190) ═══
//
// SE MONTA EN LOS DOS CAMINOS DE VENTA (el link de pago y el efectivo), y por eso vive aparte: el mismo
// bloque en dos formularios que ya son distintos, sin copiarlo.
//
// TRES COSAS QUE NO SON DE ESTILO:
//
//   1. SI NO HAY COBERTURA, NO SE PINTA NADA. El modelo §5.5 lo dice al reves de como se suele hacer: "es
//      preferible NO ofrecer el domicilio a un destino que ofrecerlo y perder dinero en cada envio". Un
//      bloque deshabilitado con un mensaje invita a preguntar; la ausencia no.
//   2. LA CIUDAD ES UNA LISTA, no un campo libre. Un texto libre deja cobrar un envio a un destino sin
//      cobertura, y ademas rompe el registro de municipio que el analisis de ICA necesita (§5.5).
//   3. EL FLETE SE MUESTRA ANTES DE COBRAR y se dice que se suma. El paciente paga producto MAS flete en el
//      mismo cobro (§5.3), y una cifra que aparece despues de pulsar es una sorpresa con su plata.
export function BloqueDomicilio({
  ciudades,
  tarifa,
  total,
}: {
  ciudades: CiudadParaElegir[];
  tarifa: number | null;
  total: number;
}) {
  const [aDomicilio, setADomicilio] = useState(false);
  const [ciudad, setCiudad] = useState("");

  if (tarifa == null || ciudades.length === 0) return null;

  const elegida = ciudades.find((c) => c.city === ciudad);

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border p-3">
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="aDomicilio"
          value="true"
          checked={aDomicilio}
          onChange={(e) => setADomicilio(e.target.checked)}
          className="size-4"
        />
        Enviar a domicilio (flete {tarifa.toLocaleString("es-CO")} COP)
      </label>

      {aDomicilio ? (
        <div className="flex flex-col gap-3">
          {/* SALE DE LA BODEGA DE CNV, y se dice: el producto que va a domicilio no sale de la vitrina del
              profesional (§5.1), asi que el no lo entrega ni descuenta de su inventario. */}
          <p className="text-xs text-muted-foreground">
            El producto sale de la bodega de CNV y lo despacha CNV: no se descuenta de tu inventario y el
            paciente no se lo lleva hoy. Se le cobra el producto más el flete en el mismo pago.
          </p>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ciudadDestino">Ciudad de destino</Label>
              <select
                id="ciudadDestino"
                name="ciudadDestino"
                required={aDomicilio}
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Elige la ciudad</option>
                {ciudades.map((c) => (
                  <option key={`${c.city}-${c.department}`} value={c.city}>
                    {c.city} ({c.department})
                  </option>
                ))}
              </select>
              <input type="hidden" name="departamentoDestino" value={elegida?.department ?? ""} />
            </div>

            <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
              <Label htmlFor="direccionEntrega">Dirección de entrega</Label>
              <Input
                id="direccionEntrega"
                name="direccionEntrega"
                required={aDomicilio}
                maxLength={300}
                placeholder="Calle, número, apartamento, barrio"
              />
            </div>
          </div>

          <p className="text-sm text-foreground">
            Total con envío:{" "}
            <strong>{(total + tarifa).toLocaleString("es-CO")} COP</strong>
          </p>
        </div>
      ) : null}
    </div>
  );
}
