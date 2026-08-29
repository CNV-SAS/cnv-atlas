import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// BLOQUE: como se ve una seccion de una pantalla clinica, en TODA la aplicacion.
//
// EL PROBLEMA QUE RESUELVE, y no es de una pantalla sino del sistema. Cada superficie invento su
// propio vocabulario visual para decir "esto es un bloque": el panel del nutricionista separaba con
// lineas, Rutas de atencion usa un recuadro con acento a la izquierda, Diagnostico usa `Card`, y por
// el camino se acumularon tres tokens de fondo (`bg-muted`, `bg-background`, `bg-surface`) sin
// criterio compartido. Ninguna esta mal por dentro. El problema es que **el profesional cruza de
// Diagnostico a Tratamiento y cambia el idioma visual**, y tiene que volver a aprender que es que.
//
// LOS TRES NIVELES dicen QUE ES el bloque, no cuanto pesa en pixeles ni cuanto ocupa:
//
//   decision   Lo que el PROFESIONAL decide y queda sellado. Superficie elevada.
//              Panel: objetivo, cadena calorica, restricciones, intercambio, tiempos de comida.
//              Diagnostico: confirmar el diagnostico. Seguimiento: proximo control, remisiones.
//
//   derivado   Lo que el SISTEMA calcula o propone a partir de esa decision. Superficie plana.
//              Panel: validacion, distribucion, menu semanal, menu IA.
//              Diagnostico: DFI, radar, Diana, convergencia, sarcopenia. Seguimiento: comparacion,
//              capacitancia, series.
//
//   registro   Lo que se ESCRIBE y acompana. Sin superficie, para no competir.
//              Panel: guias dietarias, notas. Diagnostico: criterio del profesional.
//
// POR QUE "decision" Y NO "prescripcion", que fue el primer nombre: en el panel del nutricionista el
// profesional PRESCRIBE, pero en Diagnostico CONFIRMA y en Seguimiento AGENDA. Lo comun a las tres no
// es prescribir, es DECIDIR. Un nombre que solo describe una pantalla obliga a forzarlo en las otras,
// y un nivel forzado se aplica mal.
//
// CUIDADO DELIBERADO CON "registro": baja el peso VISUAL, NO la importancia. Las restricciones
// alimentan el filtro de alergenos del menu y las notas son documento clinico. Por eso el nivel 3 se
// distingue por AUSENCIA de superficie y conserva el tamano de texto del cuerpo, en vez de por un gris
// que lo apague. Polaris usa el fondo apagado para "menos importante", y ese es justo el matiz que
// aqui NO queremos. Si alguien "arregla" esto poniendole un gris, lo empeora.
//
// POR QUE JERARQUIA Y NO NAVEGACION INTERNA (anclas, pasos, pestanas dentro de la pantalla). GOV.UK
// separa las dos clases de superficie de forma explicita: su regla de "una cosa por pantalla" es para
// SERVICIOS AL PUBLICO, que la gente usa una vez y no conoce; para INTERFACES DE TRABAJO escriben lo
// contrario, "puedes asumir que el personal conoce el proceso y optimizar para la VELOCIDAD, lo que
// probablemente significa poner MAS de una cosa por pantalla". El intake del paciente esta partido a
// proposito; el panel del profesional a proposito no lo esta. Son dos clases con reglas opuestas y no
// se deben unificar.
// https://designnotes.blog.gov.uk/2015/09/25/design-principles-for-admin-interfaces/
//
// LO QUE ESTE COMPONENTE NO HACE: no mueve nada de sitio, no funde secciones, no acorta titulos y no
// cambia contenido. Solo decide la SUPERFICIE. Si al aplicarlo una pantalla necesitara mover algo, eso
// no es un ajuste de estilo y se reporta antes de tocarlo.

export type NivelBloque = "decision" | "derivado" | "registro";

const NIVEL: Record<NivelBloque, { caja: string; titulo: string }> = {
  decision: {
    caja: "rounded-xl border border-border bg-card p-5 shadow-sm",
    titulo: "text-base font-semibold text-foreground",
  },
  derivado: {
    // CORRECCION DE UNA CORRECCION MIA (2026-08-29). Al invertir la disposicion puse esto en
    // `bg-transparent` razonando que "plana" significa plana RESPECTO A SU CONTENEDOR. El razonamiento
    // era bonito y el resultado, malo: sobre la pagina gris, transparente es gris, y todo lo que vive en
    // este nivel (composicion corporal, el nutraceutico elegido, el resumen clinico del nutricionista)
    // se quedo sin superficie. Santiago los reporto uno por uno; no eran tres defectos, era este.
    //
    // Los tres niveles se leen CONTRA LA PAGINA, no contra su contenedor inmediato, porque es la pagina la
    // que da la referencia: sobre gris, ELEVADA es blanca con sombra, PLANA es blanca sin sombra, y SIN
    // SUPERFICIE es el gris. Con la pagina blanca de antes esa escala no se podia expresar, y por eso
    // decision y derivado habian acabado siendo los dos blancos.
    caja: "rounded-xl border border-border bg-card p-5",
    titulo: "text-sm font-semibold text-foreground",
  },
  registro: {
    // Sin caja a proposito: se distingue por no competir, no por parecer opcional.
    caja: "px-1 py-2",
    titulo: "text-sm font-semibold text-foreground",
  },
};

/** Clases de la caja de un bloque. Para superficies que ya tienen su propia `<section>`. */
export function bloqueCls(nivel: NivelBloque, extra?: string): string {
  return cn("flex flex-col gap-3", NIVEL[nivel].caja, extra);
}

/** Clases del titulo de un bloque, para que el tamano acompane al nivel. */
export function tituloBloqueCls(nivel: NivelBloque, extra?: string): string {
  return cn(NIVEL[nivel].titulo, extra);
}

/**
 * Bloque completo con su titulo. Para superficies nuevas o para las que no necesitan controlar su
 * propio elemento.
 *
 * `sub` es una linea ADITIVA: sirve para decir de que depende el bloque o que gobierna, sin tocar el
 * titulo. Varios titulos del sistema van verbatim del archivo de Gildardo y NO se pueden acortar,
 * porque la referencia es parte del dato (ver titulos-tablas-plan.test.ts).
 */
export function Bloque({
  nivel,
  titulo,
  sub,
  children,
  className,
  as: Tag = "section",
}: {
  nivel: NivelBloque;
  titulo?: string;
  sub?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={bloqueCls(nivel, className)}>
      {titulo || sub ? (
        <div className="flex flex-col gap-1">
          {titulo ? <h3 className={tituloBloqueCls(nivel)}>{titulo}</h3> : null}
          {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}
