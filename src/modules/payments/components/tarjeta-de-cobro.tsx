"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import type { CheckoutNutraceutical, CheckoutPatient } from "./create-checkout-form";
import { CreateCheckoutForm } from "./create-checkout-form";
import type { TratamientoParaElegir } from "./bloque-tratamiento";
import { RegisterCashSaleForm } from "./register-cash-sale-form";
import { SelectorDePaciente } from "./selector-de-paciente";

// ═══ UNA SOLA TARJETA PARA COBRAR, CON EL MEDIO ARRIBA (Santiago, 2026-10-10) ═══
//
// ── LO QUE HABIA, Y POR QUE SE VEIA ROTO ─────────────────────────────────────────────────────────
//
// /pagos tenía DOS tarjetas, "Cobrar con un link de pago" y "Registrar una venta ya cobrada", visibles a la
// vez, y cada una con SU buscador de paciente y SU bloque de "de qué consulta sale esta compra". Textual de
// Santiago: *"apenas le doy cambiar para escribir el nombre de otro paciente, el minibloque donde uno
// selecciona la consulta del paciente sigue ahí. Cuando se debería eliminar, es así de simple."*
//
// Y SU PROPUESTA ES LA BUENA, no un parche: *"que siempre esté activo ese minibloque, sea solo 1, y solo
// aplique para el paciente que esté buscado en /pagos."* Con una sola tarjeta no hay forma de que exista
// más de uno, venga el apilado de donde viniera. Esa es la diferencia entre arreglar un síntoma y quitarle
// el sitio donde puede volver a aparecer.
//
// ── Y EL ARGUMENTO DE FONDO ES SUYO TAMBIEN ─────────────────────────────────────────────────────
//
// Las dos tarjetas registraban EL MISMO HECHO (una venta a un paciente) y se diferenciaban solo en el medio
// de pago. Partirlo en dos tarjetas obligaba a elegir el formulario antes de elegir el medio, que es el orden
// inverso al que piensa quien cobra: primero sabe qué le va a vender y a quién, y después cómo le pagan.
// Así que el medio es UNA pregunta con tres respuestas, y va arriba.
//
// ── QUE ES ESTE PASO Y QUE NO ES ────────────────────────────────────────────────────────────────
//
// Es el PRIMERO de la unificación (la que iguala /pagos con el cobro en consulta: domicilio con los mismos
// campos y despacho desde la bodega en los dos). Aquí los dos formularios siguen siendo piezas distintas por
// dentro; lo que se unifica es lo que se pregunta ANTES de ellos: el paciente y el medio. Se hace primero
// porque es barato y quita los bloques duplicados ya, y porque es el andamio donde el bloque compartido va a
// montarse después del smoke.
//
// ── POR QUE EL CAMBIO DE MEDIO DESMONTA UNO Y MONTA EL OTRO, Y POR QUE NO IMPORTA ───────────────
//
// Entre efectivo y transferencia es el MISMO formulario (cambia un campo oculto), así que lo que esté escrito
// se queda: ese es el cambio que alguien hace a mitad de camino. Pasar a link de pago sí monta el otro
// formulario y pierde sus líneas, y es lo correcto: son dos actos distintos (uno cobra ya, el otro genera un
// link que vence en 24 horas) y arrastrar las líneas de uno al otro invitaría a enviar el que no se quería.
export function TarjetaDeCobro({
  patients,
  nutraceuticals,
  tratamientosPorPaciente = {},
  esDeDistribucion = false,
}: {
  patients: CheckoutPatient[];
  nutraceuticals: CheckoutNutraceutical[];
  tratamientosPorPaciente?: Record<string, TratamientoParaElegir[]>;
  /** Si QUIEN MIRA opera bajo Distribución: no hay link de pago ni medio que preguntar. */
  esDeDistribucion?: boolean;
}) {
  // VACIO A PROPOSITO (Santiago, 2026-10-10): un formulario de COBRO que llega con una persona ya elegida
  // invita a registrarle una venta a quien encabeza la lista alfabética. Ver `SelectorDePaciente`.
  const [patientId, setPatientId] = useState("");
  // EFECTIVO POR DEFECTO y no vacío, porque aquí sí hay una respuesta que no decide nada por nadie: es el
  // medio más frecuente, y los otros dos están a la vista al lado. Es distinto del paciente, donde un valor
  // por defecto es un cobro a la persona equivocada.
  const [medio, setMedio] = useState<"efectivo" | "transferencia" | "link">("efectivo");

  const comunes = { patients, nutraceuticals, tratamientosPorPaciente, patientId };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {esDeDistribucion ? "Registrar una venta de Distribución" : "Cobrar una venta"}
        </CardTitle>
        <CardDescription>
          {esDeDistribucion
            ? "El paciente ya te pagó a ti. Esto no cobra nada: descuenta el producto de tu vitrina y lo suma a la cuenta quincenal que CNV te factura."
            : "Elige el paciente, los productos y cómo paga. El precio y el producto son de CNV."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* EL BUSCADOR, UNO SOLO Y FUERA DE LOS FORMULARIOS. El id viaja dentro de cada uno por su campo
            oculto, que es lo único que el servidor necesita; el texto tecleado no viaja nunca (ver el
            encabezado de `SelectorDePaciente`). */}
        <SelectorDePaciente
          id="cobro-paciente"
          pacientes={patients}
          valor={patientId}
          onElegir={setPatientId}
        />

        {/* ═══ BAJO DISTRIBUCION NO SE PREGUNTA EL MEDIO (0211) ═══

            El paciente le pagó AL INTEGRANTE: en efectivo, por transferencia o con datáfono, el dinero es
            suyo y es asunto suyo. Y tampoco hay link, porque CNV no le cobra nada al paciente. Preguntarlo
            sería ofrecer una respuesta que el servidor descarta, y un campo cuyo valor se ignora enseña a
            desconfiar de los otros. */}
        {esDeDistribucion ? null : (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Cómo paga</Label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  // QUE PASA CON LA PLATA Y CON LA FACTURA, dicho en el propio botón. Son los tres destinos
                  // contables reales, y hasta hoy no estaban escritos en ningún sitio de la pantalla: quien
                  // cobra elegía el medio sin saber que eso decide la cuenta y el estado de la factura.
                  {
                    id: "efectivo" as const,
                    rotulo: "Efectivo",
                    nota: "Queda cobrada. El dinero es de CNV y lo custodias hasta consignar.",
                  },
                  {
                    id: "transferencia" as const,
                    rotulo: "Transferencia",
                    nota: "Factura al banco principal, y queda sin cobrar hasta que se verifique.",
                  },
                  {
                    id: "link" as const,
                    rotulo: "Link de pago",
                    nota: "El paciente paga en línea con Wompi desde su teléfono. Vale 24 horas.",
                  },
                ] as const
              ).map((m) => {
                const elegido = medio === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={elegido}
                    onClick={() => setMedio(m.id)}
                    className={
                      "flex max-w-[18rem] flex-1 flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors " +
                      (elegido
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50")
                    }
                  >
                    <span
                      className={
                        "text-sm font-medium " + (elegido ? "text-primary" : "text-foreground")
                      }
                    >
                      {m.rotulo}
                    </span>
                    <span className="text-xs text-muted-foreground">{m.nota}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* UN SOLO FORMULARIO MONTADO, y con él un solo bloque de "de qué consulta sale esta compra". El
            link de pago no existe bajo Distribución, así que ahí siempre es el de la venta ya cobrada. */}
        {medio === "link" && !esDeDistribucion ? (
          <CreateCheckoutForm {...comunes} />
        ) : (
          <RegisterCashSaleForm
            {...comunes}
            esDeDistribucion={esDeDistribucion}
            // Bajo Distribución el canal lo deriva el servidor de la modalidad; lo que se mande aquí se
            // descarta, y "efectivo" es el valor que ya viajaba antes de que este selector existiera.
            canal={medio === "transferencia" ? "transferencia" : "efectivo"}
          />
        )}
      </CardContent>
    </Card>
  );
}
