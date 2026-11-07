import type { ResultadoEbBis } from "./types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// COMO SE PRESENTA LA EB-BIS v7  ·  SUS TEXTOS, NO LOS NUESTROS
//
// ═══ DE DONDE SALE ═══
//
// Tabla 3 de su entrega del 2026-10-26 ("Salidas y presentacion en pantalla"), con su pie literal:
// *"Toda salida se presenta como estimacion, nunca como diagnostico."*
//
// Las frases de abajo son SUYAS, copiadas de esa tabla. No se reescriben ni se "mejoran": son
// comunicacion clinica, y la Regla 0 dice que su archivo se representa literalmente.
//
// ═══ POR QUE ESTO VIVE EN EL MOTOR Y NO EN CADA PANTALLA ═══
//
// Su §4.3 lo pide para los parametros (*"deben guardarse en configuracion versionada, no escritos dentro
// de la logica de pantalla"*) y vale igual para los textos: la EB-BIS sale por la pantalla del
// profesional, por el informe del paciente y por la historia clinica. Tres copias de la misma frase
// divergen por donde nadie mira, que es el defecto que ya costo seis desfases en el plan del paciente.
//
// ═══ LA FRONTERA ENTRE LOS DOS LECTORES ES DE TIPO, NO DE PLANTILLA ═══
//
// Su tabla 3 reparte las salidas: la EB-BIS y el IAE van al profesional Y al paciente; la z de pares, el
// tope y la alerta de discordancia van SOLO al profesional. Asi que hay dos funciones y la del paciente
// no puede devolver lo del profesional ni por descuido. Una sola funcion con un `if (esPaciente)` deja la
// decision en quien la llama, y entonces la frontera depende de que cada pantalla se acuerde.
//
// ═══ UN CAMBIO SUYO QUE CONVIENE TENER A LA VISTA ═══
//
// Hasta el 2026-08-01 su decision era la contraria: la cifra de EB-BIS NO iba al paciente, "edad
// biologica" era termino retirado del sistema, y mostrar el IAE revelaba el constructo. Su tabla 3 la
// revierte de forma explicita (las dos filas dicen "Profesional y paciente") y vuelve a usar la expresion,
// ahora como "edad biologica ESTIMADA". Lo nuevo manda, y Santiago lo confirmo al pedir esta tabla; queda
// escrito aqui porque el informe del paciente lleva un comentario que explica la decision vieja.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El corte de las tres bandas del IAE, en años. Suyo (tabla 3): ±5,0. */
export const BANDA_IAE_ANIOS = 5;

/** La frase de la EB-BIS. Su tabla 3: *"Edad biologica estimada: 76,4 años"*. */
export function textoEbBis(eb: number): string {
  return `Edad biológica estimada: ${enEspanol(eb)} años`;
}

/**
 * La frase del IAE, por banda. Su tabla 3, literal:
 *
 * *"'+12,4 años: envejecimiento acelerado estimado' si IAE >= +5,0; 'acorde con sus pares' entre -5,0 y
 * +5,0; 'desacelerado estimado' si IAE <= -5,0"*.
 *
 * LOS CORTES SON CERRADOS EN LOS DOS EXTREMOS porque el los escribio asi (">=" y "<="), y en el medio
 * dice "entre -5,0 y +5,0". Un IAE de exactamente +5,0 es acelerado, no intermedio.
 */
export function textoIae(iae: number): string {
  return `${cifraIae(iae)} años: ${bandaIae(iae)}`;
}

/**
 * EL IAE SIEMPRE CON SU SIGNO, un decimal y coma. Su tabla 3 pide el formato *"1 decimal con signo"* y lo
 * escribe asi en su propio ejemplo: *"+12,4 años"*.
 *
 * ESTA SEPARADO PORQUE EL SIGNO SE ESCRIBIA A MANO EN TRES SITIOS (Santiago, 2026-10-30: *"El IAE sin
 * signo: la tabla dice '3,5' y su tabla 3 pide 1 decimal con signo: '+3,5'"*). La celda de Valor de la
 * tabla de indicadores pasaba por el formateador general, que no sabe que esta cifra es una diferencia y
 * la pintaba sin signo; las otras dos lo componian con su propio ternario. Un IAE sin signo no dice si el
 * envejecimiento va adelante o atras, que es TODO lo que ese numero significa.
 *
 * EL CERO VA SIN SIGNO ("0,0"): ni "+0,0" ni "-0,0" son ciertos, y su ejemplo solo fija el caso positivo.
 */
export function cifraIae(iae: number): string {
  const signo = iae > 0 ? "+" : iae < 0 ? "-" : "";
  return `${signo}${enEspanol(Math.abs(iae))}`;
}

