"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enteroDeTexto, pesosDeTexto } from "@/core/pesos";
import { Label } from "@/components/ui/label";

import { registrarVentaRetroactivaAction, type DevolucionState } from "../actions";
import {
  BloqueTratamiento,
  consultaRespondida,
  type ConsultaDeLaCompra,
  type TratamientoParaElegir,
} from "./bloque-tratamiento";

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
/** El paciente trae los profesionales a los que esta asignado: la lista se filtra por el que vendio. */
export type OpcionDePaciente = OpcionSimple & { profesionales: string[] };

type Linea = { nutraceuticalId: string; cantidad: string; precioUnitario: string };

export function VentaRetroactivaForm({
  organizationId,
  profesionales,
  pacientes,
  productos,
  tratamientosPorPaciente,
}: {
  organizationId: string;
  profesionales: OpcionSimple[];
  pacientes: OpcionDePaciente[];
  productos: OpcionSimple[];
  /** Las consultas de cada paciente, para poder atar la venta. Ver la nota del bloque de abajo. */
  tratamientosPorPaciente: Record<string, TratamientoParaElegir[]>;
}) {
  const [state, action, pending] = useActionState(registrarVentaRetroactivaAction, inicial);
  useFormToastAndRefresh(state);
  const [lineas, setLineas] = useState<Linea[]>([
    { nutraceuticalId: productos[0]?.id ?? "", cantidad: "1", precioUnitario: "" },
  ]);

  // QUE CAMPOS SE HAN TOCADO, por línea: es lo que decide si un campo vacío ya puede quejarse.
  // EL PROFESIONAL ELEGIDO FILTRA LOS PACIENTES (smoke del 2026-09-29): la lista traía a todos, y en una
  // lista de cientos es como se le cuelga una compra a quien no la hizo. Si el elegido no tiene pacientes
  // asignados se muestran todos, con su aviso: es mejor poder registrar la venta que quedarse sin lista.
  const [profesionalId, setProfesionalId] = useState(profesionales[0]?.id ?? "");
  const suyos = pacientes.filter((x) => x.profesionales.includes(profesionalId));
  const pacientesVisibles = suyos.length > 0 ? suyos : pacientes;
  // EL PACIENTE PASA A SER ESTADO porque sus consultas dependen de el: sin esto, el bloque de tratamiento
  // mostraria las de otro. Se reinicia al cambiar de profesional, que es cuando cambia la lista visible.
  const [pacienteId, setPacienteId] = useState("");
  const pacienteElegido = pacientesVisibles.some((x) => x.id === pacienteId)
    ? pacienteId
    : (pacientesVisibles[0]?.id ?? "");

  // ═══ LA RESPUESTA DEL BLOQUE DE LA CONSULTA, AQUI (Santiago, 2026-10-10) ═══
  //
  // El bloque dejo de tener estado propio: lo guarda quien lo usa. Antes se re-montaba con una
  // `key={pacienteElegido}`, que es lo que en /pagos producia los bloques apilados que el reporto. Aqui
  // el bloque no se apilaba (hay un solo formulario), pero la regla se barre en los dos sitios: una regla
  // que vive en varios sitios y se arregla en uno vuelve por el que se dejo.
  const VACIA: ConsultaDeLaCompra = { treatmentId: "", suelta: false, motivo: "" };
  const [consulta, setConsulta] = useState<ConsultaDeLaCompra>(VACIA);
  // Y SE VACIA AL CAMBIAR DE PACIENTE, que es lo que la `key` hacia: sin esto, la consulta elegida para
  // uno se queda seleccionada para el siguiente, y asi se le cuelga una venta a la consulta de otra persona.
  // Pasa tambien al cambiar de PROFESIONAL, porque `pacienteElegido` es derivado y cae al primero de la
  // lista nueva. Se ajusta durante el render, no en un efecto (regla de lint set-state-in-effect).
  const [pacienteVisto, setPacienteVisto] = useState(pacienteElegido);
  if (pacienteElegido !== pacienteVisto) {
    setPacienteVisto(pacienteElegido);
    setConsulta(VACIA);
  }

  const [tocadas, setTocadas] = useState<{ cantidad?: boolean; precioUnitario?: boolean }[]>([{}]);
  const tocar = (i: number, campo: "cantidad" | "precioUnitario") =>
    setTocadas((prev) => prev.map((t, j) => (j === i ? { ...t, [campo]: true } : t)));

  const cambiar = (i: number, campo: Partial<Linea>) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, ...campo } : l)));
  const anadir = () => {
    setLineas((prev) => [...prev, { nutraceuticalId: productos[0]?.id ?? "", cantidad: "1", precioUnitario: "" }]);
    setTocadas((prev) => [...prev, {}]);
  };
  const quitar = (i: number) => {
    setLineas((prev) => prev.filter((_, j) => j !== i));
    setTocadas((prev) => prev.filter((_, j) => j !== i));
  };

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
  //
  // PERO SOLO SOBRE LO QUE YA SE TOCÓ (smoke del 2026-09-29). Antes salía "Producto 1: revisa el precio"
  // AL ABRIR LA PANTALLA, sobre un campo que nadie había tocado todavía, y con el botón deshabilitado. Un
  // formulario que se queja antes de que escribas nada enseña a ignorar sus avisos, que es lo contrario de
  // lo que este aviso existe para hacer.
  const problemas = leidas
    .map((l, i) => {
      const faltan = [
        tocadas[i]?.cantidad && (l.cantidad == null || l.cantidad <= 0) ? "la cantidad" : null,
        tocadas[i]?.precioUnitario && (l.precioUnitario == null || l.precioUnitario <= 0) ? "el precio" : null,
      ].filter(Boolean);
      return faltan.length ? `Producto ${i + 1}: revisa ${faltan.join(" y ")}.` : null;
    })
    .filter((x): x is string => x != null);

  // Y EL BOTÓN NO SE DESHABILITA POR LO NO TOCADO: lo que falta de verdad se dice al intentar enviar. Un
  // botón muerto sin explicación es peor que un error claro.
  const incompleto = leidas.some(
    (l) => l.cantidad == null || l.cantidad <= 0 || l.precioUnitario == null || l.precioUnitario <= 0,
  );

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
          <select
            id="vr-profesional"
            name="professionalId"
            className={selectClass}
            disabled={pending}
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
          >
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vr-paciente">A quién</Label>
          <select
            id="vr-paciente"
            name="patientId"
            className={selectClass}
            disabled={pending}
            value={pacienteElegido}
            onChange={(e) => setPacienteId(e.target.value)}
          >
            {pacientesVisibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {suyos.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Ese profesional no tiene pacientes asignados, así que salen todos. Revisa bien a quién se la
              registras.
            </span>
          ) : null}
        </div>
        {/* ═══ DE QUÉ CONSULTA SALE, TAMBIÉN AQUÍ (Santiago, 2026-09-30) ═══

            /pagos lo exige desde el 29 y esta pantalla no, así que quedaba un camino por donde una venta
            entra sin el vínculo que acabamos de construir. Y no es un camino menor: es el que reconstruye la
            historia comercial entera, o sea el que más ventas va a meter.

            SE REUSA EL MISMO BLOQUE de /pagos, no una copia: la regla (ninguno preseleccionado, cada opción
            con su fecha, salida explícita con motivo) tiene que ser la misma, y dos redacciones se separan.

            Y DESDE EL 2026-10-10 EL BLOQUE NO GUARDA SU RESPUESTA: la guarda este formulario y la manda en dos
            campos ocultos, porque el bloque dejó de llevar `name` en sus controles. Ver su cabecera. */}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>De qué consulta sale</Label>
          <input type="hidden" name="treatmentId" value={consulta.treatmentId} />
          <input
            type="hidden"
            name="ventaSueltaMotivo"
            value={consulta.suelta ? consulta.motivo : ""}
          />
          <BloqueTratamiento
            tratamientos={tratamientosPorPaciente[pacienteElegido] ?? []}
            valor={consulta}
            onCambiar={(cambio) => setConsulta((prev) => ({ ...prev, ...cambio }))}
            hayPaciente={pacienteElegido !== ""}
            id="vr-consulta"
          />
          <span className="text-xs text-muted-foreground">
            En una venta de hace meses lo normal es que no se pueda decir: entonces se marca la salida y se
            escribe por qué. Lo que no puede pasar es que quede suelta sin que nadie lo diga.
          </span>
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
          {/* LOS TRES, y la transferencia es la que faltaba: antes de Atlas se cobraba en efectivo o por
              transferencia, y anotar una transferencia como efectivo es la pequeña mentira que este bloque
              existe para evitar. */}
          <select id="vr-medio" name="medioDePago" className={selectClass} disabled={pending} defaultValue="efectivo">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="wompi">Pasarela (Wompi)</option>
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
              onChange={(e) => {
                tocar(i, "cantidad");
                cambiar(i, { cantidad: e.target.value });
              }}
              disabled={pending}
            />
            <Input
              aria-label="Precio unitario de ese día"
              inputMode="numeric"
              placeholder="Precio de ese día"
              className="w-40"
              value={l.precioUnitario}
              onChange={(e) => {
                tocar(i, "precioUnitario");
                cambiar(i, { precioUnitario: e.target.value });
              }}
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

      {/* ═══ Y LA CONSULTA ENTRA EN EL GATE, PERO DICIENDOLO ═══

          El bloque salio del alcance del navegador (sus controles ya no son campos del formulario), asi que
          su `required` no aplicaria y hacia falta sustituirlo. Se sustituye en el boton.

          Y EL BOTON LO DICE EN SU ROTULO, que no es un adorno: tres lineas mas arriba este archivo tiene
          escrito que *"un boton muerto sin explicacion es peor que un error claro"*, y deshabilitarlo en
          silencio seria contradecir su propia regla en el mismo formulario. */}
      <Button
        type="submit"
        disabled={pending || incompleto || !consultaRespondida(consulta)}
        className="w-fit"
      >
        {consultaRespondida(consulta) ? "Registrar la venta" : "Di de qué consulta sale"}
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
