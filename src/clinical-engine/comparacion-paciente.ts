import type { DominioPaciente } from "./dfi-paciente";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA COMPARACION CON LA CONSULTA ANTERIOR, EN EL LENGUAJE DEL PACIENTE  ·  PURO  ·  Santiago, 2026-11-06
//
// ═══ DE DONDE SALE, Y QUE SACA DEL DOCUMENTO ═══
//
// Santiago reviso el informe despues del push y pidio que la hoja de seguimiento deje de hablar en
// medidas: *"El paciente no quiere saber eso, simplemente un resumen de que mejoro y que debe seguir
// mejorando en terminos simples. No utilizar terminos asi como masa grasa, etc. Simplemente, cosas como
// 'estuviste mas cerca de alcanzar la meta de peso X'."*
//
// Con eso salen del informe la grafica de las tres medidas y las tres frases de kilos, y entra esto: el
// cambio por AREA y un parrafo que anima sin mentir.
//
// ═══ LAS CUATRO REGLAS QUE LO MANTIENEN DENTRO DE LO QUE PODEMOS DECIR ═══
//
// 1 · NINGUNA FRASE SE GENERA CON IA. Son frases FIJAS por resultado, elegidas con un `switch`. El informe
//     no puede decir lo que la profesional no dijo, y un texto generado dice algo distinto cada vez sobre
//     el mismo hecho, sin que nadie lo haya aprobado.
//
// 2 · NO SE ESCONDE LO QUE EMPEORO. Si un area empeoro, lo dice. Animar a alguien diciendole que mejoro
//     cuando no mejoro es peor que no animarlo: la siguiente consulta lo desmiente.
//
// 3 · NI UN TERMINO TECNICO. Ni "masa grasa", ni "severidad", ni "dominio", ni el nombre de un indice. Las
//     areas se nombran como las nombra su mapa de paciente (`dfiParaPaciente`), que es texto de Gildardo.
//
// 4 · LA META DE PESO SOLO SI ESTA REGISTRADA, y la frase va EN LA DIRECCION DE ESA META. Sin meta
//     registrada no se nombra ninguna: la direccion "buena" no se puede deducir del peso (bajar es bueno
//     para unos y malo para otros), y elegirla por nuestra cuenta seria decidir una meta clinica.
//
// ═══ LO QUE ES NUESTRO Y ESPERA LA PALABRA DE GILDARDO ═══
//
// Las frases de abajo las escribimos nosotros. No hay texto suyo para "esta area mejoro" ni para el
// parrafo de animo, y Santiago los pidio. Van declaradas como provisionales y entran a
// `PENDIENTES_CIENTIFICOS.md` para que el las apruebe o las reescriba, igual que se hizo con la banda de
// trayectoria (donde el texto SI es suyo, verbatim, y por eso no se toca).
//
// Y EL UMBRAL DE CAMBIO POR AREA TAMBIEN SE DECLARA: es UNA CATEGORIA de severidad, o sea la escala que ya
// existe. No se invento un numero: las areas no vienen con una cifra continua, vienen clasificadas en
// cuatro niveles por su clasificador, asi que el cambio mas pequeño que existe es pasar de un nivel a
// otro. Si Gildardo decide que un area no cambio "de verdad" hasta dos niveles, se cambia aqui.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El cambio mas pequeño que se nombra en kilos. PROVISIONAL Y NUESTRO.
 *
 * VIENE DE `cambio-desde-la-anterior.ts`, que se retiro con la grafica de las tres medidas, y se conserva
 * con su razon entera porque la razon sigue viva: lo reemplaza el cambio minimo detectable de Gildardo
 * cuando responda (§9.1 de la ronda del 2026-08-24). Lo pidio Santiago el 2026-10-28: *"un cambio de 0,1 kg
 * esta dentro del error de medicion, y decirle 'bajaste 0,1 kg de grasa' lo anima con algo que no
 * ocurrio."* Aqui solo gobierna la frase de la meta de peso, que es la unica cifra en kilos que queda.
 */
export const CAMBIO_MINIMO_KG = 0.5;

/**
 * El cambio mas pequeño que cuenta como cambio en un area: UNA categoria de severidad.
 *
 * Es la escala que ya existe, no un umbral nuevo: las areas salen clasificadas en cuatro niveles por el
 * clasificador de Gildardo (0 a 3), asi que el cambio mas pequeño posible es pasar de un nivel al
 * siguiente. Queda como constante para que, si el decide que hacen falta dos, sea una linea.
 */
export const CAMBIO_MINIMO_AREA = 1;

export type CambioDeArea = {
  /** El nombre del area tal como lo nombra su mapa de paciente. */
  area: string;
  cambio: "mejoro" | "sin_cambio" | "retrocedio" | "sin_comparacion";
  /** La frase lista para pintar. Sin terminos tecnicos. */
  frase: string;
};

/** Frases FIJAS por resultado. Nuestras, provisionales: ver la cabecera. */
const FRASE_DE_AREA: Record<Exclude<CambioDeArea["cambio"], "sin_comparacion">, string> = {
  mejoro: "Mejoró desde tu consulta anterior.",
  sin_cambio: "Está igual que en tu consulta anterior.",
  retrocedio: "Es la que conviene trabajar primero.",
};

