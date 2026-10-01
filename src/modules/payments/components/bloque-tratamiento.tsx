"use client";

import { useState } from "react";

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
// "Queda suelta" pide un motivo. Una compra sin tratamiento es un hecho legítimo (el paciente que compra sin
// haber pasado por consulta), y negarlo obligaría a inventar un vínculo. Lo que no puede pasar es que quede
// suelta SIN QUE NADIE LO DIGA, que es lo que pasaba hasta hoy.
export function BloqueTratamiento({
  tratamientos,
  patientId,
}: {
  tratamientos: TratamientoParaElegir[];
  patientId: string;
}) {
  const [elegido, setElegido] = useState("");
  const suelta = elegido === "__suelta__";
  const t = tratamientos.find((x) => x.treatmentId === elegido);

  // Se re-arma al cambiar de paciente: `key` en el padre. Si no hubiera tratamientos, solo cabe la salida.
  if (tratamientos.length === 0) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-lg border border-border p-3">
        <input type="hidden" name="treatmentId" value="" />
        <span className="text-sm text-foreground">Este paciente no tiene ninguna consulta registrada.</span>
        <p className="text-xs text-muted-foreground">
          La compra queda sin tratamiento, y eso está bien: alguien puede comprar sin haber pasado por
          consulta. Se registra así, dicho.
        </p>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`suelta-${patientId}`}>Por qué compra sin consulta</Label>
          <Input
            id={`suelta-${patientId}`}
            name="ventaSueltaMotivo"
            required
            maxLength={200}
            placeholder="Ej. compra de mostrador, o le repone a un familiar"
            className="max-w-md"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`tratamiento-${patientId}`}>De qué consulta sale esta compra</Label>
        <select
          id={`tratamiento-${patientId}`}
          name="treatmentId"
          // ═══ OBLIGATORIO SOLO SI NO SE ELIGIÓ LA SALIDA (Santiago, 2026-09-30) ═══
          //
          // CON `required` A SECAS, LA SALIDA NO SE PODÍA USAR. Al marcar "No sale de ninguna consulta" el
          // desplegable vuelve a vacío, y un `select required` vacío lo bloquea el NAVEGADOR: "Selecciona un
          // elemento de la lista". Así que la única forma de enviar era elegir una consulta, que es
          // exactamente lo que la salida venía a evitar, y el profesional acababa atando la compra a la
          // última consulta para poder cobrar. El dato malo se ve igual que el bueno.
          //
          // ES DE LA FAMILIA QUE SOLO SE VE EN UN NAVEGADOR (hazard 6 de CLAUDE.md): tsc, lint y los tests
          // pasan, porque la validación la hace el navegador y no el código.
          required={!suelta}
          // Y NO SE PONE `disabled` CUANDO SOBRA: un campo deshabilitado no viaja en el FormData (hazard 4),
          // y aquí el servidor tiene que recibir el campo vacío para saber que la compra va suelta.
          aria-disabled={suelta}
          value={elegido === "__suelta__" ? "" : elegido}
          onChange={(e) => setElegido(e.target.value)}
          className="flex h-9 w-full max-w-xl rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <option value="">Elige la consulta</option>
          {tratamientos.map((x) => (
            <option key={x.treatmentId} value={x.treatmentId}>
              {x.fecha}
              {x.esBorrador ? " · consulta en curso" : ""}
              {x.prescritos ? ` · ${x.prescritos}` : " · sin nutracéuticos prescritos"}
            </option>
          ))}
        </select>
      </div>

      {/* LA SALIDA VA APARTE DEL DESPLEGABLE, no como una opción más: mezclarlas invita a elegirla por
          descarte, y lo que se busca es que sea una decisión. */}
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={suelta}
          onChange={(e) => setElegido(e.target.checked ? "__suelta__" : "")}
          className="size-4"
        />
        No sale de ninguna consulta
      </label>

      {suelta ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`motivo-${patientId}`}>Por qué</Label>
          <Input
            id={`motivo-${patientId}`}
            name="ventaSueltaMotivo"
            required
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
