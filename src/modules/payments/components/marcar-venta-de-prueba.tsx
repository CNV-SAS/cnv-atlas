"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { marcarVentaDePruebaFormAction, type DevolucionState } from "../actions";

const inicial: DevolucionState = { error: null, success: null, warning: null };

// ═══ MARCAR UNA VENTA COMO PRUEBA, DESDE LA VENTA (0217) ═══
//
// AQUÍ Y NO EN UNA PANTALLA APARTE, porque la pregunta "¿esta venta fue una prueba?" se responde mirando la
// venta: su paciente, su producto, su fecha. Una lista aparte de "ventas a marcar" obligaría a identificarla
// por el monto, que es justo la confusión que esta fila ya resolvió al poner el nombre y el documento.
//
// EL MOTIVO ES UN CAMPO Y NO UN BOTÓN, y es la diferencia con las demás acciones de esta fila: esta marca no
// se deriva de nada, la pone una persona, y es la única de las cuatro entradas de la que se puede preguntar
// "¿por qué esta venta no cuenta?" sin que el sistema pueda responder solo.
//
// SE ABRE AL PULSAR, cerrado por defecto: es una acción poco frecuente al lado de las que sí se usan a
// diario (entregar, devolver), y un campo de texto abierto en las nueve filas compite con ellas.
//
// Y NO ES UN `<form>` ANIDADO (hazard 7 de CLAUDE.md): esta fila no está dentro de otro formulario, pero el
// bloque se escribe con su propio form a propósito y se verifica que no lo esté, porque el navegador
// DESCARTA el de adentro y su botón ejecutaría la acción equivocada.
export function MarcarVentaDePrueba({
  transactionId,
  yaMarcada,
  yaNoCuentaPorDerivacion = false,
}: {
  transactionId: string;
  /** Ya la marcó alguien: entonces lo que se ofrece es deshacerlo, no volver a marcar. */
  yaMarcada: boolean;
  /**
   * YA NO CUENTA, PERO POR OTRA ENTRADA (2026-10-28): su profesional, su paciente o su producto son de
   * prueba, y nadie la marcó a mano.
   *
   * ENTONCES NO SE OFRECE MARCARLA, y la distinción no es cosmética: marcar a mano una venta que ya está
   * fuera de las cifras no cambia ninguna cifra, pero SÍ cambia qué botón aparece después (pasaría a
   * ofrecer "quitar la marca", que tampoco la devolvería a las cifras porque la derivación sigue). Dos
   * clics que no hacen lo que dicen. Es la misma regla que el paciente derivado, al que se le ofrece "es
   * real" y no "desmarcar".
   */
  yaNoCuentaPorDerivacion?: boolean;
}) {
  const [state, action, pending] = useActionState(marcarVentaDePruebaFormAction, inicial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);

  // NO SE OFRECE NADA sobre una venta que ya está fuera por derivación: el chip de la fila ya dice por
  // qué, y ahí es donde hay que actuar (sobre el paciente, el profesional o el producto).
  if (yaNoCuentaPorDerivacion && !yaMarcada) return null;

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start text-xs text-muted-foreground underline underline-offset-4"
      >
        {yaMarcada ? "Esta venta sí cuenta: quitar la marca de prueba" : "Fue una prueba: marcarla"}
      </button>
    );
  }

  return (
    <form onSubmit={enviarSinReset(action)} className="flex flex-col gap-2">
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="accion" value={yaMarcada ? "desmarcar" : "marcar"} />
      <span className="text-xs text-muted-foreground">
        {yaMarcada
          ? "Vuelve a contar en todas las cifras. Escribe por qué sí cuenta."
          : "Deja de contar en las cifras, en las comisiones y en los pendientes. No devuelve la unidad al inventario: eso es un ajuste por conteo."}
      </span>
      <Input
        name="motivo"
        required
        minLength={10}
        maxLength={300}
        placeholder={yaMarcada ? "Por qué sí cuenta" : "Por qué fue una prueba"}
        className="w-full max-w-md"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Guardando..." : yaMarcada ? "Quitar la marca" : "Marcar como prueba"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAbierto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
