"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format/date";

import { registrarSinPrescripcionAction, type TreatmentActionState } from "../actions";

const INICIAL: TreatmentActionState = { error: null, success: null, warning: null };

// ═══ "NO PRESCRIBO NUTRACÉUTICOS": EL CRITERIO CLÍNICO (Santiago, 2026-10-10. Migración 0214) ═══
//
// ── DE DÓNDE SALE, Y POR QUÉ NO ES UN CAMBIO DE REDACCIÓN ────────────────────────────────────────
//
// Lo trajo de la reunión con la integrante que más vende, y el argumento es de fondo. Textual suyo: *"una cosa
// es prescribir un producto, que básicamente eso lo hacen los integrantes, y otra cosa es que el paciente
// quiera comprar o no quiera comprar algún producto."*
//
// Y la segunda mitad, que es la que decide: *"no me parece correcto registrar por qué un paciente no se lleva
// un producto cuando puede ser por precio y muchas razones"*, y además puede comprarlo después.
//
// ── QUÉ MEDÍA EL BLOQUE QUE ESTO REEMPLAZA ──────────────────────────────────────────────────────
//
// "El paciente no los adquiere por ahora" preguntaba si el PACIENTE adquiere, y eso Atlas YA LO SABE POR UN
// HECHO: Dirección mide "comprado en N consultas" desde las VENTAS. Un campo que pregunta lo mismo y lo
// responde de memoria solo puede contradecir a la venta, y ya pasó: el aviso "después, el día X, sí compró"
// existe porque la nota y la venta se contradecían.
//
// LO QUE NO TENÍAMOS POR NINGÚN LADO es esto: que el profesional evaluó y decidió NO prescribir. No deja
// rastro en ninguna otra parte, y es lo que de verdad alimenta la investigación, porque que el modelo
// recomiende algo y el profesional no lo prescriba ES el dato.
//
// ── POR QUÉ VA JUNTO A "GUARDAR PRESCRIPCIÓN" Y NO SOBRE LOS RECOMENDADOS ───────────────────────
//
// El bloque viejo vivía sobre la lista de recomendados, porque hablaba de ELLOS. Este habla de TODA la
// prescripción, y es la otra forma de cerrarla: o se prescribe algo, o se registra que no se prescribe nada.
// Las dos salidas van en el mismo sitio, que es donde el profesional termina.
//
// ── POR QUÉ ESTO NO ES UN <form> ────────────────────────────────────────────────────────────────
//
// Se monta DENTRO del formulario de la prescripción, y un `<form>` dentro de otro es HTML INVÁLIDO: el
// navegador DESCARTA la etiqueta interna, así que sus campos y su botón pasan a ser del formulario de AFUERA.
// Es el hazard 7 de CLAUDE.md, y nos costó un bloqueo real el 2026-10-02 con sus dos síntomas (pulsar
// "Registrar" guardaba la prescripción, y la recarga de esa otra acción saltaba a otra pestaña).
//
// Así que: sin `<form>` propio, los campos SIN `name` (con `name` seguirían viajando en el envío de afuera,
// que es la mitad que no se ve), controlados, y la acción por `ejecutarAccion`, que es el camino que el
// proyecto ya tiene para los botones sin formulario. Los botones, `type="button"`.
export function SinPrescripcionForm({
  evaluationId,
  /** Lo ya registrado, si el profesional ya decidió no prescribir. null = todavía no. */
  yaRegistrado,
  /** Hay nutracéuticos en la prescripción: entonces esto no se ofrece (se contradirían). */
  hayPrescripcion,
}: {
  evaluationId: string;
  yaRegistrado: { motivo: string; at: string } | null;
  hayPrescripcion: boolean;
}) {
  const [state, action, pending] = useActionState(registrarSinPrescripcionAction, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  useFormToastRefreshOnSuccess(state);

  // YA REGISTRADO: se dice y no se vuelve a ofrecer. Ofrecerlo otra vez invita a escribir dos motivos para lo
  // mismo y deja el segundo pisando al primero sin que nadie lo note.
  if (yaRegistrado) {
    return (
      <p className="max-w-prose rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        Registraste el {formatDate(yaRegistrado.at)} que no prescribes nutracéuticos en esta consulta:{" "}
        &ldquo;{yaRegistrado.motivo}&rdquo;
      </p>
    );
  }

  // CON PRESCRIPCIÓN NO SE OFRECE: decir las dos cosas sobre la misma consulta deja a quien la lea después sin
  // saber cuál creer, y es la historia clínica. El servidor lo RE-COMPRUEBA dentro de la transacción, porque
  // una guarda que solo vive en la pantalla se salta invocando la acción.
  if (hayPrescripcion) return null;

  if (!abierto) {
    return (
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        No prescribo nutracéuticos
      </Button>
    );
  }

  const registrar = () => {
    const fd = new FormData();
    fd.set("evaluationId", evaluationId);
    fd.set("motivo", motivo);
    ejecutarAccion(action, fd);
  };

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="motivo-sin-prescripcion" className="text-xs">
          Por qué no prescribes nutracéuticos en esta consulta
        </Label>
        <Input
          id="motivo-sin-prescripcion"
          maxLength={1000}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Tu criterio clínico: por ejemplo, prefiero ajustar primero la alimentación"
          autoFocus
        />
        {/* SE DICE EL MÍNIMO ANTES DE PULSAR, no después en un error: el motivo es lo único que esto registra,
            y un "escribe al menos 5 caracteres" tras enviar se lee como un obstáculo y no como lo que es. */}
        <span className="text-xs text-muted-foreground">
          Queda en la historia clínica de esta consulta, con tu nombre y la fecha.
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button key="registrar-sin-prescripcion" type="button" disabled={pending} onClick={registrar}>
          {pending ? "Registrando..." : "Registrar"}
        </Button>
        <Button
          key="cancelar-sin-prescripcion"
          type="button"
          variant="ghost"
          onClick={() => setAbierto(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
