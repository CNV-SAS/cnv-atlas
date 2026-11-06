import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CAMBIO_MINIMO_AREA,
  CAMBIO_MINIMO_KG,
  comparacionDeLaEdad,
  compararAreas,
  fraseDeLaMeta,
  parrafoDeAnimo,
} from "@/clinical-engine/comparacion-paciente";
import {
  EL_VEREDICTO_INTEGRADO_VA,
  NOTA_DE_INTERPRETACION,
  SUBTITULO_DEL_INFORME,
  TITULO_DEL_INFORME,
} from "@/modules/reports/pdf/report-document";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LO QUE SE LE AÑADIO AL INFORME DEL PACIENTE PARA QUE LO PUEDA LEER
//
// ── DE DONDE SALE (una nutricionista, via Santiago, 2026-10-28) ─────────────────────────────────
//
// *"Algo que faltaría (si ya no está): Nombre del profesional, junto a una pequeña explicación del
// resumen del diagnóstico. Algo simple que el paciente pueda entender. Si el paciente va para
// seguimiento, animarlo comparando el seguimiento con la consulta anterior."*
//
// Lo que SALIO del informe con la misma entrega (los cuatro bloques de la prescripcion) lo vigila
// `plan-paciente.test.ts`, que es donde vive la §7.1 de Gildardo. Aqui va lo que ENTRO.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const REPO = readFileSync("src/modules/reports/data/reports-repository.ts", "utf8");
const SEND = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const RUTA = readFileSync("src/app/(app)/reportes/[id]/pdf/route.ts", "utf8");

// El helper `punto` (una medicion de la serie) se retiro con las tres frases de kilos: ya no hay nada en
// el informe que se construya sobre peso, masa grasa y masa sin grasa.

