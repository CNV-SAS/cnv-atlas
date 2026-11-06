// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS CINCO LECTURAS DEL DFI, EN LENGUAJE DE PACIENTE  ·  PROVISIONAL, NUESTRAS  ·  2026-11-06
//
// ═══ ESTO ES UNA EXCEPCION DECLARADA A LA REGLA 0, Y HAY QUE LEERLA ASI ═══
//
// Las veinte lecturas del DFI son texto clinico de Gildardo y viven en el motor congelado
// (`engine.dfi.js`). La regla de esta casa es que no se editan, no se resumen y no se reinterpretan desde
// nuestro lado. Por eso el informe las llevaba tal cual, y por eso un paciente leia esto:
//
//     "Funcion celular comprometida con microambiente hostil."
//     "Susceptibilidad cardiometabolica alta; fenotipo de riesgo."
//     "Carga contextual amplificada por antecedentes o entorno."
//
// La pregunta 16 del documento de dudas (la 13 en la numeracion consolidada de PENDIENTES) le pide a el
// las suyas, con nuestra recomendacion de que las escriba o las corrija. Mientras no responda, Santiago
// decidio el 2026-11-06 aplicar la propuesta MARCADA COMO PROVISIONAL, porque un informe que el paciente
// no entiende no cumple su funcion ni esperando.
//
// ═══ LO QUE ESTA EXCEPCION NO TOCA, QUE ES LO QUE LA HACE REVERSIBLE ═══
//
//   · EL MOTOR NO SE TOCA. Las veinte lecturas de `engine.dfi.js` siguen intactas y con su candado de
//     diferencia byte a byte.
//   · EL PROFESIONAL SIGUE LEYENDO LAS SUYAS. Esta capa es SOLO del documento del paciente; la pantalla
//     del profesional, la historia clinica y el snapshot siguen con el texto clinico.
//   · EL MAPA DE GILDARDO (`dfi-paciente.ts`) TAMPOCO SE TOCA. Ese archivo es un porte verbatim de SU
//     `_dfiPac`, y mezclar ahi lo nuestro borraria la frontera entre lo que escribio el y lo que
//     escribimos nosotros. Por eso esto vive en un archivo aparte, que se BORRA de una pieza el dia que
//     el conteste.
//   · SU REGLA DEL DOMINIO CONDUCTUAL MANDA SOBRE ESTA CAPA. Cuando `d4` tiene severidad alta, el decidio
//     que al paciente no se le nombra la conducta de riesgo sino que se le dice que lo van a acompañar.
//     Esa sustitucion se hace ANTES y esta capa no la pisa: por eso aqui no hay texto para `d4` en 2 y 3.
//
// ═══ LAS REGLAS CON LAS QUE SE ESCRIBIERON, para que una correccion futura las mantenga ═══
//
//   1 · UNA POR NIVEL, LOS CUATRO. Su mapa tiene cuatro severidades por dominio y la propuesta de la
//       pregunta 16 traia UN ejemplo por dominio, cada uno de un nivel distinto. Aplicar solo esos cinco
//       habria dejado quince lecturas en jerga y cinco en castellano, que es peor que las veinte iguales.
//   2 · NI UN TERMINO TECNICO. Nada de "masa grasa", "fenotipo", "homeostasis", "microambiente",
//       "epigenetica" ni "cardiometabolico".
//   3 · NO SE SUAVIZA LA GRAVEDAD. Un nivel 3 dice que hace falta atencion; traducir "comprometida" por
//       "algo baja" seria mentirle al paciente, que es lo contrario de lo que esto viene a arreglar.
//   4 · NO SE AGREGA NADA QUE LA LECTURA NO DIGA. Ni causas, ni pronostico, ni que hacer: lo que hay que
//       hacer lo dice el profesional en la consulta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Marca que estos textos son nuestros y provisionales. La lee el candado, y PENDIENTES la cita. */
export const LECTURAS_SENCILLAS_SON_PROVISIONALES = true;

/**
 * Por dominio, las cuatro severidades (indices 0 a 3) en orden de MEJOR a PEOR, igual que su `_SEVPAC`.
 * `null` = esta capa no habla de ese caso y manda lo de antes.
 */
const SENCILLAS: Record<string, readonly (string | null)[]> = {
  // d1 · Celular-Eléctrico. Su lectura habla de membranas, microambiente y función celular.
  d1: [
    "Tus células están bien hidratadas y sus membranas en buen estado.",
    "Tus células están bien, con una señal de riesgo que conviene observar.",
    "Tus células están bajo presión: conviene vigilar cómo evolucionan.",
    "El estado de tus células está afectado y necesita atención.",
  ],
  // d2 · Metabólico-Estructural. Su lectura habla de proporción músculo/grasa y de riesgo cardiometabólico.
  d2: [
    "Tu músculo y tu grasa están en una proporción favorable.",
    "Hay una señal leve, de las que se corrigen bien cuando se atienden a tiempo.",
    "La proporción entre tu músculo y tu grasa conviene corregirla.",
    "Tienes un riesgo alto para tu corazón y para cómo tu cuerpo maneja la energía.",
  ],
  // d3 · Envejecimiento. Su lectura habla del ritmo de envejecimiento biológico.
  d3: [
    "Tu cuerpo se desgasta al ritmo que corresponde a tu edad, o más despacio.",
    "Tu ritmo de desgaste está en el límite de lo esperado para tu edad.",
    "Tu cuerpo se está desgastando más rápido de lo que corresponde a tu edad.",
    "Tu cuerpo se está desgastando mucho más rápido de lo que corresponde a tu edad.",
  ],
  // d4 · Conductual-Perceptual. En 2 y 3 manda SU frase de acompañamiento, que ya sustituye la lectura:
  // esta capa calla a proposito, y ese `null` no es un hueco sino el limite de la excepcion.
  d4: [
    "Tu relación con la comida y con tu cuerpo no muestra señales de alarma.",
    "Hay una señal en tu relación con la comida que conviene vigilar.",
    null,
    null,
  ],
  // d5 · Epigenético-Contextual. Su lectura habla de antecedentes, entorno y barreras del contexto.
  d5: [
    "Tu estilo de vida y tu entorno te protegen.",
    "Tu entorno te suma algo de riesgo, y es de lo que se puede cambiar.",
    "Tus antecedentes familiares y tu entorno te suman riesgo.",
    "Tus antecedentes familiares y tu entorno te suman un riesgo alto.",
  ],
};

/**
 * La lectura en lenguaje sencillo de un dominio, o `null` si esta capa no habla de ese caso (un dominio
 * sin medir, una severidad fuera de escala, o el conductual alto, donde manda la frase de Gildardo).
 *
 * DEVUELVE `null` Y NO UN TEXTO DE RELLENO, que es la misma regla que su mapa: lo que no se traduce se
 * deja como esta. Quien llama hace `lecturaSencilla(...) ?? d.lectura`, asi que si esta capa desaparece
 * el informe vuelve solo al texto clinico sin dejar huecos.
 */
export function lecturaSencilla(idDominio: string, sev: number | null): string | null {
  if (sev == null) return null;
  const porNivel = SENCILLAS[idDominio];
  if (!porNivel) return null;
  // Su propia escala: la severidad se topa en 3, porque su codigo evalua `s >= 3` como el peor caso.
  const i = Math.max(0, Math.min(3, Math.trunc(sev)));
  return porNivel[i] ?? null;
}
