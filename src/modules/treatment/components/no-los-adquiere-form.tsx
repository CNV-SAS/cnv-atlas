"use client";

import { useActionState, useState } from "react";

import { ejecutarAccion } from "@/components/shared/enviar-sin-reset";
import { useFormToastRefreshOnSuccess } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format/date";

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
// ═══ POR QUE ESTO NO ES UN <form>, Y ES UN ARREGLO (bloqueo de Santiago, 2026-10-02) ═══
//
// LO QUE PASABA: este componente se monta DENTRO del formulario de la prescripcion (`nutraceuticals-section`),
// y antes abria su propio `<form>`. Un `<form>` dentro de otro es HTML INVALIDO: el navegador DESCARTA la
// etiqueta interna al construir el DOM, asi que sus campos y su boton pasan a ser del formulario de AFUERA.
//
// El resultado, con sus dos sintomas, que es como lo reporto Santiago:
//   · pulsar "Registrar" ejecutaba la accion de GUARDAR LA PRESCRIPCION, no esta: no se registraba nada;
//   · y esa otra accion recargaba la seccion, con lo que la pantalla saltaba a la pestaña de Diagnostico.
//
// Y NO LO VE NADIE: tsc compila, el lint calla, y jsdom no reproduce el parseo del navegador. Es la misma
// familia de los hazards de formulario de CLAUDE.md, y por eso entra alli como el septimo.
//
// EL ARREGLO ES NO ANIDAR: sin `<form>` propio, los campos se arman a mano y la accion se invoca por el camino
// que el proyecto ya tiene para esto (`ejecutarAccion`, el mismo de los cinco botones sin formulario). Los
// campos NO llevan `name`, a proposito: con `name` seguirian viajando en el formulario de afuera, que es la
// mitad del defecto que no se ve.
export function NoLosAdquiereForm({
  evaluationId,
  yaRegistrado,
  registradoEn,
  ventaPosteriorEn,
}: {
  evaluationId: string;
  /** El motivo escrito si ya se registro el "no"; null si no se ha registrado. */
  yaRegistrado: string | null;
  /** Cuando se registro, para poder decir cual de los dos hechos es el ultimo. */
  registradoEn?: string | null;
  /** La venta pagada MAS RECIENTE posterior al "no", si la hay. */
  ventaPosteriorEn?: string | null;
}) {
  const [state, action, pending] = useActionState(saveNutraDecisionAction, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  useFormToastRefreshOnSuccess(state);

  // YA REGISTRADO: se dice y no se vuelve a ofrecer el boton. Ofrecerlo otra vez invita a escribir dos motivos
  // para lo mismo y deja el segundo pisando al primero sin que nadie lo note.
  if (yaRegistrado != null) {
    return (
      <div className="flex flex-col gap-1">
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          Quedó registrado{registradoEn ? ` el ${formatDate(registradoEn)}` : ""} que el paciente no los adquiere
          por ahora
          {yaRegistrado.trim() !== "" ? <>: &ldquo;{yaRegistrado}&rdquo;</> : null}. Si cambia de decisión y se
          los lleva, regístralo con la venta.
        </p>
        {/* ═══ LOS DOS HECHOS CONVIVEN, Y LA PANTALLA DICE CUAL ES EL ULTIMO (Santiago, 2026-10-02) ═══

            Registrar "no los adquiere" y despues venderle NO es una contradiccion que haya que resolver
            borrando una de las dos: son DOS HECHOS EN DOS MOMENTOS, y los dos son verdad. El "no" fue la
            decision de esa consulta y la compra ocurrio despues.

            Borrar la nota al vender perderia el dato que la nota existe para capturar (que el modelo recomendo
            algo y en ese momento no se lo llevo). Dejarla sola haria que la pantalla contradijera a la venta.
            Asi que se quedan las dos y se dice CUAL ES LA MAS NUEVA, que es lo unico que faltaba. */}
        {ventaPosteriorEn ? (
          <p className="px-3 text-xs text-attention">
            Después, el {formatDate(ventaPosteriorEn)}, sí compró. Lo último que pasó es la compra; la nota de
            arriba fue la decisión de ese momento y se conserva.
          </p>
        ) : null}
      </div>
    );
  }

  if (!abierto) {
    return (
      <Button type="button" variant="outline" onClick={() => setAbierto(true)} className="self-start">
        El paciente no los adquiere por ahora
      </Button>
    );
  }

  const registrar = () => {
    // Los campos se arman aqui porque este bloque NO tiene formulario propio (ver la cabecera). Son los
    // mismos cuatro que el schema espera.
    const fd = new FormData();
    fd.set("evaluationId", evaluationId);
    fd.set("decision", "no");
    // "otra" con el motivo escrito. Las cinco razones cerradas que habia (costo, lo piensa, ya toma otros...)
    // se retiraron por decision de Santiago: era un formulario en cada consulta para un dato agregado que
    // nadie consultaba. Lo que queda es el motivo en palabras de quien atendio.
    fd.set("reason", "otra");
    fd.set("note", motivo);
    ejecutarAccion(action, fd);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="motivo-no-adquiere" className="text-xs">
          Por qué no los adquiere por ahora
        </Label>
        {/* SIN `name`, a proposito: este bloque vive dentro del formulario de la prescripcion, y un campo con
            nombre viajaria en ESE envio. Controlado, que ademas es lo que pide el hazard 2 de CLAUDE.md. */}
        <Input
          id="motivo-no-adquiere"
          maxLength={1000}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Por ejemplo: lo va a pensar, o los va a comprar el mes entrante"
          autoFocus
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {/* type="button" EN LOS DOS: dentro del formulario de afuera, un submit enviaria la prescripcion. */}
        <Button key="registrar-no" type="button" disabled={pending} onClick={registrar}>
          {pending ? "Registrando..." : "Registrar"}
        </Button>
        <Button
          key="cancelar-no"
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
