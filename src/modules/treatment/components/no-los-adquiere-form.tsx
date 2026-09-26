"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveNutraDecisionAction, type TreatmentActionState } from "../actions";

const INICIAL: TreatmentActionState = { error: null, success: null, warning: null };

// ═══ UN SOLO BOTON DONDE HABIA UNA PREGUNTA DE TRES OPCIONES (Santiago, 2026-09-26) ═══
//
// LO QUE SE RETIRO: "¿El paciente adquiere los nutraceuticos?" con si / no / pendiente y un desplegable de seis
// razones. La razon de fondo es que el "SI" NO HAY QUE PREGUNTARLO: si el paciente se los lleva, hay una venta,
// y una venta es un hecho. Preguntarlo ademas obligaba a marcar una casilla que decia lo mismo que la venta ya
// decia, y esa casilla se olvidaba.
//
// LO QUE SI HAY QUE PREGUNTAR ES EL "NO", porque de eso no queda rastro en ninguna parte: nadie registra las
// ventas que no ocurrieron. Y VA SOBRE LOS RECOMENDADOS POR EL MODELO, no sobre toda la prescripcion: son los
// que importan para la investigacion (que el modelo recomiende algo y el paciente no lo tome es el dato).
//
// ── COMO SE GUARDA, SIN MIGRACION ──
//
// Reusa la decision que ya existe: `decision: "no"` con `reason: "otra"` y el motivo en `note`. El schema ya lo
// admite (y ya exige texto cuando la razon es "otra"), asi que no hace falta ni una columna nueva ni un valor
// nuevo de enum. Las otras cinco razones dejan de ofrecerse pero siguen existiendo en los registros viejos, que
// es lo correcto: un dato que alguien dio no se borra porque cambiamos la pantalla.
//
// EL DESCARTE POR RAZON CLINICA NO ESTA AQUI: vive en la linea de cada producto prescrito, que es donde el
// profesional lo decide, y desde ahi si escribe la contraindicacion del paciente.
export function NoLosAdquiereForm({ evaluationId, yaRegistrado }: { evaluationId: string; yaRegistrado: string | null }) {
  const [state, action, pending] = useActionState(saveNutraDecisionAction, INICIAL);
  const [abierto, setAbierto] = useState(false);
  useFormToastRefreshOnSuccess(state);

  // YA REGISTRADO: se dice y no se vuelve a ofrecer el boton. Ofrecerlo otra vez invita a escribir dos motivos
  // para lo mismo y deja el segundo pisando al primero sin que nadie lo note.
  if (yaRegistrado != null) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
        Quedó registrado que el paciente no los adquiere por ahora
        {yaRegistrado.trim() !== "" ? <>: &ldquo;{yaRegistrado}&rdquo;</> : null}. Si cambia de decisión y se los
        lleva, regístralo con la venta.
      </p>
    );
  }

  if (!abierto) {
    return (
      <Button type="button" variant="outline" onClick={() => setAbierto(true)} className="self-start">
        El paciente no los adquiere por ahora
      </Button>
    );
  }

  return (
    <form
      onSubmit={enviarSinReset(action)}
      className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
    >
      <input type="hidden" name="evaluationId" value={evaluationId} />
      <input type="hidden" name="decision" value="no" />
      {/* "otra" con el motivo escrito. Las cinco razones cerradas que habia (costo, lo piensa, ya toma otros...)
          se retiraron por decision de Santiago: era un formulario en cada consulta para un dato agregado que
          nadie consultaba. Lo que queda es el motivo en palabras de quien atendio. */}
      <input type="hidden" name="reason" value="otra" />
      <div className="flex flex-col gap-1">
        <Label htmlFor="motivo-no-adquiere" className="text-xs">
          Por qué no los adquiere por ahora
        </Label>
        <Input
          id="motivo-no-adquiere"
          name="note"
          maxLength={1000}
          placeholder="Por ejemplo: lo va a pensar, o los va a comprar el mes entrante"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Registrar"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAbierto(false)} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
