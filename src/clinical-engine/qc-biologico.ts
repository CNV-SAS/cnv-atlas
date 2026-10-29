// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CONTROL DE CALIDAD BIOLOGICO: LAS IDENTIDADES IMPOSIBLES  ·  FUNCION PURA (regla dura 5 y 12)
//
// ═══ DE DONDE SALE ═══
//
// Su entrega v12 del 2026-10-12, `atlasQCBiologico(d)` (linea 6336), con dos clases de hallazgo y una
// frase que decide el alcance de este archivo:
//
//   *"PENDIENTE DE VALIDACION: los numeros de QC_BIO_LIMITES no estan aprobados... Las identidades de la
//   lista «imposible» SI son definitivas."*
//
// ASI QUE AQUI VAN SOLO LAS IDENTIDADES. Los rangos (`QC_BIO_LIMITES`) NO se construyen: estan esperando
// que el firme los percentiles de la cohorte, y escribirlos ahora seria poner nueve cifras nuestras a
// decidir sobre mediciones reales, que es exactamente el defecto del `SANITY` que dejo sin diagnostico a
// una paciente con una capacitancia de 16,22 nF (sus nueve rangos se eligieron a ojo y nadie supo de donde
// salian). El dia que los firme, entran al lado de esto y no dentro.
//
// ═══ POR QUE UNA IDENTIDAD NO NECESITA QUE NADIE LA FIRME ═══
//
// No es una estadistica, es una comprobacion FISICA. Que la masa grasa no pueda ser mayor que el peso no
// depende de ninguna cohorte ni de ningun corte: si lo es, el dato esta mal, y da igual el pais, la edad y
// el equipo. Por eso estas son las unicas que se pueden construir sin esperar a nadie.
//
// ═══ LAS TRES TOLERANCIAS, MEDIDAS ANTES DE ESCRIBIRLAS ═══
//
// Tres de sus identidades son SUMAS que tienen que cuadrar, y una suma de valores que el equipo exporta
// redondeados no da exacta nunca. Hacia falta una tolerancia, y una tolerancia ES un umbral que decide
// sobre un dato clinico, asi que no se podia elegir a ojo (regla de Santiago, 2026-10-02).
//
// SE MIDIO LA DISTRIBUCION DEL RESIDUO en las 400 mediciones de consultas vigentes de pacientes reales
// (`scripts/CUANTO_CIERRAN_LAS_IDENTIDADES_2026-10-29.mjs`, solo lectura, re-corrible):
//
//   |Rc − (Re+R∞)/2|    maximo observado 0,0820 Ω      tolerancia: 1 Ω     (12 veces el maximo)
//   |FM + FFM − peso|   maximo observado 0,0000 kg     tolerancia: 0,5 kg
//   |AEC + AIC − ACT|   maximo observado 0,0010 L      tolerancia: 0,2 L
//
// Las tres quedan MUY por fuera del maximo real, que es la regla cuando no hay fuente: tan ancho que solo
// atrape lo IMPOSIBLE (una unidad cambiada, un cero de mas), nunca lo improbable. Con estas, el equipo
// tendria que equivocarse en mas de medio kilo para que una suma no cuadre.
//
// ═══ CERO Y VACIO SON "SIN DATO", y es su primera regla de diseño ═══
//
// *"Un parametro sin capturar llega como 0; si se tratara como valor, toda consulta sin espectroscopia
// saldria en rojo."* Asi que `0`, `null` y `undefined` salen de la comprobacion, y una identidad a la que
// le falta un insumo NO se evalua: no se evalua a favor ni en contra.
//
// LA EXCEPCION ES EL SIGNO, y es nuestra: para "¿es negativo?" el cero no es sin dato ni violacion, pero
// un NEGATIVO si lo es, y `0` nunca puede esconder un negativo. Asi que esas miran el valor crudo.
//
// ═══ LO QUE ESTE ARCHIVO NO HACE, A PROPOSITO ═══
//
// No decide, no frena y no lanza. Devuelve la lista de hallazgos y nada mas. *"El control avisa y frena,
// pero no decide. La decision de continuar es del profesional y queda registrada. No lo conviertas en un
// bloqueo sin salida."* El freno y su salida viven en la pantalla; aqui solo esta la fisica.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Los insumos del control. Todos opcionales: lo que no viene, no se comprueba. */
export type InsumosQcBiologico = {
  peso?: number | null;
  Re?: number | null;
  Ri?: number | null;
  Rinf?: number | null;
  C?: number | null;
  Fo?: number | null;
  Rc?: number | null;
  Xc?: number | null;
  Z5?: number | null;
  Z200?: number | null;
  FM?: number | null;
  FM_pct?: number | null;
  FFM?: number | null;
  TBW?: number | null;
  ECW?: number | null;
  ICW?: number | null;
  SMM?: number | null;
  MCA?: number | null;
};