/**
 * SOLO LA BANDA, sin la cifra: es el rotulo que va en una celda de tabla, donde el valor ya esta en
 * su propia columna.
 *
 * ESTA SEPARADO DE `textoIae` PORQUE LA PANTALLA LO NECESITABA Y NO LO TENIA (Santiago, 2026-10-29):
 * *"la tabla 3 de Gildardo dice 'acorde con sus pares', 'envejecimiento acelerado estimado' y
 * 'desacelerado estimado'. La pantalla dice 'Concordante'. Usa sus textos."* La tabla de indicadores
 * pintaba el rotulo de su capa de DISPLAY vieja (`dIAE`, ATLAS_v8 L14444), que es anterior a la tabla 3
 * y usa otra palabra Y OTRO CORTE (`<-5` y `<=5`, abiertos, contra `>=` y `<=` cerrados de la tabla 3).
 *
 * Las tres frases y los dos cortes viven AQUI y en un solo sitio. Dos copias con cortes distintos es
 * exactamente lo que hacia que un IAE de +5,0 se llamara de dos formas segun donde se leyera.
 */
export function bandaIae(iae: number): string {
  if (iae >= BANDA_IAE_ANIOS) return "envejecimiento acelerado estimado";
  if (iae <= -BANDA_IAE_ANIOS) return "envejecimiento desacelerado estimado";
  return "acorde con sus pares";
}

/** Una cifra de la EB-BIS en el formato de su tabla 3: un decimal y coma, con el cero final. */
export function cifraEbBis(n: number): string {
  return enEspanol(n);
}

/** Lo que su §5 deja ver a los DOS lectores. `null` = no hay cifras que mostrar. */
export type EbBisParaTodos = { eb: string; iae: string } | null;

export function ebBisParaTodos(eb: number | null, iae: number | null): EbBisParaTodos {
  if (eb == null || iae == null) return null;
  return { eb: textoEbBis(eb), iae: textoIae(iae) };
}

/**
 * LO MISMO, EN PIEZAS: la cifra SIN su rotulo, para cuando el rotulo es el titulo del bloque.
 *
 * ═══ DE DONDE SALE (Santiago, 2026-11-05) ═══
 *
 * *"La edad biologica estimada, grande, 'estimada por el modelo ANI-BIS-E'."* En la maqueta nueva del
 * informe el rotulo va arriba en versalitas y el numero va solo, en 34 puntos; la frase entera de su tabla
 * ("Edad biologica estimada: 76,4 años") no cabe en esa forma.
 *
 * ═══ POR QUE ES UNA FUNCION DEL MOTOR Y NO UN `split(": ")` EN EL DOCUMENTO ═══
 *
 * Porque la frontera de su §5 es de TIPO, no de plantilla: hay una funcion para lo que ve el paciente y
 * otra para lo que ve el profesional, y asi la pantalla que llama no puede equivocarse. Si el informe
 * recortara la frase por su cuenta, o compusiera la cifra con los formateadores a mano, esa garantia
 * dejaria de estar en el tipo y pasaria a depender de que cada documento se acuerde.
 *
 * Y ES EL MISMO PRECEDENTE QUE `bandaIae`, que se separo de `textoIae` el 2026-10-29 porque una pantalla
 * necesitaba el rotulo sin la cifra: las piezas se reparten aqui, no en quien las pinta.
 *
 * LAS DOS CIFRAS SIGUEN SIENDO LAS SUYAS: `cifraEbBis` es su formato de un decimal con coma y `textoIae`
 * es su frase entera, con su banda sin tocar.
 */
export type EbBisEnPiezas = { cifra: string; iae: string } | null;

export function ebBisEnPiezas(eb: number | null, iae: number | null): EbBisEnPiezas {
  if (eb == null || iae == null) return null;
  return { cifra: `${cifraEbBis(eb)} años`, iae: textoIae(iae) };
}

/** Lo que su §5 deja SOLO para el profesional. */
export type EbBisParaElProfesional = {
  /** "EB-BIS pendiente: " mas su motivo. null cuando si se calculo. */
  pendiente: string | null;
  /** La z de pares con dos decimales, rotulada como lo que es. null cuando no se calculo. */
  zPares: string | null;
  /** Su texto del tope, o null si no se topo. */
  tope: string | null;
  /** Su texto de la alerta, o null si no se activo. */
  alerta: string | null;
};

export function ebBisParaElProfesional(r: ResultadoEbBis): EbBisParaElProfesional {
  // SU TEXTO DEL ESTADO NO CALCULABLE, literal de la tabla 3: *"'EB-BIS pendiente: ' mas el motivo
  // devuelto por la funcion"*. El motivo es el de su funcion, sin reescribir: es lo que dice QUE capturar.
  if (r.estado !== "ok") {
    return {
      pendiente: `EB-BIS pendiente: ${r.motivo ?? "no se pudo calcular"}`,
      zPares: null,
      tope: null,
      alerta: null,
    };
  }
  return {
    pendiente: null,
    zPares: r.zPares != null ? `z de pares: ${enEspanol(r.zPares, 2)}` : null,
    // Su texto del tope, literal.
    tope: r.topado ? "Valor limitado al máximo del indicador" : null,
    // Su texto de la alerta, literal. Es el unico de los cuatro que pide una accion.
    alerta: r.alertaDiscordancia
      ? "Deterioro celular mayor que el esperado con hábitos reportados favorables: verificar hábitos o cambio reciente"
      : null,
  };
}