const FRASE_SIN_COMPARACION = "No se puede comparar con tu consulta anterior.";

/**
 * El cambio de cada area entre esta consulta y la anterior.
 *
 * `anteriores` es el mapa de severidad por ID de area de la consulta anterior. SE COMPARA POR ID Y NO POR
 * POSICION: el sello anterior puede traer las areas en otro orden o con alguna ausente, y alinear por
 * posicion compararia el area de conducta de hoy con la metabolica de entonces, dibujando algo creible.
 *
 * SEVERIDAD MAS BAJA ES MEJOR (0 = optimo), asi que una severidad que baja es una mejora.
 *
 * UN AREA SIN DATO EN CUALQUIERA DE LAS DOS CONSULTAS NO SE COMPARA, y lo dice en vez de callar: un area
 * que no se midio no es un area que no cambio.
 */
export function compararAreas(
  actuales: readonly DominioPaciente[],
  anteriores: Readonly<Record<string, number>>,
): CambioDeArea[] {
  return actuales.map((d) => {
    const antes = anteriores[d.id];
    if (d.sev == null || antes == null) {
      return { area: d.dominio, cambio: "sin_comparacion", frase: FRASE_SIN_COMPARACION };
    }
    const delta = d.sev - antes;
    const cambio: CambioDeArea["cambio"] =
      delta <= -CAMBIO_MINIMO_AREA ? "mejoro" : delta >= CAMBIO_MINIMO_AREA ? "retrocedio" : "sin_cambio";
    return { area: d.dominio, cambio, frase: FRASE_DE_AREA[cambio] };
  });
}

/** Cuantas areas mejoraron, se mantuvieron y retrocedieron. Para el parrafo de animo. */
export function contarAreas(cambios: readonly CambioDeArea[]): {
  mejoraron: number;
  igual: number;
  retrocedieron: number;
  comparadas: number;
} {
  const mejoraron = cambios.filter((c) => c.cambio === "mejoro").length;
  const igual = cambios.filter((c) => c.cambio === "sin_cambio").length;
  const retrocedieron = cambios.filter((c) => c.cambio === "retrocedio").length;
  return { mejoraron, igual, retrocedieron, comparadas: mejoraron + igual + retrocedieron };
}

// ─── LA EDAD BIOLOGICA ESTIMADA, HOY CONTRA LA CONSULTA ANTERIOR ───────────────────────────────────

export type ComparacionDeLaEdad =
  | {
      estado: "comparable";
      /** Años de diferencia: NEGATIVO es mejor (mas baja = mas joven). */
      delta: number;
      /** La frase del cambio, sin veredicto: el veredicto lo da el texto de Gildardo que va al lado. */
      frase: string;
    }
  | { estado: "sin_comparacion"; porque: string };

/**
 * Compara la edad biologica estimada de hoy con la de la consulta anterior, o dice por que no se puede.
 *
 * ═══ POR QUE ESTO NO EMITE VEREDICTO ═══
 *
 * El veredicto de la evolucion ya existe y es de Gildardo: la banda de trayectoria (`BAND_TEXT`), con su
 * corte de dos años y su gate de confirmacion del profesional para el "empeoro". Escribir aqui un segundo
 * juicio sobre la misma resta seria dos fuentes del mismo veredicto, y ademas una sin su gate: un
 * empeoramiento le llegaria al paciente sin que nadie lo decidiera, que es justo lo que ese gate evita.
 * Asi que esto dice el HECHO (cuantos años, en que direccion) y el veredicto va arriba, suyo.
 *
 * ═══ LOS DOS MOTIVOS PARA NO COMPARAR, Y POR QUE SE DISTINGUEN ═══
 *
 * Que la consulta anterior no traiga la cifra se resuelve con el recalculo de la cohorte (la cifra
 * aparecera). Que su motor sea de otra version MAYOR no se resuelve esperando: hay que recalcular esa
 * consulta. Al paciente no se le explica la diferencia, pero el texto no puede decirle que no hay con que
 * comparar cuando lo que pasa es que no se puede restar.
 *
 * `mismaEscala` lo decide el llamador con `sonComparables` (la version MAYOR del motor), que es donde ya
 * vive ese criterio.
 */
export function comparacionDeLaEdad(input: {
  ebHoy: number | null;
  ebAnterior: number | null;
  mismaEscala: boolean;
}): ComparacionDeLaEdad {
  if (input.ebHoy == null) {
    return {
      estado: "sin_comparacion",
      porque: "Esta consulta todavía no tiene la estimación, así que no hay con qué comparar.",
    };
  }
  if (input.ebAnterior == null) {
    return {
      estado: "sin_comparacion",
      porque:
        "Tu consulta anterior es de antes de que se actualizara la forma de estimar esta cifra, así que todavía no se puede comparar.",
    };
  }
  if (!input.mismaEscala) {
    return {
      estado: "sin_comparacion",
      porque:
        "Tu consulta anterior se calculó con una versión distinta del modelo, así que las dos cifras no se comparan directamente.",
    };
  }
  const delta = Math.round((input.ebHoy - input.ebAnterior) * 10) / 10;
  const frase =
    delta < 0
      ? `${unDecimal(delta)} años menos que en tu consulta anterior.`
      : delta > 0
        ? `${unDecimal(delta)} años más que en tu consulta anterior.`
        : "Igual que en tu consulta anterior.";
  return { estado: "comparable", delta, frase };
}