describe("la comparacion con la consulta anterior, en el lenguaje del paciente", () => {
  // ═══ LO QUE CAMBIO EL 2026-11-06 ═══
  //
  // Antes aqui se vigilaban las tres frases de kilos ("Masa grasa: 43,5 kg, 25,5 kg mas que...") y la
  // grafica de trayectoria. Santiago las saco del informe: *"El paciente no quiere saber eso, simplemente
  // un resumen de que mejoro y que debe seguir mejorando en terminos simples. No utilizar terminos asi
  // como masa grasa, etc."*
  //
  // Asi que lo que se vigila ahora es lo que entro en su lugar, y lo que YA NO PUEDE VOLVER: ni un termino
  // de composicion corporal en el documento del paciente.

  const areasDe = (sevHoy: (number | null)[], sevAntes: (number | null)[]) => {
    const ids = ["d1", "d2", "d3", "d4", "d5"];
    const actuales = ids.map((id, i) => ({
      id,
      dominio: `Área ${i + 1}`,
      nivel: sevHoy[i] == null ? null : "etiqueta",
      sev: sevHoy[i],
      lectura: "lectura",
    }));
    const anteriores: Record<string, number> = {};
    ids.forEach((id, i) => {
      const s = sevAntes[i];
      if (s != null) anteriores[id] = s;
    });
    return compararAreas(actuales, anteriores);
  };

  it("un area que baja de severidad mejoro, y una que sube hay que trabajarla", () => {
    // SEVERIDAD MAS BAJA ES MEJOR (0 = optimo): es la escala de su clasificador, no una nuestra.
    const r = areasDe([0, 2, 1, 1, 1], [2, 0, 1, 1, 1]);
    expect(r[0].cambio).toBe("mejoro");
    expect(r[1].cambio).toBe("retrocedio");
    expect(r[2].cambio).toBe("sin_cambio");
  });

  it("el cambio mas pequeño es UNA categoria: la escala que ya existe, no un umbral inventado", () => {
    expect(CAMBIO_MINIMO_AREA).toBe(1);
    // Con el umbral en 1, pasar de 2 a 1 ya cuenta. Si Gildardo pide dos, es esta constante.
    expect(areasDe([1, 1, 1, 1, 1], [2, 1, 1, 1, 1])[0].cambio).toBe("mejoro");
  });

  it("un area sin dato en cualquiera de las dos consultas NO se compara, y lo dice", () => {
    // Un area que no se midio no es un area que no cambio.
    const sinHoy = areasDe([null, 1, 1, 1, 1], [1, 1, 1, 1, 1]);
    expect(sinHoy[0].cambio).toBe("sin_comparacion");
    expect(sinHoy[0].frase).toContain("No se puede comparar");
    const sinAntes = areasDe([1, 1, 1, 1, 1], [null, 1, 1, 1, 1]);
    expect(sinAntes[0].cambio).toBe("sin_comparacion");
  });

  it("el parrafo NO dice que mejoraste cuando ninguna area mejoro", () => {
    // Es la regla 2: animar con algo que no paso lo desmiente la siguiente consulta.
    const p = parrafoDeAnimo(areasDe([2, 2, 2, 2, 2], [1, 1, 1, 1, 1]), null);
    expect(p).not.toContain("Mejoraste");
    expect(p).not.toContain("mejoraron");
    expect(p).toContain("el avance no se ve");
  });

  it("y cuando si mejoro, lo dice, y no esconde lo que retrocedio", () => {
    const p = parrafoDeAnimo(areasDe([0, 3, 1, 1, 1], [2, 1, 1, 1, 1]), null);
    expect(p).toContain("Mejoraste en un área");
    expect(p).toContain("conviene trabajar");
  });

  it("ni una palabra tecnica en el parrafo, en ninguno de los cinco caminos", () => {
    const casos = [
      areasDe([0, 0, 0, 0, 0], [2, 2, 2, 2, 2]), // todas mejoraron
      areasDe([0, 3, 1, 1, 1], [2, 1, 1, 1, 1]), // mezcla
      areasDe([2, 2, 2, 2, 2], [1, 1, 1, 1, 1]), // todas retrocedieron
      areasDe([1, 1, 1, 1, 1], [1, 1, 1, 1, 1]), // todas igual
      areasDe([null, null, null, null, null], [1, 1, 1, 1, 1]), // nada comparable
    ];
    const PROHIBIDAS = [
      "masa grasa",
      "masa magra",
      "masa muscular",
      "masa sin grasa",
      "severidad",
      "dominio",
      "bioimpedancia",
      "EB-BIS",
      "IAE",
      "percentil",
    ];
    for (const caso of casos) {
      const p = parrafoDeAnimo(caso, null);
      for (const palabra of PROHIBIDAS) {
        expect(p.toLowerCase(), `"${palabra}" en: ${p}`).not.toContain(palabra.toLowerCase());
      }
      expect(p.length, `un parrafo vacio no anima a nadie: ${p}`).toBeGreaterThan(40);
    }
  });

  it("son CINCO caminos y los cinco dan texto distinto: ninguno cae al mismo por descuido", () => {
    const textos = new Set(
      [
        areasDe([0, 0, 0, 0, 0], [2, 2, 2, 2, 2]),
        areasDe([0, 1, 1, 1, 1], [2, 1, 1, 1, 1]),
        areasDe([0, 3, 1, 1, 1], [2, 1, 1, 1, 1]),
        areasDe([2, 2, 2, 2, 2], [1, 1, 1, 1, 1]),
        areasDe([1, 1, 1, 1, 1], [1, 1, 1, 1, 1]),
      ].map((c) => parrafoDeAnimo(c, null)),
    );
    expect(textos.size).toBe(5);
  });

  it("la meta de peso SOLO si esta registrada", () => {
    // La frase va en la DIRECCION de la meta, y una meta que nadie fijo no tiene direccion.
    expect(fraseDeLaMeta(null)).toBe(null);
    const p = parrafoDeAnimo(areasDe([1, 1, 1, 1, 1], [1, 1, 1, 1, 1]), null);
    expect(p).not.toContain("meta de peso");
  });

  it("y va en la direccion de la meta: acercarse cuenta igual subiendo que bajando", () => {
    // Quien tiene que BAJAR: de 90 a 85 con meta 80 se acerco.
    expect(fraseDeLaMeta({ metaKg: 80, pesoHoyKg: 85, pesoAnteriorKg: 90 })).toContain("Te acercaste 5 kg");
    // Quien tiene que SUBIR: de 50 a 55 con meta 60 TAMBIEN se acerco. Con una regla de "bajar es bueno"
    // esta frase diria lo contrario, y es el caso que obliga a mirar la distancia y no el signo.
    expect(fraseDeLaMeta({ metaKg: 60, pesoHoyKg: 55, pesoAnteriorKg: 50 })).toContain("Te acercaste 5 kg");
  });

  it("alejarse se dice, no se calla", () => {
    expect(fraseDeLaMeta({ metaKg: 80, pesoHoyKg: 95, pesoAnteriorKg: 90 })).toContain("Te alejaste 5 kg");
  });

  it("y alcanzar la meta se dice como lo que es", () => {
    expect(fraseDeLaMeta({ metaKg: 80, pesoHoyKg: 80.1, pesoAnteriorKg: 86 })).toContain("Alcanzaste tu meta");
  });

  it("un acercamiento por debajo del piso no se anuncia: estaria animando con algo que no ocurrio", () => {
    // El piso es `CAMBIO_MINIMO_KG`, heredado con su razon: un cambio de 0,1 kg esta dentro del error de
    // medicion (Santiago, 2026-10-28).
    expect(CAMBIO_MINIMO_KG).toBe(0.5);
    const f = fraseDeLaMeta({ metaKg: 80, pesoHoyKg: 89.8, pesoAnteriorKg: 90 });
    expect(f).toContain("a la misma distancia");
    expect(f).not.toContain("Te acercaste");
  });

  it("ninguna frase del parrafo se genera: todas son literales del modulo", () => {
    // Es la regla 1, y se verifica sobre la FORMA: el informe no puede decir lo que la profesional no
    // dijo, y un texto generado dice algo distinto cada vez sobre el mismo hecho.
    const fuente = sinComentarios(
      readFileSync("src/clinical-engine/comparacion-paciente.ts", "utf8"),
    );
    for (const prohibido of ["fetch(", "openai", "groq", "gemini", "prompt", "await "]) {
      expect(fuente.toLowerCase(), `${prohibido} en el modulo de las frases`).not.toContain(prohibido);
    }
  });

  it("la edad estimada no se compara entre dos escalas distintas del motor", () => {
    // Restar una EB-BIS v5 de una v7 daria un numero creible y falso, y se le muestra al paciente.
    const r = comparacionDeLaEdad({ ebHoy: 70, ebAnterior: 74, mismaEscala: false });
    expect(r.estado).toBe("sin_comparacion");
    if (r.estado === "sin_comparacion") expect(r.porque).toContain("versión distinta del modelo");
  });

  it("sin cifra en la consulta anterior lo dice, y nombra que se actualizo la forma de estimarla", () => {
    const r = comparacionDeLaEdad({ ebHoy: 70, ebAnterior: null, mismaEscala: true });
    expect(r.estado).toBe("sin_comparacion");
    if (r.estado === "sin_comparacion") expect(r.porque).toContain("se actualizara");
  });

  it("y cuando se compara, dice el HECHO y no un veredicto", () => {
    // El veredicto es el texto de Gildardo (la banda), que tiene su propio gate de confirmacion. Dos
    // juicios sobre la misma resta serian dos fuentes del mismo veredicto, y uno sin ese gate.
    const r = comparacionDeLaEdad({ ebHoy: 70, ebAnterior: 74, mismaEscala: true });
    expect(r.estado).toBe("comparable");
    if (r.estado === "comparable") {
      expect(r.delta).toBe(-4);
      expect(r.frase).toBe("4 años menos que en tu consulta anterior.");
      for (const juicio of ["mejor", "bien", "favorable", "preocup", "sigue así"]) {
        expect(r.frase.toLowerCase()).not.toContain(juicio);
      }
    }
  });
});