/**
 * LA NOTA DEL DFI CUANDO LA ENCUESTA ESTA A MEDIAS. Su tabla 3, literal:
 *
 * *"Mientras la encuesta no este completa, la EB-BIS y el IAE se muestran solos con la nota 'Diagnostico
 * integrado pendiente de la encuesta'; el DFI no se genera."*
 *
 * Es lo que reemplaza a la leyenda vieja ("EB-BIS pendiente: requiere encuesta"), que su §2 declara
 * desaparecida: antes faltaba la EDAD BIOLOGICA y ahora falta el DIAGNOSTICO INTEGRADO. Son dos cosas
 * distintas y la diferencia es justo lo que la v7 cambia.
 */
export const NOTA_DFI_SIN_ENCUESTA = "Diagnóstico integrado pendiente de la encuesta";

/** Un decimal por defecto (su formato en la tabla 3), con la coma decimal del español. */
function enEspanol(n: number, decimales = 1): string {
  return n.toLocaleString("es-CO", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA ALERTA CONTEXTUAL  ·  v15, su decision 4 del 30 de octubre: "va"
//
// ═══ QUE DICE, Y POR QUE ES LA PAREJA DE LA OTRA ═══
//
// Textual suyo: *"Se activa con ICEC < 50 e IAE v7 ≥ +5 años y la ve solo el profesional. Es la pareja de
// la alerta de discordancia: aquella avisa cuando el deterioro celular no concuerda con hábitos buenos;
// esta, cuando hábitos y contexto desfavorables coinciden con envejecimiento acelerado."*
//
// O sea que las dos miran la misma pregunta por los dos lados, y por eso no se pisan: la de discordancia
// salta cuando los habitos son BUENOS y el cuerpo no acompaña; esta, cuando los dos van en la misma
// direccion mala. Pueden no salir ninguna, y nunca salen las dos.
//
// ═══ SUS DOS CORTES, Y DE DONDE SALEN ═══
//
// `ICEC < 50` y `IAE >= +5` (su v15 L15417). El segundo es el mismo corte de banda del IAE que ya vive en
// `BANDA_IAE_ANIOS`, asi que se LEE de ahi y no se escribe otra vez: el dia que el lo mueva, se mueve con
// el. El 50 es propio de esta alerta y no aparece en ningun otro sitio del modelo.
//
// Y SU PROPIO DOCUMENTO LO DICE: el umbral REEMPLAZA el `IAE > 3` de la Guia del Desarrollador v2, que
// estaba definido sobre la escala anterior de la EB-BIS. No es un ajuste de gusto: la v7 cambio la escala.
//
// ═══ LA DEPENDENCIA QUE SU DOCUMENTO NO VE, Y POR LA QUE ESTO NO SE CONSTRUYO ANTES ═══
//
// La alerta se dispara con ICEC < 50, y hasta el 2026-09-06 el componente de Alimentacion del ICEC estaba
// clavado (el interruptor `LE8_MAPEO_CORREGIDO` en false). Construirla entonces la habria hecho saltar
// sobre un ICEC que no medía lo que decía: con la alimentacion deprimida, un paciente con buenos habitos
// podia caer por debajo de 50 sin que su contexto fuera desfavorable. El interruptor esta encendido y
// medido (`le8-encendido`: la alimentacion varia, 73/44/0 en tres pacientes), asi que ahora el corte mide.
//
// SOLO PROFESIONAL, como la de discordancia: el informe del paciente no la lleva.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El corte del ICEC de esta alerta. Es suyo y propio de ella: no aparece en ningun otro sitio. */
export const CORTE_ICEC_ALERTA_CONTEXTUAL = 50;

/**
 * Su texto de la alerta contextual, o `null` si no se activa.
 *
 * `null` tambien cuando falta cualquiera de las dos cifras: una alerta que afirma sobre un paciente no se
 * emite con un dato ausente leido como cero. Es la misma regla que el resto del motor.
 *
 * EL TEXTO LLEVA LAS DOS CIFRAS, como en su archivo: sin ellas la alerta afirma algo que el profesional no
 * puede cotejar con lo que tiene delante.
 */
export function alertaContextual(icecTotal: number | null, iae: number | null): string | null {
  if (icecTotal == null || iae == null) return null;
  if (!(icecTotal < CORTE_ICEC_ALERTA_CONTEXTUAL && iae >= BANDA_IAE_ANIOS)) return null;
  return (
    "Alerta contextual: envejecimiento bioeléctrico acelerado con carga epigenética alta " +
    `(ICEC ${Math.round(icecTotal)} < ${CORTE_ICEC_ALERTA_CONTEXTUAL} e IAE ≥ +${BANDA_IAE_ANIOS} años)`
  );
}
