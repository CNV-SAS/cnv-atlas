"use client";

import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

import { CUENTA_DE_CNV, QUE_HACER_CON_EL_COMPROBANTE } from "../cuenta-de-cnv";
import type { CheckoutNutraceutical, CheckoutPatient } from "./create-checkout-form";
import { CreateCheckoutForm } from "./create-checkout-form";
import {
  BloqueTratamiento,
  consultaRespondida,
  type ConsultaDeLaCompra,
  type TratamientoParaElegir,
} from "./bloque-tratamiento";
import { RegisterCashSaleForm } from "./register-cash-sale-form";
import { SelectorDePaciente } from "./selector-de-paciente";

/** Ninguno viene marcado: el medio decide la cuenta contable, y no se elige por nadie. */
type Medio = "" | "efectivo" | "transferencia" | "link";

// ═══ UNA SOLA TARJETA PARA COBRAR, Y ELLA PREGUNTA TODO LO QUE NO DEPENDE DEL MEDIO ═══
//
// ── LO QUE HABIA, Y POR QUE SE VEIA ROTO (Santiago, 2026-10-10) ──────────────────────────────────
//
// /pagos tenía DOS tarjetas, "Cobrar con un link de pago" y "Registrar una venta ya cobrada", visibles a la
// vez, y cada una con SU buscador de paciente y SU bloque de "de qué consulta sale esta compra". Las dos
// registraban EL MISMO HECHO (una venta a un paciente) y se diferenciaban solo en el medio de pago, así que
// partirlo en dos obligaba a elegir el formulario antes de elegir el medio: el orden inverso al que piensa
// quien cobra, que primero sabe qué vende y a quién, y después cómo le pagan.
//
// ── Y LA TERCERA VUELTA, QUE ES ESTA ────────────────────────────────────────────────────────────
//
// Juntarlas en una no cerró el bloque duplicado que él reportaba. Así que esta vez no se busca la causa: se
// quita el sitio donde puede aparecer, como él propuso. Esta tarjeta es ahora la ÚNICA dueña de:
//
//   · el paciente (un buscador),
//   · la consulta de la que sale la compra (un minibloque, siempre montado, que no se re-monta nunca),
//   · y el medio de pago (una pregunta con tres respuestas, ninguna marcada).
//
// Los formularios reciben todo eso como props y solo se ocupan de lo que de verdad depende del medio: los
// productos, el domicilio y su propio envío. Mientras no haya un medio elegido NO SE MONTA NINGUNO, y eso
// resuelve dos cosas de una: obliga a elegirlo (lo pidió él) y evita que lo que alguien escriba en los
// productos se pierda al cambiar de formulario, porque no hay nada escrito todavía.
//
// ── POR QUE AL CAMBIAR DE PACIENTE SE VACIA LA CONSULTA ─────────────────────────────────────────
//
// Porque antes lo hacía una `key={patientId}` que re-montaba el bloque, y esa `key` es justo lo que había
// que quitar. Lo que protegía no era cosmético: sin vaciarla, la consulta elegida para un paciente se queda
// seleccionada para el siguiente, y así se le cuelga una compra a la consulta de otra persona. Por eso el
// paciente SOLO se mueve por `elegirPaciente`, y hay un candado que lo verifica.
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
  // ═══ NINGUN MEDIO MARCADO DE ANTEMANO (Santiago, 2026-10-10) ═══
  //
  // Antes venía "efectivo" puesto, con el argumento de que es el más frecuente. Él lo rechazó: *"tocaría
  // remover de que aparezca Efectivo por default y que sea el profesional que tenga que darle click."* Y
  // tiene razón, por lo mismo que el paciente: el medio decide la cuenta contable y el estado de la factura,
  // así que una respuesta puesta por nosotros es un dato nuestro disfrazado de decisión suya. Que el medio
  // más frecuente sea el efectivo no lo vuelve el medio de ESTA venta.
  const [medio, setMedio] = useState<Medio>("");
  const [consulta, setConsulta] = useState<ConsultaDeLaCompra>({
    treatmentId: "",
    suelta: false,
    motivo: "",
  });

  // EL UNICO SITIO DESDE EL QUE SE MUEVE EL PACIENTE, y por eso vacía la consulta en el mismo gesto. Si
  // alguien llamara a `setPatientId` por su cuenta, la respuesta del paciente anterior quedaría viva: ese es
  // el defecto que la `key` evitaba y el candado `el-paciente-de-la-venta-no-viene-elegido` vigila.
  const elegirPaciente = (id: string) => {
    setPatientId(id);
    setConsulta({ treatmentId: "", suelta: false, motivo: "" });
  };

  const respondida = consultaRespondida(consulta);
  // Bajo Distribución no se pregunta el medio (ver más abajo), así que el formulario se monta directo.
  const medioResuelto: Medio = esDeDistribucion ? "efectivo" : medio;
  const comunes = {
    patients,
    nutraceuticals,
    patientId,
    treatmentId: consulta.treatmentId,
    ventaSueltaMotivo: consulta.suelta ? consulta.motivo : "",
    consultaRespondida: respondida,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {esDeDistribucion ? "Registrar una venta de Distribución" : "Cobrar una venta"}
        </CardTitle>
        <CardDescription>
          {esDeDistribucion
            ? "El paciente ya te pagó a ti. Esto no cobra nada: descuenta el producto de tu vitrina y lo suma a la cuenta quincenal que CNV te factura."
            : "Elige el paciente, de qué consulta sale la compra y cómo paga. El precio y el producto son de CNV."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* SIN PACIENTES NO SE OFRECE EL BUSCADOR. Los dos formularios ya lo dicen cada uno por su lado (y
            esa guarda se queda, es su defensa), pero con el buscador arriba se veía primero un campo de
            búsqueda que no puede encontrar a nadie y debajo la frase de que no hay a quién buscar: dos
            partes de la pantalla diciendo cosas distintas sobre lo mismo. */}
        {patients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes pacientes registrados, así que no hay a quién registrarle una venta.
          </p>
        ) : (
          <>
            {/* EL BUSCADOR, UNO SOLO Y FUERA DE LOS FORMULARIOS. El id viaja dentro de cada uno por su campo
                oculto, que es lo único que el servidor necesita; el texto tecleado no viaja nunca (ver el
                encabezado de `SelectorDePaciente`). */}
            <SelectorDePaciente
              id="cobro-paciente"
              pacientes={patients}
              valor={patientId}
              onElegir={elegirPaciente}
            />

            {/* EL MINIBLOQUE DE LA CONSULTA, UNO Y SIEMPRE PUESTO. Va aquí, pegado al buscador y encima del
                medio, porque es una pregunta sobre el PACIENTE y no sobre cómo paga: la respuesta es la misma
                se cobre en efectivo o con un link. Y por eso mismo no puede vivir dentro de un formulario que
                se monta y se desmonta al cambiar de medio. Ver su cabecera. */}
            <BloqueTratamiento
              tratamientos={tratamientosPorPaciente[patientId] ?? []}
              valor={consulta}
              onCambiar={(cambio) => setConsulta((prev) => ({ ...prev, ...cambio }))}
              hayPaciente={patientId !== ""}
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
                      // ═══ LOS TEXTOS SON LOS DE SANTIAGO, Y UNO DE ELLOS SE RETIRO ═══
                      //
                      // La transferencia decía "Factura al banco principal, y queda sin cobrar hasta que se
                      // verifique". Él lo rechazó: *"Esto no se dice a los integrantes, es algo interno de
                      // CNV."* Y es cierto, aunque el hecho sea verdad: al integrante no le sirve saber en
                      // qué cuenta contable cae, le sirve saber A DÓNDE transfiere el paciente. El hecho
                      // contable sigue vivo donde manda (ver `cuentaDelPago` y su candado).
                      {
                        id: "efectivo" as const,
                        rotulo: "Efectivo",
                        nota: "El paciente te paga en efectivo. El dinero es de CNV y lo custodias hasta consignar.",
                      },
                      {
                        id: "transferencia" as const,
                        rotulo: "Transferencia",
                        nota: "El paciente transfiere directamente a la cuenta de CNV.",
                      },
                      {
                        id: "link" as const,
                        rotulo: "Link de pago por Wompi",
                        nota: "El paciente paga en línea (tarjeta de crédito, débito, PSE). Link válido por 24 horas.",
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

            {/* ═══ A DONDE TRANSFIERE, EN GRANDE Y SOLO CUANDO HACE FALTA (Santiago, 2026-10-10) ═══

                El medio existía desde el 2026-09-25 y la pantalla NO DECÍA LA CUENTA: el integrante tenía que
                sabérsela de memoria o pedirla por interno, con el paciente delante. Un medio sin su destino no
                es un medio, es una etiqueta.

                RESALTA porque es un dato que alguien va a LEER EN VOZ ALTA o a copiar, y un número de cuenta
                mal leído manda el dinero a otra parte. Los dígitos van en `tabular-nums` y seleccionables por
                eso mismo. Los números viven en `cuenta-de-cnv.ts`, no aquí: el mismo dato hace falta en la
                venta en consulta, y una cuenta copiada en dos pantallas es una que el día que cambie quedará
                bien en una y mal en la otra. */}
            {medio === "transferencia" ? (
              <div className="flex flex-col gap-2 rounded-lg border-2 border-primary bg-primary/5 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Dile al paciente que transfiera aquí
                </span>
                <div className="flex flex-col gap-1 text-sm text-foreground">
                  <span>
                    Llave Breb:{" "}
                    <strong className="select-all font-mono tabular-nums">
                      {CUENTA_DE_CNV.llaveBreb}
                    </strong>
                  </span>
                  <span>
                    o cuenta de {CUENTA_DE_CNV.tipoDeCuenta} {CUENTA_DE_CNV.banco}:{" "}
                    <strong className="select-all font-mono tabular-nums">
                      {CUENTA_DE_CNV.numeroDeCuenta}
                    </strong>
                  </span>
                  <span className="text-muted-foreground">A nombre de {CUENTA_DE_CNV.titular}</span>
                </div>
                <p className="text-xs text-foreground">{QUE_HACER_CON_EL_COMPROBANTE}</p>
              </div>
            ) : null}

            {/* ═══ SIN MEDIO ELEGIDO NO HAY FORMULARIO ═══

                Es la forma más limpia de "que obligue a elegir un método de pago": no se puede saltar lo que
                no está. Y evita el problema que tendría la alternativa (montar un formulario por defecto):
                quien escribiera los productos antes de elegir el medio los perdería al elegir el link, porque
                son dos formularios distintos. Aquí no hay nada que perder todavía. */}
            {medioResuelto === "" ? (
              <p className="text-sm text-muted-foreground">
                Elige cómo paga para continuar.
              </p>
            ) : medioResuelto === "link" ? (
              <CreateCheckoutForm {...comunes} />
            ) : (
              <RegisterCashSaleForm
                {...comunes}
                esDeDistribucion={esDeDistribucion}
                // Bajo Distribución el canal lo deriva el servidor de la modalidad; lo que se mande aquí se
                // descarta, y "efectivo" es el valor que ya viajaba antes de que este selector existiera.
                canal={medioResuelto === "transferencia" ? "transferencia" : "efectivo"}
              />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
