"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCheckoutFormAction } from "../actions";
import { BloqueDomicilio } from "./bloque-domicilio";
import { BloqueTratamiento, type TratamientoParaElegir } from "./bloque-tratamiento";
import { SelectorDePaciente } from "./selector-de-paciente";
import type { SelectablePatient } from "../data/payments-repository";
import { MENSAJE_MINIMO_WOMPI, WOMPI_MONTO_MINIMO } from "../wompi-minimo";
import type { PaymentFormState } from "../validations";
import { enviarSinReset } from "@/components/shared/enviar-sin-reset";

const initial: PaymentFormState = {
  error: null,
  success: null,
  checkoutUrl: null,
  duplicateWarning: null,
  outOfPlanWarning: null,
};

// Mismo estilo que los <select> nativos del resto de formularios (alineado al Input).
const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

// VIAJA SI TIENE CELULAR, NO CUAL (2026-10-05): el bloque de domicilio lo necesita para pedirlo solo cuando
// falta, y el numero no tiene por que estar en el HTML de la pantalla (ver `listSelectablePatients`).
// ES EL MISMO TIPO QUE EL LECTOR, no una copia: duplicarlo es como se llega a que el selector pida un campo
// que la consulta no trae. El nombre entro el 2026-10-10 para poder buscar por el.
export type CheckoutPatient = SelectablePatient;
export type CheckoutNutraceutical = { id: string; name: string; unitPrice: number };

