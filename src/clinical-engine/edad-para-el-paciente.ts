import { bandaIae, cifraEbBis, cifraIae } from "./presentacion-eb-bis";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA EDAD BIOLOGICA, CONTADA AL PACIENTE  ·  2026-11-06
//
// Santiago, tras ver el informe de una paciente real:
//
//     "La edad biologica: 76,4 años grande; debajo, la edad real del paciente; 'Tu cuerpo se comporta
//      como el de alguien X años mayor/menor que las personas de tu edad: <texto de banda>'."
//
// ═══ LO QUE ES NUESTRO Y LO QUE ES SUYO, que es la frontera que importa ═══
//
// La CIFRA, el IAE y la BANDA son de Gildardo (tabla 3, via `presentacion-eb-bis`): no se recortan, no se
// reescriben y no se recomponen a mano. Lo nuestro es el ARMAZON de la frase, que es redaccion para el
// paciente, no contenido clinico. La banda entra verbatim al final, despues de los dos puntos.
//
// ═══ LA EDAD REAL NO HACE FALTA PEDIRLA: SALE DE SU PROPIA FORMULA ═══
//
// La v7 calcula `EB = edad + IAE` (`eb-bis-v7.js` L38). O sea que la edad cronologica es `EB - IAE`,
// exacta. No viaja en el snapshot (`EngineOutput` no la lleva; esta en `EngineInput`), y pedirla por otro
// camino seria agregar un dato a la cadena para recuperar uno que ya esta.
//
// SE REDONDEA A ENTERO porque lo es: la v7 EXIGE `Number.isInteger(edad)` y rechaza lo demas
// (`eb-bis-v7.js` L20). Las dos cifras vienen redondeadas a un decimal, asi que la resta puede dar 63,9
// o 64,1 donde la edad es 64; el redondeo devuelve el entero original y no inventa precision.
//
// ═══ CONTRA QUIEN SE COMPARA, Y POR QUE NO DICE LO QUE SANTIAGO ESCRIBIO ═══
//
// Su nota pedia *"'de tu mismo sexo y edad', no 'edad y composicion' (la v7 compara con eso)"*. La mitad
// es correcta y la otra mitad no, y conviene que quede escrito aqui porque es una afirmacion sobre el
// paciente:
//
//   El valor esperado de la v7 es `Sesp = b0 + b1*edad + b2*edad² + b3*FMI`, con un juego de parametros
//   POR SEXO (`eb-bis-v7.js` L11-L14 y L34). O sea que el grupo de comparacion son personas del mismo
//   SEXO, la misma EDAD **y la misma COMPOSICION** (el FMI es indice de masa grasa).
//
// Asi que el sexo SI faltaba, y la composicion NO sobra: esta en la regresion. La frase los nombra los
// tres. Decir "de tu mismo sexo y edad" describiria un modelo que no es el que calculo su numero.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Contra quien compara la v7, en una frase. Los tres terminos de su valor esperado, sin jerga. */
export const CONTRA_QUIEN_SE_COMPARA =
  "personas de tu mismo sexo, tu misma edad y tu misma composición corporal";

export type EdadParaElPaciente = {
  /** "76,4 años": su cifra, para la pieza grande. */
  cifra: string;
  /** "Tu edad: 64 años". null si no se pudo derivar. */
  edadReal: string | null;
  /** La frase completa, con su banda verbatim al final. */
  frase: string;
};

/**
 * La edad biologica tal como se le cuenta al paciente. `null` cuando no hay cifra que contar.
 */
export function edadParaElPaciente(eb: number | null, iae: number | null): EdadParaElPaciente | null {
  if (eb == null || iae == null) return null;

  const edad = Math.round(eb - iae);
  // Un entero fuera del rango que la v7 admite (18 a 100) significa que algo no cuadra en las cifras
  // selladas; se calla la edad real en vez de imprimir un numero imposible al lado de la buena.
  const edadReal = edad >= 18 && edad <= 100 ? `Tu edad: ${edad} años` : null;

  const anios = Math.abs(iae);
  // ═══ AQUI VA LA FRASE CORTA DE SANTIAGO, Y EL GRUPO COMPLETO VA UNA SOLA VEZ, DEBAJO ═══
  //
  // La primera version nombraba el grupo de comparacion entero en las DOS frases (esta y la explicacion
  // del modelo que va al pie del bloque). Decia lo mismo dos veces en cuatro lineas, y ademas empujaba la
  // hoja 1 a una segunda hoja. Asi que esta se queda con sus palabras ("que las personas de tu edad") y
  // la de abajo, que es la que explica de donde sale el numero, lleva los tres terminos reales.
  //
  // EL CERO NO SE DICE COMO "0,0 años mayor": a un paciente eso no le dice nada. Se cuenta sin la cifra,
  // que es lo que el numero significa (se comporta como su grupo).
  const comparacion =
    anios < 0.05
      ? "Tu cuerpo se comporta como el de las personas de tu edad"
      : `Tu cuerpo se comporta como el de alguien ${cifraIae(iae).replace(/^[+-]/, "")} años ${
          iae > 0 ? "mayor" : "menor"
        } que las personas de tu edad`;

  // LA BANDA, VERBATIM Y AL FINAL, despues de los dos puntos: es el veredicto de su tabla 3 y entra sin
  // tocar. Si algun dia cambia su texto, cambia aqui solo porque cambio en su sitio.
  return { cifra: `${cifraEbBis(eb)} años`, edadReal, frase: `${comparacion}: ${bandaIae(iae)}.` };
}