describe("lo que SALIO del informe, y no puede volver", () => {
  it("ni la grafica de trayectoria ni sus tres frases de kilos", () => {
    const doc = sinComentarios(DOC);
    expect(doc).not.toContain("GraficaTrayectoria");
    expect(doc).not.toContain("Desde tu consulta anterior");
    expect(doc).not.toContain("Masa grasa");
  });

  it("y las dos piezas que las pintaban se borraron, no se quedaron sin llamadores", () => {
    // Una pieza muerta es el cable que alguien vuelve a conectar sin saber por que se desconecto.
    expect(existsSync("src/modules/reports/pdf/grafica-trayectoria.tsx")).toBe(false);
    expect(existsSync("src/modules/reports/cambio-desde-la-anterior.ts")).toBe(false);
  });

  it("ni el parrafo que explicaba como leer el documento", () => {
    // Santiago lo marco como texto que sobra, y su primera mitad dejo de ser cierta al apagar el veredicto.
    expect(sinComentarios(DOC)).not.toContain("Este es el resumen de tu valoración");
  });

  it("ni la linea de donde vive el resto", () => {
    expect(sinComentarios(DOC)).not.toContain("Lo que vas a trabajar, los suplementos");
  });
});

describe("el informe tiene DOS tipos: inicial de una hoja, seguimiento de dos", () => {
  const doc = sinComentarios(DOC);

  it("la segunda hoja existe y esta GATEADA por tener consulta anterior con que comparar", () => {
    // La condicion es el DATO, no el tipo de la evaluacion: un seguimiento cuya consulta anterior no
    // sello sus areas no tiene nada que comparar, y cinco "no se puede comparar" es peor que nada.
    expect(doc).toContain("const esSeguimiento =");
    expect(doc).toContain("Boolean(dominiosAnteriores)");
    const paginas = doc.match(/<Page size="LETTER"/g) ?? [];
    expect(paginas.length, "el informe tiene que armar DOS hojas").toBe(2);
    expect(doc).toContain("{esSeguimiento && dfiPac && dominiosAnteriores ? (");
  });

  it("la hoja 1 ya NO lleva salto de pagina: cabe entera", () => {
    // Era lo que dejaba "toda una hoja casi limpia" (Santiago, 2026-11-06).
    expect(doc).not.toContain("<View style={styles.section} break>");
  });

  it("el radar de la hoja 1 dibuja SOLO la consulta de hoy", () => {
    expect(doc).toContain("<RadarDelPaciente dominios={dfiPac.dominios} anteriores={null} />");
  });

  it("el titulo es el que el paciente entiende, y el modelo va en el subtitulo", () => {
    expect(TITULO_DEL_INFORME).toBe("Informe de evaluación bioeléctrica");
    expect(SUBTITULO_DEL_INFORME).toContain("ANI-BIS-E");
    // "ANI-BIS-E" NO va en el titulo grande: es lo que el pidio cambiar.
    expect(TITULO_DEL_INFORME).not.toContain("ANI-BIS-E");
  });

  it("la firma de CNV no desaparece: baja del encabezado al pie", () => {
    expect(doc).toContain("sinFirma: true");
    expect(doc).toContain("Connected Nutrition Ventures SAS · Informe");
  });

  it("la nota de interpretacion es la suya, verbatim", () => {
    expect(NOTA_DE_INTERPRETACION).toContain("No constituyen por sí solos un diagnóstico");
    expect(doc).toContain("{NOTA_DE_INTERPRETACION}");
  });

  it("la observacion de la profesional cierra la ULTIMA hoja, en los dos tipos", () => {
    // Es lo unico del documento que una persona escribio para este paciente.
    expect(doc).toContain("{esSeguimiento ? null : bloqueDeSeguimiento}");
    const hoja2 = doc.slice(doc.indexOf("Seguimiento de la evaluación"));
    expect(hoja2).toContain("{bloqueDeSeguimiento}");
  });

  it("el veredicto de la banda sigue GATEADO por la confirmacion del profesional", () => {
    // Un empeoramiento no le llega al paciente sin que una persona lo decida (regla de Gildardo). Al
    // mover la banda a la hoja 2 ese gate tenia que viajar con ella.
    const hoja2 = doc.slice(doc.indexOf("Seguimiento de la evaluación"));
    expect(hoja2).toContain("{showBand ? <Text");
    expect(doc).toContain("const showBand = showAtlas && Boolean(bandText) && dfi.complete;");
  });
});


