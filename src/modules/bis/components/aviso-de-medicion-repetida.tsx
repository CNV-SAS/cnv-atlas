import { TriangleAlert } from "lucide-react";

import type { HuellaRepetida } from "../huella-repetida";
import { avisoDeHuellaRepetida } from "../huella-repetida";

// ═══ ESTA MEDICION ESTA EN OTRA CONSULTA (Gildardo, 2026-10-26) ═══
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────────
//
// *"Hoy Angela solo se entera si alguien le dice. Atlas ya sabe cuales son por la huella. Construye un
// aviso en cada una de esas consultas y en su lista de pendientes."*
//
// Hasta hoy el sistema SABIA que 23 consultas compartian su toma con otra y no se lo decia a nadie: el
// hallazgo vivia en un barrido que alguien tenia que correr. Un dato que el sistema tiene y no muestra es,
// en la practica, un dato que no tiene.
//
// ── LO QUE NO DICE, Y ES LA MITAD DEL DISEÑO ────────────────────────────────────────────────────────
//
// No dice de quien es la otra consulta. Quien esta mirando puede no tener acceso a esa historia clinica, y
// darle el nombre seria filtrar el dato de un tercero para avisarle de un error. Es la misma linea que ya
// traza el freno del import: lo que hace falta saber es que esa toma esta en otra parte, y eso si se dice.
//
// ── POR QUE "ATENCION" Y NO LA CAPA CLINICA ─────────────────────────────────────────────────────────
//
// `clinical-critical` significa riesgo DEL PACIENTE. Esto es un problema del DATO: puede que el paciente
// este perfectamente y que su historia tenga el cuerpo de otra persona. Pintarlo de rojo clinico diria
// algo falso sobre quien esta en la silla.
//
// ── Y NO LLEVA BOTON ────────────────────────────────────────────────────────────────────────────────
//
// La salida es la correccion "La medicion no es de este paciente", que va justo debajo en esta misma
// pestaña. Repetir aqui el boton seria ofrecer dos veces el mismo acto irreversible, y el que se pulsa
// desde un aviso se pulsa sin haber leido lo que hace.
export function AvisoDeMedicionRepetida({ repetida }: { repetida: HuellaRepetida | null }) {
  if (!repetida) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-attention bg-attention-bg p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">{avisoDeHuellaRepetida(repetida)}</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          Las cuatro lecturas eléctricas del equipo son idénticas hasta el último decimal, así que es la
          misma toma física y no dos mediciones parecidas. Si esta no es la del paciente, abajo está
          &ldquo;La medición no es de este paciente&rdquo;. Este aviso desaparece solo cuando la toma deje
          de estar en dos consultas.
        </p>
      </div>
    </div>
  );
}
