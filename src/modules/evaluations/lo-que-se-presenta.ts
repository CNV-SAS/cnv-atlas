import { GI_NUNCA, noAdherentesAlProducto, saltoDeLosDigestivos } from "@/modules/followups/modulo-s";

import type { ComportamientoDelItem } from "./data/survey-view-types";
import { parsePorProducto } from "./respuesta-en-texto";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO QUE SE PRESENTA, EN UN SOLO SITIO  ·  (0241; el defecto del smoke del 2026-11-09 por la mañana, y
// el de la pantalla de edición por la tarde)
//
// ═══ POR QUE ESTO ES UNA LISTA Y NO UN `if` EN EL JSX ═══
//
// Lo que se presenta se usa para SEIS cosas: pintar la encuesta del paciente, contar el denominador de
// su barra, contar lo respondido, decidir qué preguntas faltan al enviar, pintar la pantalla de
// edición del profesional, y contar lo que falta ahí. El defecto que Santiago encontró en el smoke es
// exactamente lo que pasa cuando esas lecturas no leen la misma lista:
//
//   · por la mañana, en la encuesta del paciente: *"el envío dice que falta la pregunta 2 cuando no se
//     mostró porque el S1 fue «Todos los días»"*. El S2 se descartaba DENTRO de su control (que
//     devuelve null sin productos no adherentes) y el recuento no se enteraba;
//   · por la tarde, en /encuesta/editar: *"con los dos productos en «5 o más días», la pregunta 2 sale
//     sin responder y marcada como OBLIGATORIA"*. La pantalla de edición tenía su propia lista, que era
//     "todas las preguntas del instrumento".
//
// Las dos son el hazard 6: una exigencia sobre algo que no se puede alcanzar. Y la segunda es peor que
// la primera, porque no se la lleva un paciente: se la lleva la profesional, que puede creer que tiene
// que llenar una pregunta que la CNV-S decidió no hacer.
//
// ═══ MODULO NEUTRO ═══
//
// Sin `server-only` ni `"use client"`: lo leen la encuesta del paciente (cliente), la pantalla de
// edición (cliente) y los candados. Una regla compartida entre dos pantallas no puede vivir dentro de
// una de ellas, que es como nació este defecto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LO MINIMO QUE HAY QUE SABER DE UN ITEM para decidir si se presenta.
 *
 * `comportamiento` es opcional porque las pantallas que arman una pregunta a mano no lo tienen; sin él,
 * la regla trata el ítem como `repetir`, que es el comportamiento de TODA la línea base.
 */
export type ItemQueSePresenta = {
  fieldKey: string | null;
  comportamiento?: ComportamientoDelItem | null;
};

export type ContextoDeLaPresentacion = {
  /**
   * La consulta aplicó la CNV-S. En la línea base es `false` y la regla solo quita los `retirar`, que
   * ahí no existen: por eso no cambia ni una pregunta de las 500 consultas que ya hay.
   */
  esCnvs: boolean;
  /** No se le indicó ningún nutracéutico en la anterior: el S1 y el S2 no se presentan (decisión 34). */
  sinProductos: boolean;
  /** Los productos cuyo S1 no fue adherente. Vacío = el S2 no tiene a quién preguntarle (su §2.3). */
  noAdherentes: ReadonlySet<string>;
  /**
   * Si los siete síntomas digestivos se presentan. `null` = en esta consulta el salto no aplica (no es
   * CNV-S, o el instrumento no trae los siete), y entonces se presentan por el camino de siempre.
   */
  digestivosSePresentan: boolean | null;
};

/**
 * LOS ITEMS QUE SE LE PRESENTAN A ALGUIEN EN ESTA CONSULTA, de los que trae el instrumento.
 *
 * ═══ LO QUE QUEDA FUERA, Y POR QUE SIGUE LLEGANDO EN LA LISTA DE ENTRADA ═══
 *
 *   · los `retirar` (sus ítems 35, 38, 41 y 63): no se preguntan y CONSERVAN el valor de la línea base.
 *     Llegan para que quien guarda sepa cuáles arrastrar (`retirados-heredados`, en el servidor, y la
 *     pantalla de edición, que los manda tal cual: el writer reemplaza el snapshot completo, así que
 *     dejar de mandarlos no sería "no preguntarlos", sería BORRAR la herencia de `d5_38`, que alimenta
 *     el diagnóstico).
 *   · el S1 y el S2 cuando no hay ningún nutracéutico indicado (decisión 34): una pregunta sobre un
 *     producto que nadie le indicó no tiene respuesta correcta, y la adherencia se resuelve con el S3.
 *   · el S2 cuando NINGUN producto quedó no adherente (su §2.3: solo se presenta para los que no se
 *     tomaron como se indicó). Con los dos productos en "5 o más días", el S2 no tiene a quién
 *     preguntarle, y es el caso exacto que reportó Santiago.
 *   · los siete digestivos cuando su §7.2 los salta, y también mientras el filtro esté sin responder si
 *     el salto puede aplicar (ver `saltoDeLosDigestivos`): presentarlos y quitarlos al responder el
 *     filtro sería pedirle al paciente que conteste algo que va a desaparecer.
 */
export function loQueSePresenta<T extends ItemQueSePresenta>(
  items: T[],
  ctx: ContextoDeLaPresentacion,
): T[] {
  return items.filter((q) => {
    if (q.comportamiento === "retirar") return false;
    if (ctx.sinProductos && (q.fieldKey === "cnvs_s1" || q.fieldKey === "cnvs_s2")) return false;
    if (ctx.esCnvs && q.fieldKey === "cnvs_s2" && ctx.noAdherentes.size === 0) return false;
    if (
      q.comportamiento === "repetir_con_filtro" &&
      ctx.digestivosSePresentan === false
    ) {
      return false;
    }
    return true;
  });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA MISMA REGLA, SOBRE LOS DOMINIOS YA LEIDOS  ·  para las pantallas del profesional
//
// La encuesta del paciente trabaja con los ITEMS del instrumento y tiene en estado el S1 y el filtro,
// porque los está respondiendo en ese momento. Las dos pantallas del profesional reciben los dominios
// YA LEIDOS (`SurveyDomain[]`, con la respuesta de cada pregunta dentro), así que los dos datos que
// deciden salen de lo guardado... salvo en la de edición, donde la profesional puede cambiar el S1 y el
// filtro ahí mismo y lo que se presenta tiene que moverse con ella.
//
// ESTA FUNCION SIRVE A LAS DOS, y por eso `enVivo` es opcional: sin él lee lo guardado.
//
// ═══ LAS TRES PANTALLAS QUE TENIAN QUE LEER ESTO Y NO LO LEIAN ═══
//
//   · /encuesta/editar: *"con los dos productos en «5 o más días», la pregunta 2 sale sin responder y
//     marcada como OBLIGATORIA"* (Santiago, 2026-11-09). Tenía su propia lista: todas las preguntas del
//     instrumento;
//   · el bloque de la pestaña Evaluación que avisa en ámbar *"Faltan N preguntas por responder"* y las
//     lista una por una con su enlace: contaba lo mismo, así que pedía responder una pregunta que la
//     CNV-S decidió no hacer, y esa es la superficie que de verdad se lee como una obligación;
//   · el porcentaje de completitud al lado del botón de ver/editar, que salía del mismo total.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Lo que la regla necesita de una pregunta YA LEIDA (un `SurveyAnswerView` lo cumple). */
export type ItemLeido = ItemQueSePresenta & { answerValue: string | null };

export type DominioDe<T> = { section: string; questions: T[] };

/**
 * Los insumos de la CNV-S de la consulta, o `null` si aplicó la línea base.
 *
 * Es la forma MINIMA a propósito (structural typing): así lo cumple lo que devuelve
 * `contextoDeLaCnvsDeLaConsulta` sin que este módulo neutro tenga que importar nada del servidor.
 */
export type InsumosParaPresentar = {
  productos: { id: string }[];
  anteriores: Record<string, string | null>;
} | null;

export function dominiosQueSePresentan<T extends ItemLeido>(
  dominios: DominioDe<T>[],
  cnvs: InsumosParaPresentar,
  /**
   * Lo que la pantalla tiene en estado porque se puede editar ahí mismo. Omitido, o con un campo
   * ausente, se usa lo guardado.
   */
  enVivo?: { s1?: Record<string, string>; filtroGi?: string | null },
): DominioDe<T>[] {
  const todas = dominios.flatMap((d) => d.questions);
  const guardada = (clave: string) => todas.find((q) => q.fieldKey === clave)?.answerValue ?? null;

  const s1 = enVivo?.s1 ?? parsePorProducto(guardada("cnvs_s1"));
  const filtroGi = enVivo && "filtroGi" in enVivo ? (enVivo.filtroGi ?? null) : guardada("cnvs_gi_filtro");
  const digestivos = todas.filter((q) => q.comportamiento === "repetir_con_filtro");
  const salto =
    cnvs && digestivos.length > 0
      ? saltoDeLosDigestivos(
          filtroGi,
          cnvs.anteriores,
          digestivos.map((q) => q.fieldKey ?? ""),
        )
      : null;

  const presentadas = new Set(
    loQueSePresenta(todas, {
      esCnvs: cnvs != null,
      sinProductos: cnvs != null && cnvs.productos.length === 0,
      noAdherentes: noAdherentesAlProducto(s1),
      digestivosSePresentan: salto ? salto.sePresentan : null,
    }),
  );

  // UN DOMINIO QUE SE QUEDA SIN PREGUNTAS NO SE PINTA: un acordeón vacío con su contador en cero se lee
  // como "aquí falta algo", que es lo contrario de lo que la regla acaba de decidir.
  return dominios
    .map((d) => ({ section: d.section, questions: d.questions.filter((q) => presentadas.has(q)) }))
    .filter((d) => d.questions.length > 0);
}

/**
 * LO QUE NO SE PRESENTA PERO **SE CONSERVA** al guardar, por `questionId`.
 *
 * ═══ POR QUE ESTO EXISTE, Y ES LA MITAD PELIGROSA DEL ARREGLO ═══
 *
 * El writer de la edición REEMPLAZA el snapshot completo (`delete` + `insert`): lo que el formulario no
 * manda, se borra. Así que quitar un ítem de la pantalla sin más no sería *"no preguntarlo"*, sería
 * **BORRARLO**, y entre los cuatro `retirar` está `d5_38`, que alimenta el diagnóstico: la consulta
 * habría pasado a decir *"Encuesta incompleta: faltan 1 de 29"* por haber arreglado la pantalla.
 *
 * SE CONSERVAN DOS COSAS Y NO TRES:
 *
 *   · los `retirar`, con el valor que ya tienen (lo heredó el servidor al enviar la encuesta);
 *   · los siete digestivos cuando el salto los da por "Nunca", que es lo que su §7.2 manda GUARDAR (no
 *     omitir): un salto que deja huecos convierte una regla de ahorro en una encuesta incompleta.
 *
 * El S1 y el S2 que no se presentan NO se conservan: si la profesional corrige el S1 y ningún producto
 * queda no adherente, la respuesta del S2 pasa a ser la respuesta de una pregunta que ya no aplica.
 */
export function loQueSeConservaSinPreguntar<T extends ItemLeido & { questionId: string }>(
  dominios: DominioDe<T>[],
  cnvs: InsumosParaPresentar,
  enVivo?: { s1?: Record<string, string>; filtroGi?: string | null },
): { questionId: string; answerValue: string }[] {
  const todas = dominios.flatMap((d) => d.questions);
  const presentadas = new Set(
    dominiosQueSePresentan(dominios, cnvs, enVivo).flatMap((d) => d.questions),
  );
  const salen = todas.filter((q) => !presentadas.has(q));
  const salida: { questionId: string; answerValue: string }[] = [];
  for (const q of salen) {
    if (q.comportamiento === "retirar") {
      // Solo lo que EXISTE: sin valor heredado no se inventa nada (misma regla que `retirados-heredados`).
      const v = (q.answerValue ?? "").trim();
      if (v !== "") salida.push({ questionId: q.questionId, answerValue: q.answerValue as string });
      continue;
    }
    if (q.comportamiento === "repetir_con_filtro") {
      salida.push({ questionId: q.questionId, answerValue: GI_NUNCA });
    }
  }
  return salida;
}