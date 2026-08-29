import { History, RefreshCw } from "lucide-react";

import { nombreDimension, type VigenciaEmision } from "../emision-vigencia";
import type { VeredictoReemision } from "../reemision";

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

export function AvisoCienciaAnterior({
  vigencia,
  veredicto,
}: {
  vigencia: VigenciaEmision;
  // Ausente = no se pudo comparar el RESULTADO (evaluacion sin insumos para recomputar). Entonces el
  // aviso se queda como estaba: informa del desfase y no afirma nada sobre bandas.
  veredicto?: VeredictoReemision;
}) {
  if (vigencia.alDia) return null;

  // REEMISION OBLIGATORIA (§12b): "cuando el cambio es de calibracion poblacional y el paciente CAMBIA DE
  // BANDA... El criterio es el RESULTADO, no el tipo de cambio".
  //
  // ESTE SI CAMBIA DE REGISTRO VISUAL, y es la excepcion a la regla del componente. El aviso normal es
  // neutro a proposito porque marcar no invalida; pero aqui no estamos marcando: estamos diciendo que la
  // clasificacion del paciente CAMBIO, y que hay una accion obligatoria pendiente. Un aviso gris para una
  // obligacion se lee como opcional. Aun asi NO se usa la capa clinica (`clinical-critical`): el riesgo
  // no es del paciente, es del documento. Va con `attention`, que es el eje OPERATIVO.
  if (veredicto?.kind === "reemision-obligatoria") {
    return (
      <div className="flex items-start gap-2 rounded-lg border-2 border-attention bg-attention-bg p-3">
        <RefreshCw className="mt-0.5 size-4 shrink-0 text-attention" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-attention">
            Reemisión obligatoria: la clasificación de este paciente cambió
          </p>
          <p className="text-xs text-foreground">
            Con la versión del modelo que rige hoy, este paciente ya no queda en la misma banda. El
            documento emitido sigue siendo válido para la fecha en que se emitió, pero debe reemitirse.
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {veredicto.cambios.map((c) => (
              <li key={c.que} className="text-xs text-foreground">
                <span className="font-medium">{c.que}:</span> {c.antes} → {c.ahora}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

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
        {veredicto?.kind === "solo-marcar" ? (
          // Su §12b: "si el numero se mueve pero la clasificacion no, SE MARCA EN LA HISTORIA y no se
          // reemite". Decirlo explicito evita que el profesional reemita por las dudas, que es el efecto
          // que tiene un aviso que no cierra la pregunta que abre.
          <p className="text-xs text-muted-foreground">
            La clasificación de este paciente <strong className="font-medium">no cambia</strong> con la
            versión de hoy: queda registrado en la historia y no hace falta reemitir.
          </p>
        ) : null}
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