// Crea un checkout de una linea (paciente + nutraceutico + cantidad). Al exito
// muestra el link de pago que el profesional comparte con el paciente.
export function CreateCheckoutForm({
  patients,
  nutraceuticals,
  tratamientosPorPaciente = {},
}: {
  patients: CheckoutPatient[];
  nutraceuticals: CheckoutNutraceutical[];
  /** Las consultas de cada paciente, para poder atar la compra a la suya sin ir al servidor. */
  tratamientosPorPaciente?: Record<string, TratamientoParaElegir[]>;
}) {
  const [state, action, pending] = useActionState(createCheckoutFormAction, initial);
  // Inputs CONTROLADOS a proposito: React 19 resetea el form tras cada submit (lo del prop `action`), y
  // el flujo de confirmacion del duplicado es de dos pasos (avisar -> "Generar de todos modos"). Sin
  // control, el segundo submit mandaria los valores por defecto, no los que el profesional eligio.
  // VACIO A PROPOSITO (Santiago, 2026-10-10): un formulario de COBRO que llega con una persona ya elegida
  // invita a registrarle una venta a quien encabeza la lista. Ver `SelectorDePaciente`.
  const [patientId, setPatientId] = useState("");
  // El celular del paciente ELEGIDO, para el bloque de domicilio. Sale de la lista que ya viajo y no de una
  // consulta aparte: cambiar de paciente no deberia ir al servidor por un dato que ya esta aqui.
  const tieneCelular = patients.find((p) => p.id === patientId)?.tieneCelular === true;
  // ═══ VARIAS LINEAS, QUE ES EL CASO MAS COMUN EN UNA CONSULTA (2026-09-12) ═══
  //
  // Hasta hoy este formulario tenia UN selector y UN campo de cantidad, asi que anadir un segundo producto
  // generaba OTRO checkout con OTRO enlace, y el paciente recibia dos links para una sola compra.
  //
  // Y EL ESTRANGULAMIENTO ESTABA SOLO AQUI: la tabla `transaction_items` es una fila por linea, el writer
  // las inserta todas, el servicio itera, y el esquema de validacion admite hasta CINCUENTA. Lo unico que
  // mandaba una sola linea era esta pantalla y la accion que leia dos campos sueltos.
  const [lineas, setLineas] = useState<{ nutraceuticalId: string; quantity: string }[]>([
    { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" },
  ]);
  const cambiar = (i: number, campo: Partial<{ nutraceuticalId: string; quantity: string }>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  const anadir = () =>
    setLineas((prev) => [...prev, { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" }]);
  const quitar = (i: number) => setLineas((prev) => prev.filter((_, j) => j !== i));
  // El total es INFORMATIVO y se calcula con el precio del catalogo que ya tiene la pantalla. El que
  // cobra es el que SELLA el servidor desde el catalogo: si alguien toca el DOM, cambia este numero y no
  // lo que se cobra.
  const total = lineas.reduce((suma, l) => {
    const n = nutraceuticals.find((x) => x.id === l.nutraceuticalId);
    return suma + (n ? n.unitPrice * (Number(l.quantity) || 0) : 0);
  }, 0);
  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.duplicateWarning) toast.warning(state.duplicateWarning);
    else if (state.success) toast.success(state.success);
  }, [state]);

  if (patients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes pacientes registrados para crear un checkout.
      </p>
    );
  }
  if (nutraceuticals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay nutraceuticos con precio configurado. Asigna un precio en el catalogo
        antes de crear un checkout.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-end gap-3">
        {/* EL MISMO SELECTOR QUE LA VENTA EN EFECTIVO, y por eso es un componente: dos buscadores distintos en
            la misma pantalla se separan al primer cambio, y aqui los dos resuelven la misma pregunta. */}
        <input type="hidden" name="patientId" value={patientId} />
        <div className="w-full">
          <SelectorDePaciente
            id="checkout-paciente"
            pacientes={patients}
            valor={patientId}
            onElegir={setPatientId}
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <Label className="text-xs">Productos</Label>
          {/* LAS LINEAS VIAJAN COMO JSON EN UN CAMPO OCULTO, igual que el conteo de inventario
              (`mi-conteo-form`). Es el patron que ya existe en el proyecto para una lista de longitud
              variable dentro de un formulario, y repetirlo evita inventar un segundo. */}
          <input type="hidden" name="lineas" value={JSON.stringify(lineas)} />

          {lineas.map((l, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <select
                aria-label={`Nutracéutico ${i + 1}`}
                required
                value={l.nutraceuticalId}
                onChange={(e) => cambiar(i, { nutraceuticalId: e.target.value })}
                className={`${selectClass} min-w-[16rem] flex-1`}
              >
                {nutraceuticals.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.unitPrice.toLocaleString("es-CO")} COP)
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Cantidad ${i + 1}`}
                type="number"
                min={1}
                step={1}
                value={l.quantity}
                onChange={(e) => cambiar(i, { quantity: e.target.value })}
                required
                className="h-9 w-24"
              />
              {/* La ultima linea NO se puede quitar: una venta sin lineas no es una venta, y dejar el
                  formulario vacio obliga a recargar para volver a empezar. */}
              {lineas.length > 1 && (
                <Button type="button" variant="outline" onClick={() => quitar(i)}>
                  Quitar
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={anadir} className="self-start">
              Añadir producto
            </Button>
            {total > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: <strong className="text-foreground">{total.toLocaleString("es-CO")} COP</strong>
              </p>
            )}
          </div>
        </div>

        {/* LA `key` POR PACIENTE re-monta el bloque al cambiar de paciente: sin ella, la consulta elegida
            para uno se quedaría seleccionada para el siguiente, que es como se le cuelga una compra a la
            consulta de otra persona. */}
        {/* SIN PACIENTE NO HAY BLOQUES, igual que en la venta en efectivo y por lo mismo. */}
        {patientId ? (
          <BloqueTratamiento
            key={patientId}
            patientId={patientId}
            tratamientos={tratamientosPorPaciente[patientId] ?? []}
          />
        ) : null}

        {/* LA MISMA `key` POR PACIENTE que el bloque de arriba, y por el mismo motivo: el campo del celular
            se precarga con el del paciente elegido. Sin re-montar, el numero del anterior se quedaría en el
            campo y se despacharía un envío al teléfono de otra persona. */}
        {patientId ? <BloqueDomicilio key={patientId} tieneCelularRegistrado={tieneCelular} /> : null}

        <Button type="submit" disabled={pending || !patientId || (total > 0 && total < WOMPI_MONTO_MINIMO)}>
          {pending ? "Creando..." : patientId ? "Crear el link de pago" : "Elige un paciente"}
        </Button>
        {total > 0 && total < WOMPI_MONTO_MINIMO ? (
          <p className="w-full text-sm text-attention">{MENSAJE_MINIMO_WOMPI}</p>
        ) : null}

        {/* ═══ SE VENDE ALGO FUERA DEL PLAN DE ESA CONSULTA (2026-09-30) ═══
            NO es un rechazo: la venta queda ATADA a la consulta y contada como compra fuera del plan, que es
            lo correcto si viene del seguimiento. Marcarla "sin consulta" para poder cobrarla destruiría el
            dato: ya no se sabría de qué plan se apartó.
        
            LA `key` LO SEPARA del botón de enviar (hazard 1 de CLAUDE.md): comparten formulario, y sin keys
            distintas React reutiliza el nodo y el clic puede ejecutar la acción por defecto del otro. */}
        {state.outOfPlanWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
            <p className="text-attention">{state.outOfPlanWarning}</p>
            <Button
              key="confirmar-fuera-del-plan"
              type="submit"
              name="fueraDelPlanConfirmado"
              value="true"
              variant="outline"
              disabled={pending}
              className="self-start"
            >
              Registrarlo así
            </Button>
          </div>
        ) : null}
        {state.duplicateWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
            <p className="text-attention">{state.duplicateWarning}</p>
            <Button
              type="submit"
              name="confirmDuplicate"
              value="true"
              variant="outline"
              disabled={pending}
              className="self-start"
            >
              Generar de todos modos
            </Button>
          </div>
        ) : null}
      </form>

      {state.checkoutUrl ? (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <span className="font-medium text-foreground">Link de pago (vale 24 horas)</span>
          <a
            href={state.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary underline"
          >
            {state.checkoutUrl}
          </a>
        </div>
      ) : null}
    </div>
  );
}
