"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type TratamientoParaElegir = {
  treatmentId: string;
  fecha: string;
  diasDesde: number;
  esBorrador: boolean;
  prescritos: string | null;
};

/** Desde cuántos días un tratamiento es lo bastante viejo como para avisar. Medio año. */
const DIAS_PARA_AVISAR = 180;

/**
 * LO QUE SE RESPONDIO EN ESTE BLOQUE. Vive ARRIBA, en la tarjeta de cobro, no aquí: ver la cabecera.
 *
 * `suelta` y `treatmentId` son excluyentes, y quien lo garantiza es este componente al emitir el cambio
 * (marcar la casilla vacía el id, y elegir una consulta desmarca la casilla). Aquí no se guarda nada.
 */
export type ConsultaDeLaCompra = {
  treatmentId: string;
  suelta: boolean;
  motivo: string;
};

/** Está respondido si hay una consulta elegida, o si va suelta CON su motivo escrito. */
export function consultaRespondida(c: ConsultaDeLaCompra): boolean {
  return c.suelta ? c.motivo.trim().length > 0 : c.treatmentId !== "";
}

// ═══ A QUÉ TRATAMIENTO SE ATA ESTA COMPRA (2026-09-29) ═══
//
// EL PROBLEMA QUE CIERRA, de Santiago: una venta de /pagos no sabe de qué tratamiento salió, y /pagos existe
// justamente para el paciente que vuelve solo a comprar. Esa es la compra que más dice sobre si el producto le
// sirvió, y era la única que nacía sin nada.
//
// ── POR QUÉ NO HAY NINGUNO PRESELECCIONADO ──
//
// El caso que hay que evitar NO es que la venta quede suelta: es que el profesional elija cualquiera para
// poder cobrar. Un desplegable con el último ya puesto produce exactamente eso, y un dato malo se ve igual que
// uno bueno. Así que aquí no se elige por nadie, cada opción muestra SU FECHA, y hay una salida explícita.
//
// ── Y LA SALIDA EXPLÍCITA NO ES UNA PUERTA TRASERA ──
//
// "No sale de ninguna consulta" pide un motivo. Una compra sin tratamiento es un hecho legítimo (el paciente
// que compra sin haber pasado por consulta), y negarlo obligaría a inventar un vínculo. Lo que no puede pasar
// es que quede suelta SIN QUE NADIE LO DIGA, que es lo que pasaba hasta hoy.
//
// ═══ UNO SOLO, SIEMPRE PUESTO, Y SIN RE-MONTARSE AL CAMBIAR DE PACIENTE (Santiago, 2026-10-10) ═══
//
// ── EL DEFECTO QUE REPORTÓ TRES VECES ───────────────────────────────────────────────────────────────
//
// Textual suyo: *"Selecciono un paciente, le doy cambiar y selecciono otro paciente. Y aparecen 2 minibloques
// de consulta."* Dos intentos anteriores fallaron porque los dos atacaron un SÍNTOMA (primero el paciente que
// venía por defecto, después las dos tarjetas visibles a la vez). Las dos cosas eran ciertas y ninguna lo
// cerró.
//
// ── ASÍ QUE SE HACE LO QUE ÉL PROPUSO, QUE QUITA EL SITIO DONDE PUEDE PASAR ─────────────────────────
//
// *"que siempre aparezca activo ese minibloque... con una condición, que no se renderice cada vez que alguien
// selecciona un paciente."* Dos cambios estructurales, y los dos importan:
//
//   1. ESTE COMPONENTE YA NO TIENE ESTADO. Lo que se respondió vive en la tarjeta (`ConsultaDeLaCompra`), que
//      no se desmonta nunca. Por eso desapareció la `key={patientId}` del padre, que era lo que lo re-montaba.
//   2. Y SE MONTA SIEMPRE, con paciente o sin él. Antes colgaba de un `{patientId ? ... : null}`: aparecía y
//      desaparecía. Hoy está, y sin paciente el desplegable dice que elijas la consulta y no ofrece ninguna.
//
// LO QUE LA `key` PROTEGÍA SIGUE PROTEGIDO, EN OTRO SITIO. Re-montar servía para que la consulta elegida para
// un paciente no quedara seleccionada para el siguiente, que es como se le cuelga una compra a la consulta de
// otra persona. Eso ahora lo hace la tarjeta: al cambiar de paciente VACÍA la respuesta, y hay un candado que
// verifica que nadie mueva el paciente sin pasar por esa función.
//
// ── Y LOS CAMPOS YA NO LLEVAN `name` ───────────────────────────────────────────────────────────────
//
// Este bloque vive FUERA del formulario (está en la tarjeta, encima de él), y un campo fuera del formulario NO
// VIAJA en su envío. Así que los controles son controlados y sin `name`, y lo que viaja son dos campos ocultos
// dentro de cada formulario. Es el mismo arreglo del hazard 7 de CLAUDE.md (el formulario anidado) y por el
// mismo motivo: los campos pertenecen al envío de afuera.
//
// CON UNA CONSECUENCIA QUE HAY QUE DECIR: el `required` del navegador ya no aplica aquí (solo valida campos de
// un formulario). Lo sustituye el BOTÓN, que no deja enviar hasta que esto esté respondido, y eso es más
// estricto y se ve antes: el navegador avisaba al pulsar, el botón lo dice desde el principio. Dejar aquí un
// `required` inerte sería una bandera que nadie lee, que es peor que no tenerla.
export function BloqueTratamiento({
  tratamientos,
  valor,
  onCambiar,
  hayPaciente,
  /** Solo para los ids de accesibilidad: el bloque es uno y no se re-monta. */
  id = "consulta-de-la-compra",
}: {
  tratamientos: TratamientoParaElegir[];
  valor: ConsultaDeLaCompra;
  onCambiar: (cambio: Partial<ConsultaDeLaCompra>) => void;
  hayPaciente: boolean;
  id?: string;
}) {
  const t = tratamientos.find((x) => x.treatmentId === valor.treatmentId);
  const sinConsultas = hayPaciente && tratamientos.length === 0;

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>De qué consulta sale esta compra</Label>
        <select
          id={id}
          value={valor.suelta ? "" : valor.treatmentId}
          onChange={(e) => onCambiar({ treatmentId: e.target.value, suelta: false, motivo: "" })}
          // SIN PACIENTE, O SIN CONSULTAS, NO HAY NADA QUE ELEGIR, y el desplegable lo dice estando apagado.
          // Aquí `disabled` SÍ es correcto, y antes no lo era: este campo ya no viaja en el FormData, así que
          // apagarlo no le quita ningún dato al servidor (hazard 4 de CLAUDE.md, visto por el otro lado).
          disabled={!hayPaciente || sinConsultas}
          className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
        >
          {/* EN TUTEO, que es la norma de la interfaz (CLAUDE.md). Santiago lo escribió como "Elija la
              consulta"; el texto es el suyo, el tratamiento es el de toda la app. */}
          <option value="">Elige la consulta</option>
          {tratamientos.map((x) => (
            <option key={x.treatmentId} value={x.treatmentId}>
              {x.fecha}
              {x.esBorrador ? " · consulta en curso" : ""}
              {x.prescritos ? ` · ${x.prescritos}` : " · sin nutracéuticos prescritos"}
            </option>
          ))}
        </select>
        {!hayPaciente ? (
          <span className="text-xs text-muted-foreground">
            Elige primero el paciente y aquí aparecerán sus consultas.
          </span>
        ) : sinConsultas ? (
          // NO ES UN ERROR, Y SE DICE: alguien puede comprar sin haber pasado por consulta. Lo único que hay
          // que hacer es marcar la casilla y decir por qué.
          <span className="text-xs text-muted-foreground">
            Este paciente no tiene ninguna consulta registrada. Marca la casilla y di por qué compra sin
            consulta.
          </span>
        ) : null}
      </div>

      {/* LA SALIDA VA APARTE DEL DESPLEGABLE, no como una opción más: mezclarlas invita a elegirla por
          descarte, y lo que se busca es que sea una decisión. */}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={valor.suelta}
          onChange={(e) => onCambiar({ suelta: e.target.checked, treatmentId: "", motivo: "" })}
          className="size-4"
        />
        No sale de ninguna consulta
      </label>

      {valor.suelta ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-motivo`}>Por qué</Label>
          <Input
            id={`${id}-motivo`}
            value={valor.motivo}
            onChange={(e) => onCambiar({ motivo: e.target.value })}
            maxLength={200}
            placeholder="Ej. compra de mostrador, o le repone a un familiar"
            className="max-w-md"
          />
        </div>
      ) : null}

      {/* LA EDAD SE AVISA, no se bloquea. Atar la compra de hoy a una consulta de hace ocho meses puede ser
          correcto (el paciente sigue el mismo plan) o puede ser una mentira. Lo decide quien atendió, y para
          decidirlo necesita ver la fecha, que es lo que faltaba. */}
      {t && t.diasDesde >= DIAS_PARA_AVISAR ? (
        <p className="text-xs text-attention">
          Esa consulta es del {t.fecha}, hace {Math.round(t.diasDesde / 30)} meses. Si esta compra ya no sigue
          ese plan, mejor déjala sin consulta y dilo.
        </p>
      ) : null}
    </div>
  );
}
