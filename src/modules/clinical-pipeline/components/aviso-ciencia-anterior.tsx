import { History } from "lucide-react";

import { nombreDimension, type VigenciaEmision } from "../emision-vigencia";

// AVISO: este documento se emitió con una versión anterior del modelo.
//
// CUIDADO CENTRAL DEL COMPONENTE, y por eso está escrito así: **marcar no invalida**. Un diagnóstico
// emitido con ciencia anterior se emitió CORRECTAMENTE con lo que regía entonces, y sigue siendo
// válido hasta que alguien decida reemitirlo. Por eso el aviso:
//
//   - NO usa la capa clínica de alerta (nada de `clinical-critical` ni `clinical-warning`): esos
//     colores significan riesgo del PACIENTE, y aquí no hay riesgo del paciente, hay una nota de
//     procedencia del documento. Usar el rojo diría que el diagnóstico está mal, que es falso.
//   - Va en tono neutro (`muted`), con icono de historia, no de advertencia.
//   - Dice explícitamente que sigue vigente, para que el profesional no lo lea como "no te fíes".
//   - No bloquea ni deshabilita nada.
//
// Es el mismo criterio que aplicamos al azul del radar y al semáforo de la capacitancia: el color
// afirma, así que un color que afirma de más es un defecto, no una decoración.

export function AvisoCienciaAnterior({ vigencia }: { vigencia: VigenciaEmision }) {
  if (vigencia.alDia) return null;

  const dims = vigencia.desfasadas.map((d) => nombreDimension(d.clave));
  const lista =
    dims.length === 1
      ? dims[0]
      : `${dims.slice(0, -1).join(", ")} y ${dims[dims.length - 1]}`;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
      <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          Emitido con una versión anterior del modelo
        </p>
        <p className="text-xs text-muted-foreground">
          Desde que se emitió cambió {lista}. <strong className="font-medium">El diagnóstico sigue
          siendo válido</strong>: se emitió con lo que regía en su momento y no se reescribe. Esta nota
          existe para que sepas con qué se calculó, no para que desconfíes de él.
        </p>
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {vigencia.desfasadas.map((d) => (
            <li key={d.clave} className="text-xs text-muted-foreground">
              <span className="font-medium">{nombreDimension(d.clave)}:</span> se emitió con{" "}
              <code className="rounded bg-muted px-1">{d.selladoCon}</code>, hoy rige{" "}
              <code className="rounded bg-muted px-1">{d.vigenteHoy}</code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