export type MetaDePeso = {
  /** La meta REGISTRADA por el profesional, en kg. Sin ella no se nombra ninguna meta. */
  metaKg: number;
  pesoHoyKg: number;
  pesoAnteriorKg: number;
};

const unDecimal = (n: number) => Math.abs(Math.round(n * 10) / 10).toLocaleString("es-CO", { maximumFractionDigits: 1 });

/**
 * La frase de la meta de peso, o null si no se puede decir nada honesto.
 *
 * SOLO SI HAY META REGISTRADA (ver la regla 4 de la cabecera), y SIEMPRE en la direccion de esa meta: se
 * mide si la DISTANCIA a la meta se acorto, no si el peso subio o bajo. Asi la frase es correcta tanto
 * para quien tiene que bajar como para quien tiene que subir, sin que nadie tenga que decidirlo aqui.
 *
 * Y CON EL PISO DE `CAMBIO_MINIMO_KG`: un acercamiento de 0,2 kg esta dentro del error de medicion, y
 * felicitar a alguien por eso lo anima con algo que no ocurrio.
 */
export function fraseDeLaMeta(meta: MetaDePeso | null): string | null {
  if (!meta) return null;
  const faltaHoy = Math.abs(meta.pesoHoyKg - meta.metaKg);
  const faltaAntes = Math.abs(meta.pesoAnteriorKg - meta.metaKg);
  const acercamiento = faltaAntes - faltaHoy;
  const meta1 = unDecimal(meta.metaKg);
  if (Math.abs(acercamiento) < CAMBIO_MINIMO_KG) {
    return `Tu meta de peso es ${meta1} kg y sigues a la misma distancia que en tu consulta anterior.`;
  }
  if (acercamiento > 0) {
    // SI YA LA ALCANZO, no se dice "te acercaste": se dice que llego.
    if (faltaHoy < CAMBIO_MINIMO_KG) return `Alcanzaste tu meta de peso de ${meta1} kg.`;
    return `Te acercaste ${unDecimal(acercamiento)} kg a tu meta de peso de ${meta1} kg: te faltan ${unDecimal(faltaHoy)} kg.`;
  }
  return `Te alejaste ${unDecimal(acercamiento)} kg de tu meta de peso de ${meta1} kg: te faltan ${unDecimal(faltaHoy)} kg.`;
}

/**
 * El parrafo de animo de la hoja de seguimiento. Frases FIJAS, elegidas por el resultado.
 *
 * HONESTO POR CONSTRUCCION: la primera frase la elige el conteo de areas, asi que no hay forma de que
 * diga "mejoraste" cuando ninguna mejoro. Si todas retrocedieron, lo nombra y empuja a la consulta, que
 * es lo util; no inventa un lado bueno.
 *
 * SIN TERMINOS TECNICOS y sin veredicto clinico: el veredicto de la evolucion lo da el texto de Gildardo
 * (la banda de trayectoria), que va encima y es verbatim suyo. Esto es lo que lo acompaña.
 */
export function parrafoDeAnimo(
  cambios: readonly CambioDeArea[],
  meta: MetaDePeso | null,
): string {
  const { mejoraron, retrocedieron, comparadas } = contarAreas(cambios);
  const partes: string[] = [];

  if (comparadas === 0) {
    partes.push(
      "Esta es tu primera comparación con datos suficientes, así que todavía no se puede decir cómo has cambiado área por área.",
    );
  } else if (mejoraron > 0 && retrocedieron === 0) {
    partes.push(
      mejoraron === comparadas
        ? "Todas las áreas que se pudieron comparar mejoraron desde tu consulta anterior. Sigue así."
        : `Mejoraste en ${mejoraron === 1 ? "un área" : `${mejoraron} áreas`} y en el resto te mantienes. Sigue así.`,
    );
  } else if (mejoraron > 0 && retrocedieron > 0) {
    partes.push(
      `Mejoraste en ${mejoraron === 1 ? "un área" : `${mejoraron} áreas`} y ${retrocedieron === 1 ? "hay una" : `hay ${retrocedieron}`} que conviene trabajar. Lo que ya lograste cuenta.`,
    );
  } else if (retrocedieron > 0) {
    partes.push(
      "Esta vez el avance no se ve en las áreas que se pudieron comparar. No empiezas de cero: lo que viene es ajustar el plan con quien te atiende.",
    );
  } else {
    partes.push(
      "Tus áreas se mantienen igual que en tu consulta anterior. Mantener lo logrado también es un resultado.",
    );
  }

  const frase = fraseDeLaMeta(meta);
  if (frase) partes.push(frase);
  partes.push("Lo que sigue lo defines con quien te atiende en tu próxima consulta.");
  return partes.join(" ");
}
