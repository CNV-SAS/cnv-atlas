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

/** La segunda mitad de la seguridad, sin el "Es una estimación" delante. Una sola redaccion para las dos. */
const SIN_ENFERMEDAD = "no es una enfermedad ni un pronóstico.";
/** La media linea de seguridad completa, que llega de su punto c y viaja pegada a la cifra. */
const SEGURIDAD = `Es una estimación: ${SIN_ENFERMEDAD}`;

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
  // ═══ LA FRASE, TAL COMO SANTIAGO LA ESCRIBIO EL 2026-11-07 ═══
  //
  //     "Tu cuerpo se comporta como el de una persona 12,4 años mayor: envejecimiento acelerado
  //      estimado a partir de tu medición. Es una estimación: no es una enfermedad ni un pronóstico."
  //
  // DOS COSAS CAMBIARON, Y LAS DOS SON SUYAS:
  //
  //   1 · "una persona" en vez de "alguien ... que las personas de tu edad". La cola sobraba y ademas
  //       dejo de tener respaldo: el parrafo que explicaba el grupo de comparacion salio del informe el
  //       mismo dia, asi que la frase ya no puede remitir a el.
  //   2 · LA MEDIA LINEA DE SEGURIDAD SE MUDA AQUI. Vivia en el parrafo que explicaba el modelo, y ese
  //       parrafo SALE del informe (su punto c). Lo que no podia salir con el es que esto es una
  //       ESTIMACION y no un diagnostico: es la frase que evita que un paciente lea "envejecimiento
  //       acelerado" como una enfermedad que tiene. Asi que viaja con la cifra, que es donde se lee.
  //
  // Y EL ORIGEN TAMBIEN SE MUDA ("a partir de tu medición"), porque era la otra mitad util del parrafo
  // que sale: sin ella, la frase afirma algo sobre el cuerpo del paciente sin decir de donde sale.
  //
  // ═══ POR QUE EL ORIGEN SE PEGA A LA BANDA EN DOS CASOS Y A LA SEGURIDAD EN EL TERCERO ═══
  //
  // Las bandas de Gildardo son tres y entran VERBATIM: "envejecimiento acelerado estimado",
  // "envejecimiento desacelerado estimado" y "acorde con sus pares". Las dos primeras terminan en
  // "estimado", asi que "a partir de tu medición" las continua y sale la frase exacta que Santiago
  // escribio. La tercera no, y pegarselo daria *"acorde con sus pares a partir de tu medición"*, que no
  // es castellano. Ahi el origen viaja en la media linea de seguridad, que dice lo mismo y se lee bien.
  //
  // No es una excepcion escondida: es la unica forma de conservar su texto SIN tocarlo y que las tres
  // variantes se lean. El candado fija las tres.
  const comparacion =
    anios < 0.05
      ? "Tu cuerpo se comporta como el de las personas de tu edad"
      : `Tu cuerpo se comporta como el de una persona ${cifraIae(iae).replace(/^[+-]/, "")} años ${
          iae > 0 ? "mayor" : "menor"
        }`;

  const banda = bandaIae(iae);
  const seEncadena = banda.endsWith("estimado");
  const frase = seEncadena
    ? `${comparacion}: ${banda} a partir de tu medición. ${SEGURIDAD}`
    : `${comparacion}: ${banda}. Es una estimación a partir de tu medición: ${SIN_ENFERMEDAD}`;

  return { cifra: `${cifraEbBis(eb)} años`, edadReal, frase };
}
