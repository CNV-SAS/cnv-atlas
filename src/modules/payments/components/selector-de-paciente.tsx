"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { SelectablePatient } from "../data/payments-repository";

// ═══ ELEGIR EL PACIENTE DE UNA VENTA, BUSCANDO (Santiago, 2026-10-10) ═══
//
// ── LOS DOS DEFECTOS QUE CIERRA, Y EL SEGUNDO ERA EL GRAVE ───────────────────────────────────────
//
// 1. VENIA UNO POR DEFECTO (`patients[0]`). Textual suyo: *"siempre aparece uno por default, cuando debería
//    aparecer vacío para que sea el profesional quien se encargue de seleccionar al paciente."* Y es más que
//    una preferencia: un formulario de COBRO que llega con una persona ya elegida invita a registrarle una
//    venta a quien encabeza la lista alfabética. El riesgo no es teórico, es un cobro al paciente equivocado.
//
// 2. Y EL DESPLEGABLE SOLO MOSTRABA EL DOCUMENTO. Una lista de 200 números, sin nombres. Buscar ahí no es
//    difícil: es imposible, porque el dato por el que uno busca a una persona no estaba. Esa era la causa
//    real de *"es muy difícil para ella buscar pacientes"*, no la cantidad.
//
// ── POR QUE UNA LISTA DE BOTONES Y NO UN `<datalist>` NI UN COMBOBOX ─────────────────────────────
//
// Un `<datalist>` obliga a mapear el TEXTO tecleado de vuelta a un id, y dos pacientes con el mismo nombre
// rompen ese mapeo en silencio: se cobraría al otro. Un combobox de verdad (listbox con teclado, aria-activedescendant)
// es una pieza que hay que mantener, y esto es un selector de una pantalla.
//
// Una lista corta de BOTONES no tiene ninguno de los dos problemas: lo que se envía es el id del botón que se
// pulsó, nunca texto interpretado, y un botón ya es accesible por teclado sin que haya que construirlo.
//
// ── Y EL ID VIAJA EN UN `<input type="hidden">` ─────────────────────────────────────────────────
//
// El campo de búsqueda NO lleva `name`: si lo llevara, el texto tecleado viajaría en el envío del formulario
// que lo contiene. Lo que viaja es el id, y solo cuando hay uno elegido.
export function SelectorDePaciente({
  pacientes,
  valor,
  onElegir,
  id,
  etiqueta = "Paciente",
}: {
  pacientes: SelectablePatient[];
  /** El id elegido, o "" si todavía no hay ninguno. */
  valor: string;
  onElegir: (id: string) => void;
  /** Para que las dos instancias de la página no compartan ids de accesibilidad. */
  id: string;
  etiqueta?: string;
}) {
  const [busqueda, setBusqueda] = useState("");
  const elegido = pacientes.find((p) => p.id === valor) ?? null;

  // CUANTAS SE MUESTRAN: las suficientes para reconocer a alguien, no tantas como para volver a ser una lista
  // que hay que recorrer. Si no aparece, se escribe una letra más.
  const TOPE = 8;
  const coincidencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q === "") return [];
    // POR NOMBRE O POR DOCUMENTO, que son las dos formas en que alguien busca a un paciente: lo tiene al lado
    // (y sabe su nombre) o lo tiene en una factura (y tiene su documento).
    return pacientes
      .filter((p) => p.nombre.toLowerCase().includes(q) || p.label.toLowerCase().includes(q))
      .slice(0, TOPE);
  }, [busqueda, pacientes]);

  if (elegido) {
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-elegido`}>{etiqueta}</Label>
        <div
          id={`${id}-elegido`}
          className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
        >
          <span className="text-sm font-medium text-foreground">{elegido.nombre || "Sin nombre"}</span>
          <span className="text-xs text-muted-foreground">{elegido.label}</span>
          {/* CAMBIARLO VUELVE A VACIO, no a otra lista abierta: elegir a otra persona es empezar de nuevo, y
              dejar la anterior a la vista es como se cobra al equivocado. */}
          <button
            type="button"
            onClick={() => {
              onElegir("");
              setBusqueda("");
            }}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={`${id}-buscar`}>{etiqueta}</Label>
      <Input
        id={`${id}-buscar`}
        // SIN `name`: lo que viaja es el id, no lo que alguien tecleo (ver la cabecera).
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Busca por nombre o documento"
        className="max-w-md"
        autoComplete="off"
      />
      {busqueda.trim() === "" ? (
        <span className="text-xs text-muted-foreground">
          Escribe el nombre o el documento del paciente. Ninguno viene elegido de antemano.
        </span>
      ) : coincidencias.length === 0 ? (
        // SE DICE QUE NO HAY, y no se deja el hueco: un vacío silencioso se lee como que la pantalla se rompió.
        <span className="text-xs text-attention">
          Ningún paciente tuyo coincide con “{busqueda.trim()}”.
        </span>
      ) : (
        <ul className="flex max-w-md flex-col gap-1">
          {coincidencias.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onElegir(p.id)}
                className="flex w-full flex-wrap items-baseline gap-2 rounded-md border border-border px-3 py-1.5 text-left text-sm hover:bg-muted/50"
              >
                <span className="font-medium text-foreground">{p.nombre || "Sin nombre"}</span>
                <span className="text-xs text-muted-foreground">{p.label}</span>
              </button>
            </li>
          ))}
          {pacientes.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) || p.label.toLowerCase().includes(busqueda.trim().toLowerCase())).length > TOPE ? (
            <li className="px-1 text-xs text-muted-foreground">
              Hay más que coinciden: escribe una letra más para acotar.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
