"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { TEXTO_AVISO_DOMICILIO } from "../domicilio";

// ═══ EL BLOQUE DE ENVIO A DOMICILIO (0190, REESCRITO EL 2026-10-05) ═══
//
// SE MONTA EN LOS DOS CAMINOS DE VENTA (el link de pago y el efectivo), y por eso vive aparte: el mismo
// bloque en dos formularios que ya son distintos, sin copiarlo.
//
// ── QUE CAMBIO, Y POR QUE ES MENOS PANTALLA Y NO MENOS CUIDADO ──────────────────────────────────────
//
// La decision contable del 2026-10-05 saco el flete de CNV: el paciente le paga el envio DIRECTAMENTE al
// mensajero, y Atlas no lo cobra, no lo factura y no registra gasto. Asi que de aqui se fueron tres cosas:
// el campo del costo del domiciliario, la cuenta del flete (costo + margen + IVA) y el total con envio.
//
// Y SE FUE LA LISTA DE CIUDADES, que era un porton: solo se podia enviar a los destinos cargados. Existia
// para no perder dinero en un envio a una zona sin tarifa, y sin flete CNV no pone dinero en ninguno. La
// ciudad pasa a ser texto libre; el codigo DANE lo resuelve el servidor cuando la reconoce, y cuando no, la
// venta sigue igual. Dejar el desplegable "por si acaso" le habria negado el envio a un paciente de una
// ciudad que nadie alcanzo a cargar.
//
// ── LO QUE SI TIENE QUE ESTAR, Y ES LO QUE QUEDA ────────────────────────────────────────────────────
//
//   1. EL AVISO, LITERAL Y VISIBLE. `TEXTO_AVISO_DOMICILIO` viene del modulo y no se escribe aqui: su
//      redaccion hace trabajo juridico (deja claro que el envio lo presta un tercero y que CNV solo
//      coordina). Se le muestra al profesional para que se lo diga al paciente ANTES de cobrar, porque
//      quien se lleva la sorpresa del costo del envio es el paciente.
//   2. EL CELULAR, que es como se coordina la entrega. Si el paciente ya lo tiene de la encuesta, se ve y no
//      se vuelve a pedir; si no, es obligatorio. Pedirlo siempre es como entran dos numeros distintos de la
//      misma persona.
//   3. Y LA DIRECCION, sin la cual no hay nada que despachar.
export function BloqueDomicilio({ tieneCelularRegistrado }: { tieneCelularRegistrado: boolean }) {
  const [aDomicilio, setADomicilio] = useState(false);

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
          {/* EL AVISO PARA EL PACIENTE, DESTACADO: no es una nota al pie, es lo que hay que decirle antes de
              cobrar. Si se entera despues, el envio se vuelve un reclamo. */}
          {/* ═══ MAS LLAMATIVO, Y CON LA ORDEN POR DELANTE (Santiago, 2026-10-06) ═══

              Decía "Dile esto al paciente" en letra pequeña, del mismo tamaño que el texto. El encabezado
              ahora dice QUÉ hay que hacerle saber, en una línea que se lee sin detenerse, y el texto literal
              queda debajo para leérselo tal cual.

              POR QUÉ IMPORTA MÁS QUE UN DETALLE DE ESTILO: el asesor legal lo puso como la condición de la
              que depende todo lo demás, textual: "el argumento depende enteramente de que el paciente sepa,
              ANTES de comprar, que el envío es aparte y de un tercero. Si se entera después, la defensa se
              cae." Este bloque sale antes de cobrar, que es donde tiene que estar; lo único que faltaba era
              que no se pudiera pasar por alto. */}
          <div className="flex flex-col gap-1.5 rounded-md border-2 border-attention bg-attention-bg px-3 py-2.5">
            <span className="text-sm font-bold text-attention">
              Hazle saber al paciente que el envío se lo paga a un tercero
            </span>
            <p className="text-xs text-foreground">{TEXTO_AVISO_DOMICILIO}</p>
          </div>

          {/* SALE DE LA BODEGA DE CNV, y se dice: el producto que va a domicilio no sale de la vitrina del
              profesional, asi que el no lo entrega ni se descuenta de su inventario. */}
          <p className="text-xs text-muted-foreground">
            El producto sale de la bodega de CNV y lo despacha CNV: no se descuenta de tu inventario y el
            paciente no se lo lleva hoy. Se le cobra solo el producto; el envío lo paga él al mensajero.
          </p>

          {/* ═══ LA DIRECCIÓN YA NO SE EXIGE AQUÍ (legal, 2026-10-08) ═══

              *"La dirección la captura quien coordina el envío, no el profesional en consulta."* El argumento que
              lo decide: con la decisión del flete, CNV tiene que llamar al paciente de todos modos para
              confirmarle el valor exacto del envío, así que pedirle la dirección en esa llamada no agrega
              fricción. Pedírsela aquí sí, y el profesional muchas veces no la tiene a mano.

              SE QUEDAN LOS CAMPOS, OPCIONALES, y no se borran: cuando el profesional SÍ la tiene (el paciente
              delante) anotarla le ahorra una llamada a CNV. Quitarlos sería perder eso sin ganar nada.

              Y EL INVARIANTE NO SE PIERDE, SE MUDA: no se puede marcar ENTREGADA una venta a domicilio sin
              dirección (CHECK de la 0213 y el rechazo de `registrarEntrega`). Antes la regla era "nace con
              dirección", que con esta decisión es imposible de cumplir. */}
          <p className="text-xs text-muted-foreground">
            Si no tienes la dirección a mano, déjala vacía: CNV se la pide al paciente cuando lo llame para
            confirmarle el valor del envío. Lo que sí hace falta es un celular para poder llamarlo.
          </p>

          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ciudadDestino">Ciudad de destino</Label>
              <Input
                id="ciudadDestino"
                name="ciudadDestino"
                maxLength={120}
                placeholder="Ej. Medellín"
                className="w-48"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="departamentoDestino">Departamento</Label>
              <Input
                id="departamentoDestino"
                name="departamentoDestino"
                maxLength={120}
                placeholder="Ej. Antioquia"
                className="w-48"
              />
            </div>

            <div className="flex min-w-[18rem] flex-1 flex-col gap-1">
              <Label htmlFor="direccionEntrega">Dirección de entrega</Label>
              <Input
                id="direccionEntrega"
                name="direccionEntrega"
                maxLength={300}
                placeholder="Calle, número, apartamento, barrio"
              />
            </div>

            {/* EL CELULAR ES OBLIGATORIO SOLO CUANDO EL PACIENTE NO TIENE UNO REGISTRADO. Con uno registrado
                el campo queda vacío y opcional, y el servidor usa el de la encuesta: pedirle teclear un
                número que el sistema ya tiene es como entran dos celulares distintos de la misma persona.

                EL CAMPO NO SE PRECARGA CON EL NÚMERO, y no es un olvido: el número no viaja a esta pantalla
                (ver `listSelectablePatients`). Lo que viaja es si existe. */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="celularEntrega">Celular para coordinar</Label>
              <Input
                id="celularEntrega"
                name="celularEntrega"
                inputMode="tel"
                required={aDomicilio && !tieneCelularRegistrado}
                maxLength={40}
                placeholder="Ej. 300 123 4567"
                className="w-48"
              />
              <span className="text-xs text-muted-foreground">
                {tieneCelularRegistrado
                  ? "Déjalo vacío para usar el que el paciente registró en la encuesta, o escribe otro si cambió."
                  : "El paciente no tiene celular registrado; hace falta para coordinar la entrega."}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