/** Un hallazgo del control. El `codigo` es estable: con el se compara si el hallazgo CAMBIO. */
export type HallazgoQc = {
  /** Identificador estable, para saber si lo que se visto-bueno sigue siendo lo mismo. */
  codigo: string;
  /** Lo que el profesional lee. En su vocabulario, no en el nuestro. */
  texto: string;
};

// ═══ LAS TRES TOLERANCIAS, con su fuente al lado (ver el bloque de arriba) ═══
/** Residuo maximo observado: 0,0820 Ω sobre 400 mediciones reales (2026-10-29). */
const TOLERANCIA_RC_OHM = 1;
/** Residuo maximo observado: 0,0000 kg sobre 400 mediciones reales (2026-10-29). */
const TOLERANCIA_PESO_KG = 0.5;
/** Residuo maximo observado: 0,0010 L sobre 393 mediciones reales (2026-10-29). */
const TOLERANCIA_AGUA_L = 0.2;

/** El valor si se puede usar como medida; `null` si falta o si es cero (su regla: cero = sin dato). */
function medido(x: number | null | undefined): number | null {
  if (x == null || !Number.isFinite(x) || x === 0) return null;
  return x;
}

/** El valor crudo, solo para preguntar por el SIGNO: ahi el cero no es sin dato. */
function crudo(x: number | null | undefined): number | null {
  if (x == null || !Number.isFinite(x)) return null;
  return x;
}

/**
 * Las identidades que esta medicion VIOLA. Vacio = ninguna, que es el caso normal.
 *
 * Medido el 2026-10-29: de 400 mediciones de consultas vigentes de pacientes reales, **2** violan algo, y
 * las dos violan LAS MISMAS DOS por un unico defecto fisico (su masa grasa es negativa, y entonces la masa
 * sin grasa sale mayor que el peso). O sea que esto es una red que casi nunca salta, no un freno
 * retroactivo sobre historias cerradas.
 */