describe("quien lo atendio sale en el informe", () => {
  it("el repositorio lo resuelve con la fuente unica de las etiquetas", () => {
    // Que "nutricionista" se escriba "Nutricionista" de cara al paciente lo decide `PROFESSION_LABELS`, no
    // este documento: es la misma lista que usan el admin y el consentimiento.
    expect(REPO).toContain("etiquetaDeProfesion(");
    // Y con el HINT del embed: `professional_profiles` tiene TRES relaciones hacia `profiles`, y sin
    // desambiguar PostgREST falla en runtime sin que tsc lo vea.
    expect(REPO).toContain("profiles!profile_id(full_name)");
  });

  it("y llega a los TRES sitios que arman el PDF, no solo al que se mira", () => {
    // El preview, el envio y el reenvio arman su propio `meta`. Si uno se queda sin el dato, el documento
    // que el profesional aprueba no es el que el paciente recibe, que es el defecto que ya costo caro.
    for (const [que, texto] of [
      ["el preview de la ruta", RUTA],
      ["el envio y el reenvio", SEND],
    ] as const) {
      expect(texto, `${que} no pasa el profesional al PDF`).toContain("profesional: dispatch.profesional");
    }
    // DOS EN EL ENVIO Y DOS EN EL REENVIO desde que el correo lleva el plan: el informe y el adjunto del
    // plan arman su propio `meta`, y los dos tienen que decir quien atendio. Se exige "al menos cuatro"
    // porque una cifra exacta aqui envejece con cada documento nuevo y falla por otra razon.
    expect(
      (SEND.match(/profesional: dispatch\.profesional/g) ?? []).length,
      "un documento del correo se quedó sin el profesional",
    ).toBeGreaterThanOrEqual(4);
    // Y LOS DOCUMENTOS LO PINTAN, no solo lo reciben. Desde el 2026-11-05 lo pintan a traves del
    // ENCABEZADO COMPARTIDO, asi que la frase vive en un sitio y los documentos le pasan el dato: se
    // comprueban las dos mitades, porque cualquiera de las dos puede faltar.
    expect(
      sinComentarios(readFileSync("src/modules/reports/pdf/encabezado-en-cuadros.tsx", "utf8")),
      "el encabezado compartido dejo de decir quien atendio",
    ).toContain("Te atendió");
    for (const doc of ["report-document", "plan-document", "hc-document"]) {
      expect(
        sinComentarios(readFileSync(`src/modules/reports/pdf/${doc}.tsx`, "utf8")),
        `${doc} no le pasa el profesional al encabezado`,
      ).toContain("profesional:");
    }
  });

  it("si no se pudo resolver, la linea NO sale: no se inventa un autor", () => {
    // LA GUARDA SE MUDO AL ENCABEZADO COMPARTIDO con el resto de la cabecera (2026-11-05), y esto es lo
    // que GANA el cambio: antes cada documento tenia que acordarse de su propio condicional, y ahora no
    // hay forma de que uno de los tres se olvide. El informe pasa `meta.profesional ?? null` y el
    // componente decide; si el dato es null, la linea sale vacia y no se inventa un autor.
    expect(
      sinComentarios(readFileSync("src/modules/reports/pdf/encabezado-en-cuadros.tsx", "utf8")),
      "el encabezado dejo de guardar el caso sin profesional",
    ).toContain("datos.profesional");
    expect(REPO).toContain('nombreProfesional !== ""');
  });
});

