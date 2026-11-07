import Link from "next/link";
import { History, RefreshCw } from "lucide-react";

import { etiquetaDeEtapa } from "@/modules/diagnoses/etapas";

import { nombreDimension, type VigenciaEmision } from "../emision-vigencia";
import type { MotivoDeNoReemitir } from "../motivo-para-no-reemitir";
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

//
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y EL AMBAR QUE PEDIA UNA ACCION QUE NO EXISTE  ·  2026-11-07
//
// Este aviso tenia DOS registros: gris ("quedó marcado, no hace falta reemitir") y ámbar ("reemisión
// obligatoria", con la acción pendiente). Faltaba el tercero, y se vio al terminar el recalculo: de los 53
// ámbar que quedaron, 4 son de pacientes que al medirse NO estaban en el rango donde la EB-BIS v7 se
// calibró (18 a 100 años). Esas consultas no se van a poder reemitir nunca, porque fuera de ese rango la
// v7 devuelve "pendiente" y el dominio 3 saldría en blanco. La pantalla de recalibración no las ofrece, así
// que su ámbar era PERMANENTE: le pedía a la profesional una acción que el sistema no le deja hacer.
//
// Un freno sin salida no es un guard: detiene a una persona. Así que cuando hay un motivo, el aviso dice
// cuál es, y el registro lo decide la clase del motivo y no el veredicto:
//
//   · `fuera-de-calibracion`  →  nota FIJA y NEUTRA, sin pedir nada. No es un problema por resolver: es
//     una condición del paciente. (Santiago fijó el texto: *"Fuera del rango de calibración de la EB-BIS
//     (18 a 100 años): no se recalcula"*.)
//   · `huella-repetida`       →  se queda en ámbar, PORQUE SÍ TIENE SALIDA, y la nombra: decidir de quién
//     es la toma, con el enlace a la pestaña donde se hace.
//   · `sin-fecha`             →  ámbar también, y su salida es registrar la fecha de nacimiento.
//
// EL ENLACE SE DERIVA del mapa de etapas (`etiquetaDeEtapa`) y no se escribe a mano, por la razón por la
// que ese módulo existe: un aviso que nombra una pestaña sobrevive a que la pestaña se renombre.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function AvisoCienciaAnterior({
  vigencia,
  veredicto,
  motivoDeNoRecalcular,
}: {
  vigencia: VigenciaEmision;
  // Ausente = no se pudo comparar el RESULTADO (evaluacion sin insumos para recomputar). Entonces el
  // aviso se queda como estaba: informa del desfase y no afirma nada sobre bandas.
  veredicto?: VeredictoReemision;
  /**
   * Por que esta consulta NO entra al recalculo, si es que no entra. Ausente o null = entra, y entonces
   * el ambar de reemision obligatoria pide algo que de verdad se puede hacer.
   */
  motivoDeNoRecalcular?: MotivoDeNoReemitir | null;
}) {
  if (vigencia.alDia) return null;

  // LA PROCEDENCIA, en UNA sola pieza que usan los dos registros. Antes vivia solo en la rama gris, asi
  // que cuando saltaba el ambar el profesional perdia con que version se emitio: justo en el caso donde
  // SI cambio algo, que es lo contrario de lo que este aviso existe para hacer (Santiago, 2026-09-05, al
  // cerrar el smoke del LE8). Se extrae en vez de copiarse porque dos listas de lo mismo divergen.
  const procedencia = (tenue: boolean) => (
    <ul className="mt-0.5 flex flex-col gap-0.5">
      {vigencia.desfasadas.map((d) => (
        <li key={d.clave} className={tenue ? "text-xs text-muted-foreground" : "text-xs text-foreground"}>
          <span className="font-medium">{nombreDimension(d.clave)}:</span> se emitió con{" "}
          <code className="rounded bg-muted px-1">{d.selladoCon}</code>, hoy rige{" "}
          <code className="rounded bg-muted px-1">{d.vigenteHoy}</code>
        </li>
      ))}
    </ul>
  );

  // LA SALIDA DE CADA MOTIVO QUE SI TIENE UNA, en una sola pieza: el ambar la nombra y el gris no la
  // necesita. Se escribe aqui y no en dos ramas para que no puedan divergir.
  const salida =
    motivoDeNoRecalcular?.clase === "huella-repetida" ? (
      <>
        Decide cuál es la que vale en{" "}
        <Link href="?etapa=antro" className="font-medium underline">
          {etiquetaDeEtapa("antro")}
        </Link>
        , en el bloque de reemplazar la medición, y después el recálculo la ofrece sola.
      </>
    ) : motivoDeNoRecalcular?.clase === "sin-fecha" ? (
      <>Regístrala en la ficha del paciente y después se reemite por el flujo normal.</>
    ) : null;

  // ═══ FUERA DEL RANGO DE CALIBRACION: NOTA FIJA, NEUTRA Y SIN PEDIR NADA ═══
  //
  // VA ANTES QUE EL AMBAR a proposito: aunque la clasificacion haya cambiado (veredicto de reemision
  // obligatoria), esta consulta no se puede reemitir, asi que pedirlo seria pedir lo imposible. Y se dice
  // en registro NEUTRO porque no hay nada mal: el paciente esta fuera del rango donde el instrumento se
  // calibro, y eso no es un hallazgo clinico ni una tarea.
  if (motivoDeNoRecalcular?.clase === "fuera-de-calibracion") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">
            Fuera del rango de calibración de la EB-BIS (18 a 100 años): no se recalcula
          </p>
          <p className="text-xs text-muted-foreground">
            Al medirse tenía {motivoDeNoRecalcular.edad} años, y la edad biológica estimada se calibró
            entre los 18 y los 100. El diagnóstico se emitió con lo que regía en su momento y sigue siendo
            válido. No hay nada que hacer con esta nota.
          </p>
          {procedencia(true)}
        </div>
      </div>
    );
  }

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
          {/* ═══ Y LA SALIDA, CUANDO HAY UN MOTIVO QUE LO FRENA  ·  2026-11-07 ═══

              El ámbar dice "debe reemitirse", y de los 53 que quedaron tras el recálculo, 19 son de una
              medición repetida: la pantalla de recalibración no las ofrece hasta que se decida de quién es
              la toma. Sin este bloque, el aviso pedía reemitir y la acción no aparecía en ninguna parte.

              SÍ TIENEN SALIDA, y es lo que lo diferencia del caso de la edad: aquí hay algo que hacer y
              esto lo nombra, con el enlace a la pestaña donde se hace. El rótulo de la pestaña se deriva
              del mapa de etapas, no se escribe a mano. */}
          {salida ? (
            <p className="text-xs text-foreground">
              <span className="font-medium">Antes de reemitir:</span> {motivoDeNoRecalcular?.texto}{" "}
              {salida}
            </p>
          ) : null}
          {/* Y CON QUE SE EMITIO, que es lo que faltaba: sin esto el profesional ve que la banda cambio
              y no puede decir respecto a que version. */}
          {procedencia(false)}
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
        {procedencia(true)}
      </div>
    </div>
  );
}