export function identidadesVioladas(d: InsumosQcBiologico): HallazgoQc[] {
  const h: HallazgoQc[] = [];

  const Re = medido(d.Re);
  const Rinf = medido(d.Rinf);
  const Rc = medido(d.Rc);
  // La intracelular, la capacitancia y la frecuencia caracteristica NO se leen con `medido`: ninguna
  // identidad las compara, solo se les pregunta el SIGNO mas abajo, y ahi se mira el valor crudo porque la
  // regla del cero no puede esconder un negativo.
  const Z5 = medido(d.Z5);
  const Z200 = medido(d.Z200);
  const peso = medido(d.peso);
  const FM = medido(d.FM);
  const FFM = medido(d.FFM);
  const TBW = medido(d.TBW);
  const ECW = medido(d.ECW);
  const ICW = medido(d.ICW);
  const SMM = medido(d.SMM);
  const MCA = medido(d.MCA);

  // 1. La resistencia BAJA al subir la frecuencia, asi que la extracelular es mayor que la infinita.
  if (Re != null && Rinf != null && Re <= Rinf) {
    h.push({
      codigo: "re_no_mayor_que_rinf",
      texto:
        "La resistencia extracelular no es mayor que la infinita, y la resistencia baja al subir la frecuencia.",
    });
  }

  // 2. La reactancia del centro del circulo es NEGATIVA en un tejido: positiva es imposible. El cero no
  //    viola (no es positivo), y se mira el crudo porque aqui el cero no significa "sin dato".
  const Xc = crudo(d.Xc);
  if (Xc != null && Xc > 0) {
    h.push({
      codigo: "xc_positiva",
      texto: "La reactancia del centro del círculo es positiva, y en un tejido no puede serlo.",
    });
  }

  // 3. Los tres parametros tienen que pertenecer al MISMO arco de Cole: el centro cae en el punto medio.
  if (Rc != null && Re != null && Rinf != null) {
    if (Math.abs(Rc - (Re + Rinf) / 2) > TOLERANCIA_RC_OHM) {
      h.push({
        codigo: "rc_fuera_del_arco",
        texto:
          "La resistencia del centro del círculo no es el punto medio entre la extracelular y la infinita: los parámetros no pertenecen al mismo arco.",
      });
    }
  }

  // 4. La impedancia BAJA con la frecuencia.
  if (Z5 != null && Z200 != null && Z200 > Z5) {
    h.push({
      codigo: "impedancia_sube_con_la_frecuencia",
      texto: "La impedancia a 200 kHz es mayor que a 5 kHz, y tiene que bajar al subir la frecuencia.",
    });
  }

  // 5. Ningun parametro de Cole puede ser negativo. SE MIRA EL CRUDO (el signo no se puede esconder tras
  //    un cero) y NO entra la reactancia: la del centro es negativa por naturaleza, y su regla 2 ya dice
  //    que lo imposible ahi es lo contrario.
  const negativos = (
    [
      ["la resistencia extracelular", d.Re],
      ["la resistencia intracelular", d.Ri],
      ["la resistencia infinita", d.Rinf],
      ["la capacitancia de membrana", d.C],
      ["la frecuencia característica", d.Fo],
      ["la resistencia del centro del círculo", d.Rc],
    ] as const
  ).filter(([, x]) => {
    const n = crudo(x);
    return n != null && n < 0;
  });
  if (negativos.length > 0) {
    h.push({
      codigo: "cole_negativo",
      texto: `Hay un parámetro de la curva de Cole en negativo (${negativos.map(([n]) => n).join(", ")}).`,
    });
  }

  // 6. La masa grasa no llega al peso, y la masa sin grasa no lo pasa.
  if (FM != null && peso != null && FM >= peso) {
    h.push({ codigo: "grasa_mayor_o_igual_al_peso", texto: "La masa grasa iguala o supera el peso." });
  }
  if (FFM != null && peso != null && FFM > peso) {
    h.push({ codigo: "sin_grasa_mayor_que_el_peso", texto: "La masa sin grasa supera el peso." });
  }

  // 7. Y las dos SUMAN el peso.
  if (FM != null && FFM != null && peso != null) {
    if (Math.abs(FM + FFM - peso) > TOLERANCIA_PESO_KG) {
      h.push({
        codigo: "grasa_mas_sin_grasa_no_suma_el_peso",
        texto: "La masa grasa más la masa sin grasa no suma el peso.",
      });
    }
  }

  // 8. El agua total es una PARTE de la masa sin grasa, asi que no puede igualarla ni pasarla.
  if (TBW != null && FFM != null && TBW >= FFM) {
    h.push({
      codigo: "agua_total_mayor_o_igual_que_sin_grasa",
      texto: "El agua total iguala o supera la masa sin grasa, y es una parte de ella.",
    });
  }

  // 9. Y sus dos compartimentos la SUMAN.
  if (ECW != null && ICW != null && TBW != null) {
    if (Math.abs(ECW + ICW - TBW) > TOLERANCIA_AGUA_L) {
      h.push({
        codigo: "aec_mas_aic_no_suma_el_agua_total",
        texto: "El agua extracelular más la intracelular no suma el agua total.",
      });
    }
  }

  // 10. El musculo y la masa celular activa son PARTES de la masa sin grasa.
  if (FFM != null && SMM != null && SMM >= FFM) {
    h.push({
      codigo: "musculo_mayor_o_igual_que_sin_grasa",
      texto: "La masa muscular iguala o supera la masa sin grasa, y es una parte de ella.",
    });
  }
  if (FFM != null && MCA != null && MCA >= FFM) {
    h.push({
      codigo: "mca_mayor_o_igual_que_sin_grasa",
      texto: "La masa celular activa iguala o supera la masa sin grasa, y es una parte de ella.",
    });
  }

  // 12. LA NUESTRA, propuesta en la revision del 2026-10-26 y pendiente de que el la adopte: una grasa
  //     negativa es imposible y su lista no la atrapaba. Hay dos mediciones reales con porcentaje de grasa
  //     negativo (una de -15,6 %), y eso no es un rango ancho o estrecho, es un valor que no puede existir.
  //
  //     EL CERO NO CUENTA (es "sin dato" por su regla), asi que la condicion es ESTRICTAMENTE negativo,
  //     aunque la propuesta se escribio como "<= 0". Decirlo con el cero dentro pondria en rojo toda
  //     consulta a la que le falte la composicion, que es justo lo que su regla de diseño prohibe.
  const FMcrudo = crudo(d.FM);
  const FMpctCrudo = crudo(d.FM_pct);
  if ((FMcrudo != null && FMcrudo < 0) || (FMpctCrudo != null && FMpctCrudo < 0)) {
    h.push({
      codigo: "grasa_negativa",
      texto: "La masa grasa o el porcentaje de grasa es negativo, y no puede serlo.",
    });
  }

  return h;
}

/**
 * La huella de un conjunto de hallazgos, para saber si lo que el profesional dio por visto SIGUE siendo lo
 * mismo.
 *
 * SU REGLA, literal: *"Si despues cambia un dato y aparece un hallazgo distinto, se pide de nuevo."* Con
 * una bandera de "ya lo vi" a secas, cambiar el Excel por otro igual de imposible pasaria sin preguntar.
 * Los codigos van ORDENADOS para que el mismo conjunto de hallazgos de la misma huella siempre.
 */
export function huellaDeLosHallazgos(hallazgos: HallazgoQc[]): string {
  return [...hallazgos.map((x) => x.codigo)].sort().join("|");
}
