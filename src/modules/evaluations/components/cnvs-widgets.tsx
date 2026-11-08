"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { SurveyItemView } from "../data/survey-view-types";
import { SurveyQuestion } from "./survey-widgets";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES CONTROLES QUE SOLO EXISTEN EN LA CNV-S  ·  v15 §2.3, §2.4 y §7.2  ·  2026-11-07
//
// Viven aparte de `survey-widgets` porque son del INSTRUMENTO de seguimiento, no de una pregunta: el
// bloque de confirmacion y el filtro digestivo no son tipos de pregunta, son formas de PRESENTAR una que
// ya existe. Mezclarlos con los widgets haria que cada widget tuviera que saber en que instrumento esta.
//
// ═══ LOS TRES EMITEN SU VALOR EN UN `<input type="hidden">` DENTRO DEL FORMULARIO ═══
//
// Es la misma forma que el resto de los widgets (`answer_<id>`), y no es un detalle: un control que vive
// FUERA del formulario deja de validarse y su valor no viaja (hazard 8). Y ninguno lleva `required`: esta
// encuesta no bloquea por campos vacios, avisa (hazard 6).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const pill = (activo: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition ${
    activo
      ? "border-foreground bg-foreground text-background"
      : "border-border bg-background hover:bg-muted"
  }`;

// ── 1 · LA PREGUNTA POR PRODUCTO (S1 y S2) ────────────────────────────────────────────────────────
//
// Su S1 se presenta *"una vez por cada nutracéutico"* y su S2 *"una sola respuesta por producto"*. Una
// pregunta de Atlas guarda UNA respuesta por (encuesta, pregunta), asi que el valor viaja como un objeto
// JSON {idDelProducto: opcion}, que es la misma forma que `opcion_multiple` ya usa para sus arreglos.

export type ProductoIndicado = { id: string; nombre: string; dosis: string | null };

export function PreguntaPorProducto({
  q,
  productos,
  answer,
  soloSiNoAdherente,
  onValores,
}: {
  q: SurveyItemView;
  productos: ProductoIndicado[];
  answer?: string | null;
  /**
   * Lo que el paciente lleva respondido, hacia arriba. Lo usa el S1: de el sale QUE PRODUCTOS presenta
   * el S2 (su §2.3: *"solo si S1 no es «Todos los días» ni «5 o más»"*).
   */
  onValores?: (v: Record<string, string>) => void;
  /**
   * EL S2 SOLO SE PRESENTA para los productos que NO se tomaron como se indico (su §2.3). Se recibe ese
   * subconjunto ya resuelto y no la regla: si este control decidiera, habria dos definiciones de
   * "adherente al producto", la suya y la de esta pantalla.
   */
  soloSiNoAdherente?: Set<string>;
}) {
  const inicial = (() => {
    try {
      const v = answer ? (JSON.parse(answer) as Record<string, string>) : {};
      return typeof v === "object" && v !== null ? v : {};
    } catch {
      // Una respuesta guardada que no es JSON no es un error del paciente: se arranca en blanco.
      return {} as Record<string, string>;
    }
  })();
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const visibles = soloSiNoAdherente
    ? productos.filter((p) => soloSiNoAdherente.has(p.id))
    : productos;

  if (visibles.length === 0) return null;

  const emitido = Object.keys(valores).length > 0 ? JSON.stringify(valores) : "";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">{q.number}.</span> {q.text}
      </p>
      {q.hint ? <p className="text-xs text-muted-foreground">{q.hint}</p> : null}
      {visibles.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3">
          <p className="text-sm font-medium text-foreground">
            {p.nombre}
            {p.dosis ? <span className="font-normal text-muted-foreground"> · {p.dosis}</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => {
              const activo = valores[p.id] === o.text;
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={activo}
                  onClick={() =>
                    setValores((v) => {
                      const siguiente = { ...v };
                      if (activo) delete siguiente[p.id];
                      else siguiente[p.id] = o.text;
                      onValores?.(siguiente);
                      return siguiente;
                    })
                  }
                  className={pill(activo)}
                >
                  {o.text}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {emitido ? <input type="hidden" name={`answer_${q.id}`} value={emitido} /> : null}
    </div>
  );
}

// ── 2 · EL BLOQUE DE CONFIRMACION (§2.4) ──────────────────────────────────────────────────────────
//
// *"Cada ítem muestra la respuesta anterior y dos botones, «Sin cambios» y «Editar». «Editar» abre la
// pregunta original con sus opciones."*
//
// LOS TRES ESTADOS SON SUYOS (`sin_cambios`, `editado`, `sin_marcar`) y los tres se guardan: su §2.7
// pide el estado por item. `sin_marcar` no es un error ni un hueco: es que el paciente paso de largo, y
// distinguirlo de "confirmo que no cambio" es la diferencia entre un dato y una suposicion.

export type EstadoDeConfirmacion = "sin_marcar" | "sin_cambios" | "editado";

export function BloqueDeConfirmacion({
  q,
  anterior,
  answer,
  estado,
  onEstado,
}: {
  q: SurveyItemView;
  /** La respuesta de la consulta anterior. null = no la hay, y entonces el item se presenta abierto. */
  anterior: string | null;
  answer?: string | null;
  estado: EstadoDeConfirmacion;
  onEstado: (e: EstadoDeConfirmacion) => void;
}) {
  // SIN RESPUESTA ANTERIOR NO HAY NADA QUE CONFIRMAR, asi que se presenta como una pregunta normal. Es
  // el caso de un paciente cuya primera consulta no llevaba ese item (una version anterior del
  // instrumento): pedirle que confirme un vacio seria pedirle que confirme nada.
  if (anterior == null || anterior.trim() === "") {
    return <SurveyQuestion q={q} answer={answer} />;
  }

  if (estado === "editado") {
    return (
      <div className="flex flex-col gap-2">
        <SurveyQuestion q={q} answer={answer ?? anterior} />
        <button
          type="button"
          onClick={() => onEstado("sin_cambios")}
          className="self-start text-xs text-muted-foreground underline"
        >
          Dejar la respuesta anterior
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">{q.number}.</span> {q.text}
      </p>
      <p className="rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground">
        La vez pasada respondiste: <strong>{anterior}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={estado === "sin_cambios" ? "default" : "outline"}
          onClick={() => onEstado("sin_cambios")}
        >
          Sin cambios
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onEstado("editado")}>
          Editar
        </Button>
      </div>
      {/* SE GUARDA LA RESPUESTA ANTERIOR, no una marca de "confirmado": lo que la consulta de hoy tiene
          que poder decir es QUE respondio el paciente, no que no cambio. Sin esto, una encuesta
          confirmada entera saldria vacia y el gate del diagnostico la frenaria. */}
      {estado === "sin_cambios" ? (
        <input type="hidden" name={`answer_${q.id}`} value={anterior} />
      ) : null}
    </div>
  );
}

// ── 3 · EL FILTRO DIGESTIVO (§7.2) ────────────────────────────────────────────────────────────────
//
// Es una pregunta de si/no CONTROLADA, y no el widget normal, por una razon concreta: su respuesta
// decide si se presentan los siete sintomas, y el formulario tiene que saberla en el momento. Los
// widgets normales guardan su valor dentro de si mismos y lo emiten en un hidden; leerlo desde fuera
// obligaria a espiar el DOM despues de cada clic, que es la clase de cable que se rompe en silencio.

export function FiltroDigestivo({
  q,
  valor,
  onValor,
}: {
  q: SurveyItemView;
  valor: string | null;
  onValor: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">
        <span className="text-muted-foreground">{q.number}.</span> {q.text}
      </p>
      <div className="flex flex-wrap gap-2">
        {q.options.map((o) => {
          const activo = valor === o.text;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={activo}
              onClick={() => onValor(activo ? null : o.text)}
              className={pill(activo)}
            >
              {o.text}
            </button>
          );
        })}
      </div>
      {valor ? <input type="hidden" name={`answer_${q.id}`} value={valor} /> : null}
    </div>
  );
}