describe("la nota de interpretacion, y el descargo que SI se retiro", () => {
  // ═══ ESTE BLOQUE SE REESCRIBIO EL 2026-11-06, Y HAY QUE DECIR POR QUE ═══
  //
  // Vigilaba dos cosas: que estuviera la pequeña explicacion del resumen ("Este es el resumen de tu
  // valoracion...") y que NO volviera el descargo de "no constituye diagnostico" que se retiro el
  // 2026-09-01. Las dos cambiaron por decision de Santiago en la misma ronda:
  //
  //   · la explicacion SALIO (*"Creo que este texto sobra"*), y su primera mitad ademas dejo de ser
  //     cierta al apagar el veredicto: anunciaba un resumen general que ya no existe;
  //   · y entro SU nota de interpretacion, que incluye *"No constituyen por si solos un diagnostico"*.
  //
  // O SEA QUE LA PROHIBICION DE 2026-09-01 QUEDA LEVANTADA, y eso no se puede dejar pasar porque el
  // texto nuevo no casa por una letra con el patron viejo: eso seria un candado que pasa por casualidad.
  // El motivo de la prohibicion era CONCRETO: la frase convivia con el bloque "Como estas", que le decia
  // al paciente que su envejecimiento estaba acelerado, asi que el documento diagnosticaba y a la vez
  // declaraba que no diagnosticaba. Con el veredicto integrado apagado, ese bloque no esta: el documento
  // muestra la cifra y las cinco areas con su etiqueta, y no emite juicio de conjunto. Lo que el candado
  // vigila ahora es justo eso, que las dos cosas no vuelvan a convivir.

  it("la nota de interpretacion es la suya, y esta en el documento", () => {
    expect(NOTA_DE_INTERPRETACION).toContain("No constituyen por sí solos un diagnóstico");
    expect(sinComentarios(DOC)).toContain("{NOTA_DE_INTERPRETACION}");
  });

  it("la nota y el veredicto integrado NO pueden convivir: era la razon de retirarla en septiembre", () => {
    // Si alguien vuelve a encender el veredicto, el documento volveria a decir las dos cosas opuestas. El
    // candado lo dice aqui en vez de dejarlo a que alguien recuerde la ronda de septiembre.
    expect(
      EL_VEREDICTO_INTEGRADO_VA,
      "con el veredicto integrado encendido, la nota de interpretación contradice al documento: " +
        "o se apaga el veredicto, o sale la nota (es la decisión del 2026-09-01)",
    ).toBe(false);
  });

  it("y la explicacion del resumen se fue por DECISION, no por arrastre", () => {
    const doc = sinComentarios(DOC);
    expect(doc).not.toContain("Este es el resumen de tu valoración");
    // Lo que explicaba sigue dicho por la leyenda de la propia figura, que no se fue con ella.
    expect(
      sinComentarios(readFileSync("src/modules/reports/pdf/radar-del-paciente.tsx", "utf8")),
    ).toContain("Cuanto más cerca del centro, mejor estás");
  });

  // ════════════════════════════════════════════════════════════════════════════════════════════════
  // EL VEREDICTO INTEGRADO ESTA BAJO UN INTERRUPTOR, Y EL CANDADO MIDE LAS DOS POSICIONES
  //
  // Santiago dejo el informe en cinco cosas y el veredicto integrado no es ninguna; se conservo con la
  // razon escrita (no recomienda nada: es la lectura del modelo sobre la medicion) y queda a que el lo
  // vea impreso. Para que su decision cueste UNA linea, vive tras `EL_VEREDICTO_INTEGRADO_VA`.
  //
  // POR QUE EL CANDADO LEE LA BANDERA EN VEZ DE AFIRMAR QUE EL VEREDICTO ESTA: un candado que hubiera
  // que apagar a mano para ejercer una decision ya tomada no es una garantia, es friccion, y entrena a
  // apagar candados. Asi la suite sigue verde al voltearla y sigue midiendo lo que importa, que es
  // DISTINTO en cada posicion: con la bandera en true, que el veredicto vaya donde se explica; con la
  // bandera en false, que el parrafo de la nutricionista NO se vaya con el (es lo que se llevaria por
  // arrastre quien borre el bloque entero en vez de voltear la bandera).
  // ════════════════════════════════════════════════════════════════════════════════════════════════

  it("el veredicto esta GATEADO por la bandera, no suelto en el JSX", () => {
    const doc = sinComentarios(DOC);
    const gate = doc.indexOf("EL_VEREDICTO_INTEGRADO_VA ?");
    const resumen = doc.indexOf("{dfiPac.riesgo}");
    expect(gate, "el interruptor desaparecio: quitarlo volveria a costar editar el JSX").toBeGreaterThan(0);
    expect(gate, "el interruptor no envuelve al veredicto").toBeLessThan(resumen);
    // Y entre los dos no cabe otra cosa: el gate tiene que ser el de ESTE bloque, no uno de mas arriba.
    expect(resumen - gate, "el interruptor quedo lejos del veredicto que gobierna").toBeLessThan(400);
  });

  it("con la bandera en true el veredicto va donde se explica; en false, las cinco áreas se quedan", () => {
    // ═══ QUE CAMBIO EN ESTE CANDADO EL 2026-11-06, Y POR QUE NO ES RELAJARLO ═══
    //
    // La rama del `false` exigia que el parrafo de la nutricionista ("Este es el resumen de tu
    // valoracion...") sobreviviera, porque era lo que se iria por arrastre si alguien borraba el bloque
    // entero en vez de voltear la bandera.
    //
    // Ese parrafo YA NO ESTA, y no se fue por arrastre: Santiago lo saco el 2026-11-06 por su propia
    // decision (*"Creo que este texto sobra"*), y su primera mitad ademas dejo de ser cierta al apagar el
    // veredicto, porque anunciaba un resumen general que no existe. Que el candado lo siguiera exigiendo
    // obligaria a devolver al informe un texto que su autor retiro.
    //
    // LO QUE SE VIGILA AHORA ES LO QUE SI SE IRIA POR ARRASTRE: las cinco areas, que son el contenido de
    // la hoja. Es la misma garantia sobre lo que de verdad queda en riesgo.
    const doc = sinComentarios(DOC);
    if (EL_VEREDICTO_INTEGRADO_VA) {
      expect(doc).toContain("{dfiPac.riesgo}");
      expect(doc.indexOf("{dfiPac.riesgo}")).toBeLessThan(doc.indexOf("dfiPac.dominios.map"));
    } else {
      expect(doc, "las cinco áreas se fueron con la bandera").toContain("dfiPac.dominios.map");
      expect(doc, "la figura se fue con la bandera").toContain("<RadarDelPaciente");
    }
  });
});
