import type { PuntoDelPaciente } from "./data/serie-del-paciente";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE CAMBIO DESDE LA CONSULTA ANTERIOR, EN PALABRAS  ·  MODULO NEUTRO Y PURO
//
// ═══ DE DONDE SALE (una nutricionista, via Santiago, 2026-10-28) ═══
//
// *"Si el paciente va para seguimiento, animarlo comparando el seguimiento con la consulta anterior... Algo
// que el paciente entienda que mejoro para que se animen con el tratamiento."*
//
// El informe YA traia la grafica de trayectoria ("Como has cambiado"), y una grafica de tres lineas no es
// lo mismo que una frase: hay que leerla, compararla con la vista y deducir. Esto pone el cambio EN
// PALABRAS, que es lo que la nutricionista pide.
//
// ═══ LAS TRES REGLAS QUE LO MANTIENEN DENTRO DE LO QUE PODEMOS DECIR ═══
//
// 1 · SOLO MEDIDAS, NUNCA INDICES DEL MODELO. Peso, masa grasa y masa muscular son lo que el equipo le
//     imprime al paciente y lo que el reconoce de su propio cuerpo. El IFC, el IRC, la PABU, el angulo de
//     fase y la capacitancia NO van: §7.1 de Gildardo es literal ("ningun indice del modelo va al
//     paciente"). Por eso esto no toca la capacitancia aunque se pidiera: es un indice electrico.
//     Tampoco la EB-BIS, que ademas esta en revision (v7).
//
// 2 · NO SE ESCONDE LO QUE EMPEORO. Un informe que solo muestra lo que mejoro deja de ser un informe. Se
//     dice el cambio en los dos sentidos, con la misma frialdad, SIN adjetivos y SIN veredicto.
//
// 3 · EL VEREDICTO YA LO DA GILDARDO, arriba, en la banda de trayectoria ("evolucion favorable...", texto
//     suyo verbatim). Este bloque pone la CIFRA concreta debajo. Que una parte juzgue y la otra mida es
//     deliberado: si aqui se escribiera "bien" o "sigue asi", seria contenido clinico nuestro.
//
// ═══ 4 · HAY UN PISO, Y NO ES NUESTRO POR GUSTO (Santiago, 2026-10-28) ═══
//
// La primera version no tenia piso: redondeaba a una decima y, si daba cero, decia "practicamente igual".
// Santiago lo corrigio: *"un cambio de 0,1 kg esta dentro del error de medicion, y decirle 'bajaste 0,1 kg
// de grasa' lo anima con algo que no ocurrio."* Tiene razon, y es peor que un numero feo: es animar a
// alguien con un hecho que no paso.
//
// PIDIO REUSAR "los cortes que ya tiene la banda de trayectoria", Y ESE CORTE NO SIRVE AQUI: el unico que
// la banda tiene es `EB_CHANGE_BAND_YEARS` = 2, y son DOS AÑOS DE EB-BIS, no kilos. No hay forma de
// convertirlo. Y la banda tampoco puede gobernar estas tres frases: un paciente puede tener la EB sin
// cambio y haber bajado 4 kg de grasa de verdad, y entonces diriamos "sin cambio" sobre algo que si paso.
//
// ASI QUE EL PISO ES NUESTRO, Y SE DECLARA COMO TAL, igual que `EB_CHANGE_BAND_YEARS` se declara
// "operativo y provisional". La pieza que lo reemplaza es el CAMBIO MINIMO DETECTABLE, que esta preguntado
// a Gildardo desde el 2026-08-24 (§9.1 de esa ronda, donde ademas le ofrecimos el CV% del BiodyXpert como
// via corta). Mientras no responda, ningun numero de aqui es un hecho clinico.
//
// UNO SOLO PARA LAS TRES MEDIDAS, y no tres: el peso sale de una balanza y la grasa y el musculo son
// estimaciones de bioimpedancia, asi que su error NO es el mismo y lo correcto serian tres cifras. Pero
// tres cifras nuestras sin fuente son tres veces el mismo problema; una sola, declarada, es una sola cosa
// que corregir el dia que el dato llegue.
//
// ═══ 5 · Y DEBAJO DEL PISO NO SE DICE "SE MANTUVO ESTABLE" ═══
//
// Santiago pidio esa redaccion. Se usa otra, y no es preferencia: es lo que ya le respondimos a Gildardo en
// §9.1, literal. *"Un valor que no cambia puede ser dos cosas muy distintas: el paciente se mantuvo
// estable, que es informacion clinica real; o el cambio fue mas pequeño de lo que la medicion distingue, y
// entonces no sabemos nada. Sin saber cual de las dos, 'se mantuvo estable' afirma mas de lo que tenemos.
// Por eso, mientras respondes, nuestra pantalla va a decir 'sin cambio respecto de la medicion anterior',
// sin calificarlo."*
//
// Debajo del piso estamos EXACTAMENTE en ese caso. Decir "se mantuvo estable" seria afirmar la primera de
// las dos lecturas sin poder distinguirla de la segunda, en el documento del paciente y por encima de lo
// que ya le respondimos a la Direccion Cientifica.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * El cambio mas pequeño que se nombra, en kilos. PROVISIONAL Y NUESTRO.
 *
 * Lo reemplaza el cambio minimo detectable de Gildardo cuando responda (§9.1 de la ronda del 2026-08-24).
 * Hasta entonces cubre con margen el caso que Santiago nombro (0,1 kg) y se queda por debajo de cualquier
 * cambio sobre el que alguien actuaria, asi que lo unico que calla es lo que nadie usaria.
 *
 * NO SE SELLA EN EL REPORTE todavia, a diferencia de `EB_CHANGE_BAND_YEARS`: estas frases se arman al
 * RENDERIZAR desde la serie viva, no se guardan. Si algun dia se sellan, este valor va con ellas, por el
 * mismo motivo que el otro (reconstruir con que corte se emitio cada frase).
 */
