"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { fleteDelEnvio } from "../domicilio";

export type CiudadParaElegir = { city: string; department: string; costoSugerido: number | null };

// ═══ EL BLOQUE DE ENVIO A DOMICILIO (0190, con el flete por envio desde la 0192) ═══
//
// SE MONTA EN LOS DOS CAMINOS DE VENTA (el link de pago y el efectivo), y por eso vive aparte: el mismo
// bloque en dos formularios que ya son distintos, sin copiarlo.
//
// CUATRO COSAS QUE NO SON DE ESTILO:
//
//   1. SI NO HAY COBERTURA, NO SE PINTA NADA. El modelo §5.5 lo dice al reves de como se suele hacer: "es
//      preferible NO ofrecer el domicilio a un destino que ofrecerlo y perder dinero en cada envio". Un
//      bloque deshabilitado con un mensaje invita a preguntar; la ausencia no.
//   2. LA CIUDAD ES UNA LISTA, no un campo libre. Un texto libre deja cobrar un envio a un destino sin
//      cobertura, y ademas rompe el registro de municipio que el analisis de ICA necesita (§5.5).
//   3. EL COSTO DEL DOMICILIARIO SE TECLEA, y se precarga con el de la ciudad. Es la decision de Santiago:
//      14.000 es fijo en Medellin pero varia en Pereira o Cali, asi que una tarifa unica no aplica y una por
//      ciudad seria adivinar. Lo que teclea MANDA sobre lo sugerido: es quien contrata el envio.
//   4. Y LA CUENTA SE MUESTRA ENTERA antes de cobrar (costo, margen, IVA y total). El margen no es ganancia:
//      compensa la comision que la pasarela cobra tambien sobre el flete. Enseñarlo evita que parezca un
//      recargo inventado, que es lo primero que va a pensar quien lo vea sumado.
export function BloqueDomicilio({
  ciudades,
  costoSugeridoPorDefecto,
  margen,
  total,
}: {
  ciudades: CiudadParaElegir[];
  costoSugeridoPorDefecto: number | null;
  margen: number;
  total: number;
}) {
  const [aDomicilio, setADomicilio] = useState(false);
  const [ciudad, setCiudad] = useState("");
  const [costo, setCosto] = useState("");

  if (ciudades.length === 0) return null;

  const elegida = ciudades.find((c) => c.city === ciudad);
  const sugerido = elegida?.costoSugerido ?? costoSugeridoPorDefecto;
  // Lo tecleado manda; si esta vacio se ve la cuenta del sugerido, que es lo que el servidor va a usar.
  const costoEfectivo = Number(costo.replace(/\D/g, "")) || sugerido || 0;
  const flete = costoEfectivo > 0 ? fleteDelEnvio({ costo: costoEfectivo, margen }) : null;

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
        Enviar a domicilio
      </label>

      {aDomicilio ? (
        <div className="flex flex-col gap-3">
          {/* SALE DE LA BODEGA DE CNV, y se dice: el producto que va a domicilio no sale de la vitrina del
              profesional (§5.1), asi que el no lo entrega ni se descuenta de su inventario. */}
          <p className="text-xs text-muted-foreground">
            El producto sale de la bodega de CNV y lo despacha CNV: no se descuenta de tu inventario y el
            paciente no se lo lleva hoy. Se le cobra el producto más el envío en el mismo pago.
          </p>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ciudadDestino">Ciudad de destino</Label>
              <select
                id="ciudadDestino"
                name="ciudadDestino"
                required={aDomicilio}
                value={ciudad}
                onChange={(e) => {
                  setCiudad(e.target.value);
                  setCosto("");
                }}
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

            <div className="flex flex-col gap-1">
              <Label htmlFor="costoDelDomiciliario">Cuánto cobra el domiciliario</Label>
              <Input
                id="costoDelDomiciliario"
                name="costoDelDomiciliario"
                inputMode="numeric"
                required={aDomicilio && sugerido == null}
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                placeholder={sugerido != null ? sugerido.toLocaleString("es-CO") : "Ej. 14.000"}
                className="w-40"
              />
              {sugerido != null ? (
                <span className="text-xs text-muted-foreground">
                  Sugerido para {ciudad || "esa ciudad"}: {sugerido.toLocaleString("es-CO")}. Cámbialo si te
                  cobraron otra cosa.
                </span>
              ) : null}
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

          {flete ? (
            <div className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Envío: {flete.costo.toLocaleString("es-CO")} del domiciliario ·{" "}
                {flete.base.toLocaleString("es-CO")} de base · {flete.iva.toLocaleString("es-CO")} de IVA ={" "}
                <strong className="text-foreground">{flete.total.toLocaleString("es-CO")} COP</strong>
              </span>
              {/* EL MARGEN SE EXPLICA, porque si no parece un recargo inventado. */}
              <span>
                La diferencia sobre lo que cobra el domiciliario es lo que se lleva la pasarela por el envío:
                sin ella, CNV pondría esa plata.
              </span>
              <span className="text-foreground">
                Total con envío: <strong>{(total + flete.total).toLocaleString("es-CO")} COP</strong>
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
