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
export function AsesoriaMacroPanel({
  asesoria,
  valor,
}: {
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
    <div className="mt-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs">
      {asesoria.conflicto ? (
        // CONFLICTO: se muestran los dos rangos, sin elegir. La nota es suya.
        <p className="font-medium text-foreground">Dos condiciones piden rangos que no coinciden</p>
      ) : asesoria.rango ? (
        <p className="font-medium text-foreground">
          Referencia: {asesoria.rango[0]}
          {"–"}
          {asesoria.rango[1]} {asesoria.unidad}
        </p>
      ) : null}

      <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
        {asesoria.items.map((i) => (
          <li key={`${i.cond}-${i.min}-${i.max}`}>
            <span className="font-medium text-foreground">{i.cond}:</span> {i.min}
            {"–"}
            {i.max} {asesoria.unidad}. {i.porque}{" "}
            <span className="opacity-70">({i.fuente})</span>
          </li>
        ))}
      </ul>

      {asesoria.nota ? <p className="mt-1 text-muted-foreground">{asesoria.nota}</p> : null}

      {/* EL AVISO NO VA EN LA CAPA CLINICA (`--clinical-*`), y no es un detalle de estilo: esa capa pinta
          un VEREDICTO sobre una persona y sus hexadecimales salen de los clasificadores de Gildardo. Esto
          es operativo, dice "mira esta cifra", asi que va en la capa de atencion. Mezclarlas hace que un
          cambio en su escala clinica mueva avisos operativos, y al reves. */}
      {fuera ? (
        <p className="mt-1.5 font-medium text-attention">La cifra escrita queda {fuera}.</p>
      ) : null}
    </div>
  );
}