export const CAMBIO_MINIMO_KG = 0.5;

export type CambioDeUnaMedida = {
  /** "Peso", "Masa grasa", "Masa muscular". */
  medida: string;
  /** La frase completa, lista para pintar. */
  texto: string;
};

/** Una decima, que es la resolucion con la que el equipo entrega estas tres medidas. */
const redondear = (n: number) => Math.round(n * 10) / 10;

const enEspanol = (n: number) => Math.abs(n).toLocaleString("es-CO", { maximumFractionDigits: 1 });

/**
 * El cambio entre las DOS ULTIMAS mediciones de la serie, en frases.
 *
 * Vacio cuando no hay dos mediciones que comparar, o cuando ninguna de las tres medidas esta en las dos:
 * un bloque vacio es peor que ninguno.
 *
 * LAS DOS ULTIMAS Y NO LA PRIMERA CONTRA LA ULTIMA: la nutricionista pidio comparar "con la consulta
 * anterior". El recorrido completo ya esta en la grafica, que si lleva todos los puntos.
 */
export function cambioDesdeLaAnterior(serie: readonly PuntoDelPaciente[]): CambioDeUnaMedida[] {
  if (serie.length < 2) return [];
  const actual = serie[serie.length - 1];
  const previa = serie[serie.length - 2];

  const medidas: { medida: string; unidad: string; hoy: number | null; antes: number | null }[] = [
    { medida: "Peso", unidad: "kg", hoy: actual.pesoKg, antes: previa.pesoKg },
    { medida: "Masa grasa", unidad: "kg", hoy: actual.grasaKg, antes: previa.grasaKg },
    { medida: "Masa muscular", unidad: "kg", hoy: actual.magraKg, antes: previa.magraKg },
  ];

  const salida: CambioDeUnaMedida[] = [];
  for (const m of medidas) {
    // SIN LAS DOS MEDICIONES NO HAY CAMBIO QUE CONTAR, y no se rellena con un cero: una medida que no se
    // tomo no es una medida que no cambio.
    if (m.hoy == null || m.antes == null) continue;
    const delta = redondear(m.hoy - m.antes);
    const hoy = enEspanol(m.hoy);
    // DEBAJO DEL PISO SE DICE QUE NO HUBO CAMBIO, NO QUE SE MANTUVO ESTABLE: ver el punto 5 de la cabecera.
    // Se compara el delta REDONDEADO para que la frase no contradiga a la cifra que la acompaña.
    if (Math.abs(delta) < CAMBIO_MINIMO_KG) {
      salida.push({
        medida: m.medida,
        texto: `${m.medida}: ${hoy} ${m.unidad}, sin cambio respecto de tu consulta anterior.`,
      });
      continue;
    }
    const direccion = delta < 0 ? "menos" : "más";
    salida.push({
      medida: m.medida,
      texto: `${m.medida}: ${hoy} ${m.unidad}, ${enEspanol(delta)} ${m.unidad} ${direccion} que en tu consulta anterior.`,
    });
  }
  return salida;
}
