"use client";

import { asesoriaFuera } from "@/clinical-engine/frozen/atlas-asesoria-macro.js";

import type { AsesoriaMacro } from "../data/treatment-view-types";

// EL PANEL DE REFERENCIA POR DIAGNOSTICO, junto al campo de proteina y al de grasa (Gildardo, 2026-09-03).
//
// QUE ES Y QUE NO ES, porque la distincion es la razon de existir de esta pieza. Su entrega del 3 de
// septiembre retira la proteina por patologia de los cuatro modulos congelados y la deja en 0,8 editable.
// Esto es LA OTRA MITAD de esa decision: el rango de la condicion del paciente deja de imponerse y pasa a
// MOSTRARSE. Textual suyo: "si portaron la retirada sin portar el panel, lo que quedo en Atlas es media
// instruccion, y es la mitad peor".
//
// POR ESO NO VALIDA NADA. No hay techo, no hay piso, no bloquea el guardado y no pinta el campo en rojo:
// su instruccion del 27 de agosto (§5) dice que NINGUNA cifra de la prescripcion lleva validacion, y vale
// para toda la prescripcion, no indicador por indicador. El motor propone, el profesional dispone. Lo
// unico que hace este bloque es poner al lado el rango que su ciencia sugiere, con el porque y la fuente.
//
// EL CONFLICTO SE PINTA DISTINTO, y es lo que hay que preservar al tocarlo: cuando dos condiciones del
// paciente piden rangos que no se solapan, `rango` viene null y `conflicto` viene true. Ahi el panel NO
// escoge: muestra los dos rangos y su nota. Un rango vacio y un conflicto se ven IGUAL si se tratan los
// dos como "sin dato", y no son lo mismo: el segundo es una decision que le toca al profesional.
//
// EL AVISO DE "FUERA DE RANGO" SE CALCULA AQUI Y NO EN EL SERVIDOR, a proposito: la cifra que hay que
// mirar es la que el profesional esta ESCRIBIENDO, no la que quedo guardada. Con el calculo en el
// servidor, el aviso iria un guardado por detras y diria lo contrario de lo que se ve en el campo.
// `asesoriaFuera` es su funcion, JS puro sin dependencias, asi que el cliente la puede importar.
// LA FORMA DEL PANEL ES LA SUYA (cotejo 2026-09-05, puntos 22.3 y 23). Iba como una cajita apretada
// debajo de un campo de un cuarto de ancho, y Santiago lo dijo de las dos maneras: "el html las pone mas
// completas y bonitas" y "se ven como raras abajo". Las dos frases describen lo mismo: el contenido no
// cabia. Su panel es de ANCHO COMPLETO y trae tres cosas que el nuestro no decia:
//   · el NOMBRE del macro, para que el panel se sostenga solo aunque no este pegado al campo;
//   · lo PRESCRITO frente a lo SUGERIDO, en la misma linea ("prescrito: 0.8 g/kg" · "sugerido 0.8-0.8"),
//     que es la comparacion que el profesional viene a hacer y antes tenia que hacer de memoria;
//   · cada condicion en su propio renglon, con su porque y su fuente legibles, no en una lista corrida.
//
// Y VA DEBAJO DE LA VISTA PREVIA, no al lado del campo. Santiago propuso ponerlos AL LADO; su archivo los
// pone abajo y tiene razon el archivo: el porque y la fuente son dos lineas de texto, y al lado de un
// campo numerico estrecho vuelven a no caber, que es el problema del que veniamos. El cable entre el
// campo y el panel se dice con palabras, en el subtitulo del campo ("tu decision; la referencia va abajo"),
// que es lo que hace su archivo.
//
// UN SOLO ACENTO PARA LOS DOS. Su archivo pinta la proteina de morado y la grasa de verde azulado. No se
// portan: dos tonos elegidos por macro es color decorativo en una pantalla clinica, y aqui el color
// significa un veredicto. Los dos paneles usan el acento de marca, que no dice nada sobre el paciente.
export function AsesoriaMacroPanel({
  titulo,
  asesoria,
  valor,
}: {
  /** Nombre del macro en versalitas ("Proteína", "Grasa"): el panel ya no vive pegado a su campo. */
  titulo: string;
  asesoria: AsesoriaMacro | null;
  /** Lo que el profesional tiene escrito AHORA en el campo. Cadena vacia = sin escribir. */
  valor: string;
}) {
  if (!asesoria || asesoria.items.length === 0) return null;

  const escrito = valor.trim() === "" ? null : Number(valor.replace(",", "."));
  const fuera =
    escrito == null || !Number.isFinite(escrito)
      ? null
      : (asesoriaFuera(escrito, asesoria) as string | null);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          {titulo} · referencia según el diagnóstico
        </span>
        {escrito != null && Number.isFinite(escrito) ? (
          <span className="text-xs text-muted-foreground">
            prescrito: <strong className="font-semibold text-foreground">{escrito} {asesoria.unidad}</strong>
          </span>
        ) : null}
        {asesoria.rango ? (
          <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            sugerido {asesoria.rango[0]}–{asesoria.rango[1]} {asesoria.unidad}
          </span>
        ) : null}
        {/* CONFLICTO: se muestran los dos rangos, sin elegir. Un rango vacio y un conflicto se ven igual
            si uno los trata como "sin dato", y no son lo mismo: el segundo es una decision del
            profesional. Por eso el conflicto tiene su propia insignia y no la ausencia de la de arriba. */}
        {asesoria.conflicto ? (
          <span className="rounded-md bg-attention-bg px-2 py-0.5 text-xs font-medium text-attention">
            Dos condiciones piden rangos que no coinciden
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {asesoria.items.map((i) => (
          <li key={`${i.cond}-${i.min}-${i.max}`} className="border-l-2 border-primary/40 pl-3">
            <p className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium text-foreground">{i.cond}</span>
              <span className="font-semibold text-primary">
                {i.min}–{i.max} {asesoria.unidad}
              </span>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">{i.porque}</p>
            <p className="text-xs text-muted-foreground/80">{i.fuente}</p>
          </li>
        ))}
      </ul>

      {asesoria.nota ? <p className="text-xs text-muted-foreground">{asesoria.nota}</p> : null}

      {/* EL AVISO NO VA EN LA CAPA CLINICA (`--clinical-*`), y no es un detalle de estilo: esa capa pinta
          un VEREDICTO sobre una persona y sus hexadecimales salen de los clasificadores de Gildardo. Esto
          es operativo, dice "mira esta cifra", asi que va en la capa de atencion. Mezclarlas hace que un
          cambio en su escala clinica mueva avisos operativos, y al reves.
          ES NUESTRO Y NO SUYO: su panel no lo tiene. Se conserva porque informa sin corregir, que es lo
          unico que su §5 del 27 de agosto permite (ni techo, ni piso, ni bloqueo). */}
      {fuera ? (
        <p className="text-sm font-medium text-attention">La cifra escrita queda {fuera}.</p>
      ) : null}
    </div>
  );
}
