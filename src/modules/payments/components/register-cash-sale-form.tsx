"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { registerCashSaleFormAction } from "../actions";
import { BloqueDomicilio } from "./bloque-domicilio";
import { BloqueTratamiento, type TratamientoParaElegir } from "./bloque-tratamiento";
import type { CashSaleFormState } from "../validations";
import type { CheckoutNutraceutical, CheckoutPatient } from "./create-checkout-form";

const initial: CashSaleFormState = { error: null, success: null, duplicateWarning: null, pendingLinkWarning: null, outOfPlanWarning: null };

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";

// Registra una venta en EFECTIVO (paciente + producto + cantidad), que nace ya pagada. El precio lo pone
// CNV (se sella en el servidor desde el catalogo); el dinero es de CNV, el integrante lo custodia.
// DOS capas contra el cobro duplicado: (1) idempotencyKey por intento (en un ref) para el doble-clic
// simultaneo, se regenera solo al concretar una venta; (2) el AVISO de venta identica reciente (server,
// findRecentCashSaleDuplicate), que atrapa el re-registro secuencial, avisa y deja "Registrar de todos
// modos". La misma clave se usa en el aviso y en la confirmacion, asi confirmar crea una sola venta.
export function RegisterCashSaleForm({
  patients,
  nutraceuticals,
  tratamientosPorPaciente = {},
  esDeDistribucion = false,
}: {
  patients: CheckoutPatient[];
  nutraceuticals: CheckoutNutraceutical[];
  /** Las consultas de cada paciente, para poder atar la compra a la suya sin ir al servidor. */
  tratamientosPorPaciente?: Record<string, TratamientoParaElegir[]>;
  /**
   * Si QUIEN MIRA opera bajo Distribucion. Cambia lo que el formulario dice y pide, no lo que hace: la
   * decision real la toma el servidor derivandola de la modalidad guardada.
   */
  esDeDistribucion?: boolean;
}) {
  const [state, action, pending] = useActionState(registerCashSaleFormAction, initial);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  // El celular del paciente ELEGIDO, para el bloque de domicilio. Sale de la lista que ya viajo y no de una
  // consulta aparte: cambiar de paciente no deberia ir al servidor por un dato que ya esta aqui.
  const tieneCelular = patients.find((p) => p.id === patientId)?.tieneCelular === true;
  // VARIAS LINEAS, como el checkout (2026-09-12). Tenia el mismo estrangulamiento: un selector y un campo
  // de cantidad, mientras la tabla, el writer, el servicio y el esquema admitian cincuenta. Y en efectivo
  // pesa mas: la venta nace PAGADA, asi que dos registros son dos cobros y revertir uno es una nota
  // credito, no un clic.
  const [lineas, setLineas] = useState<{ nutraceuticalId: string; quantity: string }[]>([
    { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" },
  ]);
  const cambiar = (i: number, campo: Partial<{ nutraceuticalId: string; quantity: string }>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  const anadir = () =>
    setLineas((prev) => [...prev, { nutraceuticalId: nutraceuticals[0]?.id ?? "", quantity: "1" }]);
  const quitar = (i: number) => setLineas((prev) => prev.filter((_, j) => j !== i));
  // Clave de idempotencia de ESTE intento (en un ref, no en estado: no se renderiza, se lee al enviar).
  // Un doble-clic manda la MISMA clave (el writer deduplica); tras una venta exitosa se regenera para que
  // el siguiente cobro sea nuevo. Mutar el ref en el efecto es valido (no es setState).
  const keyRef = useRef(typeof crypto !== "undefined" ? crypto.randomUUID() : "");

  const last = useRef(state);
  useEffect(() => {
    if (state === last.current) return;
    last.current = state;
    if (state.error) toast.error(state.error);
    else if (state.duplicateWarning) toast.warning(state.duplicateWarning); // NO regenera la clave: no hubo venta
    else if (state.pendingLinkWarning) toast.warning(state.pendingLinkWarning); // tampoco: no hubo venta
    else if (state.success) {
      toast.success(state.success);
      keyRef.current = crypto.randomUUID(); // venta concretada: clave nueva para el proximo cobro
    }
  }, [state]);

  // Envio por transicion (no prop `action`): arma el FormData desde el estado controlado, inyecta la clave
  // del intento y (para "registrar de todos modos") el flag de confirmacion del duplicado. La MISMA clave
  // se usa en el aviso y en la confirmacion, asi confirmar crea UNA sola venta.
  // "Anular el link y cobrar" viaja igual que el duplicado: como campo del FormData armado aqui, no como
  // name/value del boton (que `new FormData(form)` no incluye; hazard 5 de CLAUDE.md).
  // ═══ EL FormData SALE DEL FORMULARIO, NO SE ARMA A MANO (smoke del 2026-09-29) ═══
  //
  // ESTO SE ARMABA CON `new FormData()` VACIO y tres `fd.set`, asi que NADA de lo que estaba en el JSX
  // viajaba. Tres campos se perdian, y solo uno se quejaba:
  //
  //   · `treatmentId` (hoy): la venta se rechazaba con "elige de qué consulta sale esta compra" DESPUES de
  //     haberla elegido. Ese fue el que bloqueó el smoke, y el único que avisó.
  //   · Los campos del DOMICILIO (hoy): se llenaban y la venta se creaba sin envío. En silencio.
  //   · Y `canal` (desde que existe la transferencia): TODA venta se registraba como EFECTIVO aunque se
  //     eligiera transferencia. En silencio, y con consecuencia contable: el medio viaja a la factura
  //     electrónica y decide la cuenta contra la que se registra el pago.
  //
  // Es la misma familia del hazard 5 de CLAUDE.md (el `name` del botón no viaja en `new FormData(form)`),
  // llevada al extremo: un FormData armado a mano no lleva NADA del formulario, y cada campo que alguien
  // agregue en el futuro nacerá roto. Por eso el arreglo no es añadir tres `fd.set`: es partir DEL
  // FORMULARIO y añadir encima lo que no es un campo (la clave de idempotencia y las confirmaciones).
  const formRef = useRef<HTMLFormElement | null>(null);
  //
  // ── Y EL BOTON QUE ENVIA TIENE QUE VIAJAR CON EL (bloqueo del 2026-09-30) ──
  //
  // `new FormData(form)` NO incluye el `name`/`value` del boton que disparo el envio: eso solo lo hace el
  // envio nativo, o `new FormData(form, submitter)`. Es el hazard 5 de CLAUDE.md, y lo introduje YO ayer en
  // este mismo archivo: arreglé el FormData armado a mano y al día siguiente le puse un botón de confirmar
  // que lleva su dato en el `name`.
  //
  // EL SINTOMA FUE EL PEOR POSIBLE: pulsar "Registrarlo así" no hacía NADA. El servidor no recibía la
  // confirmación, volvía a calcular el mismo aviso y lo devolvía, así que la pantalla mostraba lo mismo que
  // ya mostraba. Ni error ni venta: un silencio que parece que el botón no funciona.
  //
  // Los otros dos botones de este formulario (anular el link, confirmar duplicado) no se veían afectados
  // porque llevan su dato por `onClick`, no por `name`. Por eso el defecto era de uno solo.
  // ═══ LAS CONFIRMACIONES SE ACUMULAN (bloqueo de Santiago, 2026-10-02) ═══
  //
  // EL BUCLE: confirmar "Registrarlo así" mandaba `fueraDelPlanConfirmado` en el `name`/`value` del BOTON, asi
  // que solo viajaba en el envio de ESE boton. Al pulsar despues "Anular el link" (que envia por `onClick`, sin
  // submitter), esa confirmacion ya no iba, el servidor volvia a calcular el aviso de fuera del plan, y se
  // volvia al principio. Indefinidamente, con los dos avisos correctos.
  //
  // UNA CONFIRMACION DADA NO SE RETIRA SOLA: se recuerda aqui y se re-manda en cada envio siguiente. Es lo que
  // garantiza que no haya bucle aunque manana se agregue un cuarto aviso; juntar los avisos en el servidor
  // mejora lo que se VE, pero no impide que un camino pierda una confirmacion.
  // SE GUARDAN CON LA CLAVE DE LA VENTA A LA QUE PERTENECEN. Al concretarse una venta, `keyRef` cambia, y con
  // eso las confirmaciones CADUCAN solas: la siguiente venta vuelve a pedirlas. Arrastrarlas saltaria los
  // avisos de la venta siguiente sin que nadie los haya visto, que es peor que el bucle que esto arregla.
  // (Atarlas a la clave, y no borrarlas en el efecto del exito, es ademas lo que evita modificar desde un
  // efecto un valor que el efecto lee.)
  const confirmado = useRef({ key: "", fueraDelPlan: false, anularLinks: false, duplicado: false });

  const submit = (
    opciones: { confirmDuplicate?: boolean; anularLinks?: boolean; fueraDelPlan?: boolean } = {},
    submitter?: HTMLElement | null,
  ) => {
    const form = formRef.current;
    // `new FormData(form, submitter)` LANZA si el botón no pertenece a ese formulario, así que se comprueba.
    const esDeEsteForm =
      submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement
        ? submitter.form === form
        : false;
    const fd = form
      ? new FormData(form, esDeEsteForm ? (submitter as HTMLButtonElement) : undefined)
      : new FormData();
    // Los controlados se re-afirman: su valor vive en el estado de React, no en el DOM.
    fd.set("patientId", patientId);
    fd.set("lineas", JSON.stringify(lineas));
    fd.set("idempotencyKey", keyRef.current);
    // Lo que se confirma AHORA (por opcion, o por el `name`/`value` del boton que envio) se suma a lo ya
    // confirmado. Objeto NUEVO, no mutacion de campos: el lint de inmutabilidad lo exige y ademas deja la
    // acumulacion en una sola expresion, que es mas facil de leer que tres `if`.
    // Si la clave cambio, la venta anterior se concreto: lo confirmado entonces no vale para esta.
    const ya =
      confirmado.current.key === keyRef.current
        ? confirmado.current
        : { key: keyRef.current, fueraDelPlan: false, anularLinks: false, duplicado: false };
    confirmado.current = {
      key: keyRef.current,
      fueraDelPlan: ya.fueraDelPlan || opciones.fueraDelPlan === true || fd.get("fueraDelPlanConfirmado") === "true",
      anularLinks: ya.anularLinks || opciones.anularLinks === true,
      duplicado: ya.duplicado || opciones.confirmDuplicate === true,
    };
    // ...y TODO lo confirmado hasta ahora viaja en este envio, venga de donde venga.
    if (confirmado.current.duplicado) fd.set("confirmDuplicate", "true");
    if (confirmado.current.anularLinks) fd.set("anularLinks", "true");
    if (confirmado.current.fueraDelPlan) fd.set("fueraDelPlanConfirmado", "true");
    ejecutarAccion(action, fd);
  };
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submit({}, (e.nativeEvent as SubmitEvent).submitter);
  };

  // Preview del total (precio del catalogo x cantidad), para ver el monto antes de cobrar.
  const total = useMemo(() => {
    return lineas.reduce((suma, l) => {
      const n = nutraceuticals.find((x) => x.id === l.nutraceuticalId);
      const q = Number(l.quantity);
      return suma + (n && Number.isFinite(q) && q > 0 ? n.unitPrice * q : 0);
    }, 0);
  }, [nutraceuticals, lineas]);

  if (patients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No tienes pacientes registrados para registrar una venta.
      </p>
    );
  }
  if (nutraceuticals.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay nutraceuticos con precio configurado. Asigna un precio en el catalogo antes de vender.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cash-patientId" className="text-xs">
            Paciente
          </Label>
          <select
            id="cash-patientId"
            name="patientId"
            required
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className={selectClass}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Label className="text-xs">Productos</Label>
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
              {lineas.length > 1 && (
                <Button type="button" variant="outline" onClick={() => quitar(i)}>
                  Quitar
                </Button>
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={anadir} className="self-start">
            Añadir producto
          </Button>
        </div>

        {/* ═══ BAJO DISTRIBUCIÓN NO SE PREGUNTA CÓMO PAGÓ (0211) ═══

            El paciente le pagó AL INTEGRANTE, así que no hay medio de pago de CNV que registrar: en efectivo,
            por transferencia o con datáfono, el dinero es suyo y es asunto suyo.

            PREGUNTARLO SERÍA OFRECER UNA RESPUESTA QUE NO SE USA: el servidor deriva el canal de la modalidad
            y lo que el formulario dijera se descartaría. Un campo cuyo valor se ignora enseña a desconfiar de
            los otros.

            Y EN SU LUGAR SE DICE QUÉ VA A PASAR, antes de registrar, que es lo que el profesional necesita
            saber: que no se cobra nada y que esto entra en su cuenta quincenal. */}
        {esDeDistribucion ? (
          <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium text-foreground">Esto registra la venta, no la cobra</span>
            <p className="text-xs text-muted-foreground">
              Estás en modalidad Distribución: el paciente te paga a ti y tú le facturas. Atlas descuenta el
              producto de tu vitrina y lo suma a la cuenta quincenal que CNV te factura. No se genera ningún
              cobro ni factura de CNV al paciente.
            </p>
          </div>
        ) : (
          /* COMO LLEGO LA PLATA (2026-09-25). Antes solo habia efectivo, y una transferencia se anotaba como
             efectivo: eso pone en la factura un medio que la DIAN distingue y apunta el dinero a la cuenta
             "Efectivo en poder de Integrantes", que dice que sigue por recoger cuando ya esta en un banco. */
          <div className="flex flex-col gap-1">
            <Label htmlFor="canal-del-pago">Cómo pagó</Label>
            <select id="canal-del-pago" name="canal" defaultValue="efectivo" className={selectClass} disabled={pending}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
        )}

        {/* LA `key` POR PACIENTE re-monta el bloque al cambiar de paciente: sin ella, la consulta elegida
            para uno se quedaría seleccionada para el siguiente, que es como se le cuelga una compra a la
            consulta de otra persona. */}
        <BloqueTratamiento
          key={patientId}
          patientId={patientId}
          tratamientos={tratamientosPorPaciente[patientId] ?? []}
        />

        {/* LA MISMA `key` POR PACIENTE que el bloque de arriba, y por el mismo motivo: el campo del celular
            se precarga con el del paciente elegido. Sin re-montar, el numero del anterior se quedaria en el
            campo y se despacharia un envio al telefono de otra persona. */}
        <BloqueDomicilio key={patientId} tieneCelularRegistrado={tieneCelular} />

        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar la venta"}
        </Button>

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
        {state.pendingLinkWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
            <p className="text-attention">{state.pendingLinkWarning}</p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => submit({ anularLinks: true })}
              className="self-start"
            >
              Anular el link y cobrar en efectivo
            </Button>
          </div>
        ) : null}

        {state.duplicateWarning ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-attention-bg p-3 text-sm">
            <p className="text-attention">{state.duplicateWarning}</p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => submit({ confirmDuplicate: true })}
              className="self-start"
            >
              Registrar de todos modos
            </Button>
          </div>
        ) : null}

        {/* ═══ Y SI HAY VARIOS AVISOS, UN SOLO BOTON LOS CONFIRMA TODOS (Santiago, 2026-10-02) ═══

            Cada aviso conserva su botón, porque cada uno explica una cosa distinta y a veces solo sale uno.
            Pero cuando salen dos o tres, confirmarlos de uno en uno obliga a tres viajes al servidor para una
            venta que el profesional ya decidió hacer, con el paciente delante. Este botón los confirma de una.

            VA AL FINAL Y DICE LO QUE HACE: no es un "aceptar todo" genérico, nombra las acciones que ejecuta. */}
        {[state.outOfPlanWarning, state.pendingLinkWarning, state.duplicateWarning].filter(Boolean).length > 1 ? (
          <div className="flex w-full flex-col gap-2 rounded-lg border border-attention/30 p-3 text-sm">
            <p className="text-muted-foreground">
              Hay {[state.outOfPlanWarning, state.pendingLinkWarning, state.duplicateWarning].filter(Boolean).length}{" "}
              cosas que confirmar para esta venta. Puedes confirmarlas de una:
            </p>
            <Button
              key="confirmar-todo"
              type="button"
              disabled={pending}
              onClick={() =>
                submit({
                  fueraDelPlan: state.outOfPlanWarning != null,
                  anularLinks: state.pendingLinkWarning != null,
                  confirmDuplicate: state.duplicateWarning != null,
                })
              }
              className="self-start"
            >
              {[
                state.outOfPlanWarning ? "Registrarlo así" : null,
                state.pendingLinkWarning ? "anular el link" : null,
                state.duplicateWarning ? "registrar de todos modos" : null,
              ]
                .filter(Boolean)
                .join(" y ")}
            </Button>
          </div>
        ) : null}
      </form>

      {total != null ? (
        <p className="text-sm text-muted-foreground">
          Total a cobrar: <span className="font-medium text-foreground">{total.toLocaleString("es-CO")} COP</span>{" "}
          (IVA incluido). Este dinero es de CNV; lo custodias hasta consignar.
        </p>
      ) : null}
    </div>
  );
}
