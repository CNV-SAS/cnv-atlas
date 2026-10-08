"use client";

import { useActionState, useState } from "react";

import { enviarSinReset } from "@/components/shared/enviar-sin-reset";
import { useFormToastAndRefresh } from "@/components/shared/use-form-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { registrarRetractoFormAction, type DevolucionState } from "../actions";

const initial: DevolucionState = { error: null, success: null, warning: null };
const pesos = (n: number) => `$${n.toLocaleString("es-CO")}`;

export type RetractoDeLaVenta = {
  transactionId: string;
  aplica: boolean;
  motivo: string | null;
  limite: string | null;
  diasHabilesRestantes: number | null;
  vencido: boolean;
  reintegro: number;
  ejercidoEl: string | null;
  selloIntacto: boolean | null;
};

// ═══ EL DERECHO DE RETRACTO DE UNA VENTA A DISTANCIA (0190) ═══
//
// SE VE AUNQUE NO SE VAYA A USAR, y ese es el punto: un derecho que el sistema no nombra es un derecho que
// nadie ejerce. Sale la fecha limite, lo que habria que reintegrar y la condicion del sello, que es la que
// decide.
//
// EL ENVIO YA NO SE NOMBRA AQUI (2026-10-06): decia ", incluido el envio de X" cuando la venta traia flete.
// CNV no cobra el envio, asi que no lo reintegra, y el asesor legal ratifico que la posicion es defendible
// porque lo presta y lo cobra un tercero.
//
// LOS DOS BOTONES LLEVAN `key` DISTINTA (hazard 1 de CLAUDE.md): comparten formulario, y su valor viaja en el
// `name` del boton, que `enviarSinReset` si manda porque pasa el submitter.
// ═══ EL PROFESIONAL LO VE, PERO NO LO EJECUTA (Santiago, smoke del 2026-10-08) ═══
//
// SU PREGUNTA: *"¿esto no debería aparecer solo a admin?"*. La respuesta es que no, y la razón es él mismo:
// **el paciente le va a preguntar a su profesional**, no a CNV. Un derecho que quien atiende no conoce es un
// derecho que nadie ejerce, y la fecha límite y la condición del sello son justo lo que tiene que poder decirle.
//
// PERO EJECUTARLO ES OTRA COSA: mueve dinero de CNV, así que lo decide CNV (`canViewRevenue`).
//
// ── Y LO QUE ESTABA MAL NO ERA EL GUARD, ERA SU EXPOSICIÓN ───────────────────────────────────────
//
// El guard ya estaba, y bien: `registrarRetractoFormAction` devuelve "sin permiso" a quien no sea admin o
// dirección, así que **no había ningún hueco de dinero**. Lo que pasaba es que la pantalla le ofrecía al
// profesional un botón que iba a rebotar, y un guard correcto mal expuesto se siente exactamente igual que un
// defecto: pulsas, no pasa nada que entiendas, y dejas de confiar en la pantalla.
export function BloqueRetracto({
  retracto,
  puedeRegistrar = false,
}: {
  retracto: RetractoDeLaVenta;
  /** Quien puede REGISTRARLO (admin y dirección). El resto lo ve para poder explicárselo al paciente. */
  puedeRegistrar?: boolean;
}) {
  const [state, action, pending] = useActionState(registrarRetractoFormAction, initial);
  useFormToastAndRefresh(state);
  const [abierto, setAbierto] = useState(false);

  if (!retracto.aplica) return null;

  if (retracto.ejercidoEl) {
    return (
      <p className="text-xs text-muted-foreground">
        Retracto registrado el {retracto.ejercidoEl} ·{" "}
        {retracto.selloIntacto ? "producto sellado: procedió" : "sello roto: no procedió"}
      </p>
    );
  }

  if (retracto.limite == null) {
    return (
      <p className="text-xs text-muted-foreground">
        Venta a distancia: el plazo de retracto (5 días hábiles) empieza cuando se entregue.
      </p>
    );
  }

  if (retracto.vencido) {
    return (
      <p className="text-xs text-muted-foreground">El plazo de retracto venció el {retracto.limite}.</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">
        Puede retractarse hasta el <strong className="text-foreground">{retracto.limite}</strong>
        {retracto.diasHabilesRestantes != null
          ? ` (${retracto.diasHabilesRestantes} ${retracto.diasHabilesRestantes === 1 ? "día hábil" : "días hábiles"})`
          : ""}
        . Si el producto vuelve sellado, se le reintegran{" "}
        <strong className="text-foreground">{pesos(retracto.reintegro)}</strong>.
      </span>

      {abierto ? (
        <form onSubmit={enviarSinReset(action)} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="transactionId" value={retracto.transactionId} />
          <Input name="nota" placeholder="Nota (opcional)" className="h-8 w-56 text-xs" />
          <Button key="sellado" type="submit" name="selloIntacto" value="true" size="sm" variant="outline" disabled={pending}>
            Volvió sellado
          </Button>
          <Button key="abierto" type="submit" name="selloIntacto" value="false" size="sm" variant="outline" disabled={pending}>
            Volvió abierto
          </Button>
        </form>
      ) : puedeRegistrar ? (
        <button type="button" onClick={() => setAbierto(true)} className="self-start underline">
          El paciente se retracta
        </button>
      ) : (
        /* ── QUIEN NO LO REGISTRA SABE A QUIEN DECIRLE, que es lo que el profesional necesita: con el paciente
              al teléfono, "no puedes" lo deja sin nada que responder. Esto le dice qué hacer. */
        <span className="text-xs text-muted-foreground">
          Si el paciente se retracta, avísale a CNV: el reintegro lo registra quien maneja el dinero, con la
          evidencia del sello.
        </span>
      )}
    </div>
  );
}
