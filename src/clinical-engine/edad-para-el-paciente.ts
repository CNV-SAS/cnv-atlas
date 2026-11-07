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
// ═══ Y EL GRUPO DE COMPARACION YA NO SE NOMBRA EN EL INFORME (Santiago, 2026-11-07) ═══
//
// Hasta el 7 de noviembre el informe traia debajo de la cifra un parrafo que decia con quien se compara
// al paciente ("personas de tu mismo sexo, tu misma edad y tu misma composicion corporal"). Su punto c lo
// marco como texto que sobra y salio, con su constante.
//
// QUEDA ESCRITO EL RAZONAMIENTO, porque es una afirmacion sobre el paciente y el dia que alguien vuelva a
// redactar esa frase va a tropezar con lo mismo: su nota pedia *"'de tu mismo sexo y edad', no 'edad y
// composicion' (la v7 compara con eso)"*, y la mitad es correcta y la otra no. El valor esperado de la v7
// es `Sesp = b0 + b1*edad + b2*edad² + b3*FMI`, con un juego de parametros POR SEXO (`eb-bis-v7.js`
// L11-L14 y L34), asi que el grupo son personas del mismo SEXO, la misma EDAD **y la misma COMPOSICION**
// (el FMI es indice de masa grasa). El sexo SI faltaba, y la composicion NO sobra: esta en la regresion.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LA MEDIA LINEA DE SEGURIDAD, QUE AHORA ES SU PROPIA PIEZA (Santiago, 2026-11-07).
 *
 * Hasta hoy viajaba pegada al final de `frase`, asi que se imprimia al mismo cuerpo y en la misma negrita
 * que el veredicto. Su cuadro nuevo la pide *"en letra pequeña"*, debajo y aparte: es una advertencia
 * sobre como leer la cifra, no parte del veredicto, y al mismo tamaño las dos cosas compiten.
 *
 * EL ORIGEN ("a partir de tu medición") VIAJA AQUI PARA LAS TRES VARIANTES, y eso resuelve de paso la
 * excepcion que habia: hasta hoy se pegaba a la banda cuando la banda terminaba en "estimado" y a la
 * seguridad cuando no, porque *"acorde con sus pares a partir de tu medición"* no es castellano. Con el
 * origen siempre en esta linea, las tres variantes se componen igual y la banda de Gildardo entra
 * verbatim y se cierra con su punto, sin cola.
 */
const SEGURIDAD =
  "Es una estimación a partir de tu medición; no es una enfermedad ni un pronóstico.";

export type EdadParaElPaciente = {
  /** "76,4 años": su cifra, para la pieza grande. */
  cifra: string;
  /** "Tu edad: 64 años". null si no se pudo derivar. */
  edadReal: string | null;
  /** El veredicto en una linea, con su banda verbatim al final. */
  frase: string;
  /** La media linea de seguridad, que va debajo y en letra pequeña. */
  seguridad: string;
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
  // ═══ LA FRASE, TAL COMO SANTIAGO LA ESCRIBIO EL 2026-11-07 (SEGUNDA VUELTA) ═══
  //
  //     "12,4 años más de lo esperado para tu edad: envejecimiento acelerado estimado."
  //
  // SUSTITUYE A *"Tu cuerpo se comporta como el de una persona 12,4 años mayor: ..."*, de esta misma
  // manana. El cambio no es de gusto: la frase vieja afirmaba algo sobre el CUERPO del paciente ("se
  // comporta como el de") y la nueva afirma lo que el modelo de verdad calcula, que es una DISTANCIA
  // contra el valor esperado de su grupo. La v7 estima `Sesp` por sexo, edad y FMI y el IAE es la
  // diferencia contra ese esperado: "mas de lo esperado para tu edad" es exactamente esa resta dicha en
  // castellano, y ademas cabe en una linea del cuadro nuevo.
  //
  // LAS TRES VARIANTES, y por que la tercera no se compone igual:
  //
  //   · IAE positivo: "12,4 años más de lo esperado para tu edad: <banda>."
  //   · IAE negativo: "12,4 años menos de lo esperado para tu edad: <banda>."
  //   · IAE en cero:  "Lo esperado para tu edad: <banda>." Con la forma general saldria *"0,0 años más
  //     de lo esperado"*, que es una diferencia de cero contada como diferencia.
  //
  // Y OJO CON LA BANDA: "más de lo esperado" NO quiere decir "acelerado". La banda de Gildardo es acorde
  // entre -5 y +5, asi que un IAE de +2,1 compone *"2,1 años más de lo esperado para tu edad: acorde con
  // sus pares."*, que es correcto en las dos mitades: la cifra es la distancia y la banda es el veredicto.
  // Las dos son suyas y ninguna se recorta para que concuerden.
  const distancia =
    anios < 0.05
      ? "Lo esperado para tu edad"
      : `${cifraIae(iae).replace(/^[+-]/, "")} años ${
          iae > 0 ? "más" : "menos"
        } de lo esperado para tu edad`;

  return {
    cifra: `${cifraEbBis(eb)} años`,
    edadReal,
    frase: `${distancia}: ${bandaIae(iae)}.`,
    seguridad: SEGURIDAD,
  };
}
