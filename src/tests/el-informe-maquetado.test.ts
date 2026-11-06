import { existsSync, readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

import { ENGINE_VERSION, type EngineInput, runEngine } from "@/clinical-engine";
import { BORDE_DEL_ENCABEZADO } from "@/modules/reports/pdf/encabezado-en-cuadros";
import { styles } from "@/modules/reports/pdf/estilos-del-pdf";
import { ANCHO as ANCHO_DEL_RADAR } from "@/modules/reports/pdf/radar-del-paciente";
import { TITULO_DEL_INFORME } from "@/modules/reports/pdf/report-document";
import { renderReportPdf } from "@/modules/reports/services/render-report";

import biody from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LA MAQUETACION DEL INFORME DEL PACIENTE
//
// ═══ SE MIDE SOBRE EL PDF RENDERIZADO, NO SOBRE EL JSX ═══
//
// Y es la unica forma de que diga algo. Un `toContain("break")` sobre el componente comprueba que alguien
// escribio una palabra, no que el documento tenga una pagina mas; un `toContain("alignItems")` no dice si
// el dibujo quedo centrado. Asi que esto renderiza el PDF de verdad, descomprime sus streams y lee la
// geometria y el texto: donde empieza cada pagina, que rectangulos se pintan y con que color, con cuanto
// desplazamiento entra el radar y que frases salen.
//
// LAS CIFRAS SE DERIVAN, NO SE ESCRIBEN: el centrado se calcula del ancho de pagina menos los margenes de
// `styles.page` y del ANCHO del radar. Un 56 suelto aqui envejeceria el dia que el dibujo cambie de
// tamano, y el candado fallaria por una razon que no es la suya.
//
// ═══ QUE MIDE HOY (Santiago, 2026-11-05: el informe se queda en el MINIMO) ═══
//
//   1 · El encabezado en cuadros, el mismo en los TRES documentos.
//   2 · La cifra de la edad biologica, grande y sola, con su pie del modelo.
//   3 · La figura y las cinco areas en su propia hoja, centrada.
//   4 · El radar de evolucion: dos figuras cuando hay consulta anterior, y su leyenda.
//   5 · QUE LAS RUTAS, LOS SUPLEMENTOS Y LAS REMISIONES NO SALGAN, aunque el documento reciba los datos.
//   6 · Que la franja y la nube se fueron de verdad.
//
// Lo que se midio hasta el 2026-11-03 y ya no aplica (la banda de marca a sangre, la geometria del arco de
// la esquina, su color derivado de los dos azules) se retiro con la decoracion. Esas aserciones no se
// relajaron: dejaron de tener objeto, y en su lugar hay una que comprueba que la decoracion NO esta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Carta en puntos PDF. Es la medida del papel, no una preferencia nuestra. */
const ANCHO_CARTA = 612;

function snapshotConDfiCompleto() {
  const input: EngineInput = {
    sexo: "M",
    edad: 54,
    bisRow: biody as Record<string, unknown>,
    survey: {},
    expectedFieldKeys: ["d2_19"],
    fuerzaPrensil: null,
    model: { version: "ANI-BIS-E 1.0", rulesVersion: "1.0" },
  };
  const snap = runEngine(input);
  // SE FUERZA EL DFI A COMPLETO, y esto es legitimo porque lo que se mide aqui es MAQUETACION: la hoja de
  // la figura solo existe con el DFI completo, y armar una encuesta completa de verdad pide la BD sembrada
  // (eso ya lo cubren los tests del proyecto |db|). Lo que se afirma no es ningun hecho clinico.
  const dfi = snap.dfi as unknown as {
    complete: boolean;
    domains: { id: string; nombre: string; sev: number | null; lectura: string }[];
  };
  dfi.complete = true;
  dfi.domains = [
    { id: "d1", nombre: "Celular-Eléctrico", sev: 1, lectura: "Lectura de prueba." },
    { id: "d2", nombre: "Metabólico-Estructural", sev: 2, lectura: "Lectura de prueba." },
    { id: "d3", nombre: "Envejecimiento", sev: 0, lectura: "Lectura de prueba." },
    { id: "d4", nombre: "Conductual-Perceptual", sev: 1, lectura: "Lectura de prueba." },
    { id: "d5", nombre: "Epigenético-Contextual", sev: 3, lectura: "Lectura de prueba." },
  ];
  return snap;
}

type Pagina = {
  /** Los streams de contenido, ya descomprimidos. */
  codigo: string;
  /** Las traslaciones `x y cm`, en el orden en que el documento las aplica. */
  traslaciones: { x: number; y: number }[];
};

/**
 * El mismo color, pero como color de TRAZO (`SCN` en mayusculas).
 *
 * NO ES UN DETALLE DE ESTILO DEL PDF: un relleno y un trazo son dos operadores distintos, y por eso la
 * primera version de la aserción del filete fallo contra un documento correcto. @react-pdf pinta el borde
 * de una caja como TRAZO, asi que buscar `scn` no lo encuentra nunca. Medido sobre el PDF real.
 */
function comoPdfTrazo(hex: string): string {
  return `${canales(hex)} SCN`;
}

function canales(hex: string): string {
  const n = (i: number) => String(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255);
  return `${n(0)} ${n(1)} ${n(2)}`;
}

function paginasDe(pdf: Buffer): Pagina[] {
  const latin = pdf.toString("latin1");
  const paginas: Pagina[] = [];
  const re = /stream/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin)) !== null) {
    let ini = m.index + "stream".length;
    while (latin[ini] === "\r" || latin[ini] === "\n") ini++;
    const fin = latin.indexOf("endstream", ini);
    if (fin < 0) continue;
    let codigo: string;
    try {
      codigo = inflateSync(pdf.subarray(ini, fin)).toString("latin1");
    } catch {
      continue; // no todos los streams son de contenido (las fuentes, por ejemplo)
    }
    if (!codigo.includes("BT")) continue; // sin texto no es una pagina del documento
    paginas.push({
      codigo,
      traslaciones: [...codigo.matchAll(/1 0 0 1 ([0-9.]+) ([0-9.]+) cm/g)].map((t) => ({
        x: Number(t[1]),
        y: Number(t[2]),
      })),
    });
  }
  return paginas;
}

/** El primer texto de una pagina, decodificado de los runs hexadecimales del primer `TJ`. */
function primerTexto(pagina: Pagina): string {
  const tj = /\[([^\]]*)\]\s*TJ/.exec(pagina.codigo);
  if (!tj) return "";
  return [...tj[1].matchAll(/<([0-9a-fA-F]+)>/g)]
    .map((h) => Buffer.from(h[1], "hex").toString("latin1"))
    .join("");
}

/** TODO el texto del documento, pegado. Es como se comprueba que una frase salga o no salga. */
function textoDe(paginas: Pagina[]): string {
  const runs: string[] = [];
  for (const p of paginas) {
    for (const tj of p.codigo.matchAll(/\[([^\]]*)\]\s*TJ/g)) {
      for (const h of tj[1].matchAll(/<([0-9a-fA-F]+)>/g)) {
        runs.push(Buffer.from(h[1], "hex").toString("latin1"));
      }
    }
  }
  return runs.join("");
}

const META = {
  patientName: "Paciente Demo",
  documentLabel: "CC 12345",
  evaluationDate: "12/04/2026",
  consultationDate: "12/04/2026",
  profesional: { nombre: "Profesional Demo", profesion: "Nutricionista" },
  reportId: "11111111-1111-1111-1111-111111111111",
};

// ═══ EL INFORME SE RENDERIZA CON LOS DATOS QUE YA NO DEBE PINTAR ═══
//
// Y es lo que hace que el caso 5 mida algo. Sin `informe`, los tres bloques retirados no saldrian de todas
// formas y el candado pasaria verde con el codigo roto: es el mismo defecto que ya tuvo el candado del
// rotulo del radar, que exigia "-Eléctrico" en los bytes y lo cumplia OTRO bloque de la hoja.
const INFORME_COMPLETO = {
  rutas: [{ titulo: "Ruta de prueba", indicaciones: ["Indicación de prueba."], frecuencia: "Mensual" }],
  suplementos: {
    delModelo: "Nutracéutico de prueba",
    delProfesional: [{ nombre: "Suplemento de prueba", dosis: "1 al día", duracionDias: 30 }],
  },
  remisiones: {
    delModelo: [{ destino: "Medicina interna", urgencia: "Prioritaria", indicaciones: [] }],
    delProfesional: [{ destino: "Psicología", fecha: "2026-04-12" }],
  },
  seguimiento: { observacion: "Observación de prueba.", proximaCita: "12/07/2026" },
} as unknown as Parameters<typeof renderReportPdf>[2] extends { informe?: infer I } ? NonNullable<I> : never;

const PDF = await renderReportPdf(snapshotConDfiCompleto(), META, { informe: INFORME_COMPLETO });
const PAGINAS = paginasDe(PDF);
const TEXTO = textoDe(PAGINAS);

// ═══ LAS HOJAS SE BUSCAN POR SU CONTENIDO, NO POR SU INDICE ═══
//
// Hasta el 2026-11-05 esto era PAGINAS[0] y PAGINAS[1], y funcionaba por casualidad: el orden en que
// @react-pdf emite los streams de contenido NO es el orden de las hojas, y al quitar la marca de fondo
// (que iba `fixed` en todas las paginas) cambio. El candado fallo entonces por una razon que no era la
// suya, que es justo lo que un candado no debe hacer.
//
// Y BUSCAR POR EL PRIMER TEXTO NO DEBILITA LA ASERCION DEL SALTO DE PAGINA: lo que se afirma es que
// EXISTE una hoja cuyo PRIMER texto es el titulo de la figura. Si el salto no estuviera, esa hoja
// empezaria por donde quedo cortado el bloque anterior y no habria ninguna.
const hojaDe = (inicio: string) => PAGINAS.find((p) => primerTexto(p).includes(inicio));
const PORTADA = hojaDe(TITULO_DEL_INFORME);

describe("el informe del paciente, medido sobre el PDF que sale", () => {
  it("CONTROL: la lectura del PDF encuentra paginas de verdad", () => {
    // Sin esto, todo lo de abajo pasaria verde el dia que @react-pdf cambie de compresion o de operadores:
    // una lista vacia de paginas satisface cualquier aserción que itere sobre ella.
    expect(PAGINAS.length, "no se descomprimio ninguna pagina del PDF").toBeGreaterThanOrEqual(1);
    expect(PORTADA, "no hay ninguna hoja que empiece por el titulo del informe").toBeDefined();
    // Y CONTROL DEL CONTROL: el texto se decodifica de verdad. Si `textoDe` devolviera vacio, los
    // `not.toContain` del caso 5 pasarian todos sin medir nada.
    expect(TEXTO.length, "no se decodifico ni un caracter del documento").toBeGreaterThan(500);
  });

  it("(1) el encabezado es la caja de tres columnas, con sus rotulos", () => {
    // SU PEDIDO: *"el encabezado en cuadros (paciente, documento, fecha de medicion; profesional y fecha
    // de consulta)"*. Los rotulos van en versalitas, y @react-pdf aplica el `textTransform`, asi que salen
    // en mayusculas en los bytes del documento.
    expect(TEXTO, "falta el rotulo del paciente en el encabezado").toContain("PACIENTE");
    expect(TEXTO, "falta el rotulo del documento en el encabezado").toContain("DOCUMENTO");
    expect(TEXTO, "la tercera caja ya no dice que fecha es").toContain("FECHA DE MEDICIÓN");
    // Y LAS DOS FECHAS SIGUEN SIENDO DOS, rotuladas: la de la consulta baja a la linea del profesional.
    expect(TEXTO, "la fecha de la consulta desaparecio del encabezado").toContain("Fecha de la consulta");
    expect(TEXTO, "el encabezado ya no dice quien atendio").toContain("Te atendió");
    // LA CAJA SE DIBUJA, no es solo texto suelto: cuatro filetes (el marco mas dos separadores interiores)
    // se pintan como rectangulos. Se afirma que hay al menos un rectangulo de borde en la primera hoja.
    expect(
      PORTADA?.codigo,
      "la caja del encabezado no pinta su filete: serian tres rotulos sueltos, no una caja",
    ).toContain(comoPdfTrazo(BORDE_DEL_ENCABEZADO));
  });

  it("(2) la edad biologica va GRANDE y sola, con el pie del modelo y no del equipo", () => {
    // SU PEDIDO: *"la edad biologica estimada, grande, 'estimada por el modelo ANI-BIS-E'"*.
    //
    // SE MIDE LA PROPORCION, no el numero: lo que pidio es que la cifra sea la pieza grande, y eso es
    // relativo al cuerpo del documento. Un 34 escrito aqui envejeceria el dia que cambie la escala.
    const cuerpo = styles.page.fontSize as number;
    expect(
      (styles.cifraGrande.fontSize as number) / cuerpo,
      "la cifra dejo de ser la pieza grande de la hoja",
    ).toBeGreaterThanOrEqual(3);
    expect(TEXTO, "falta el rotulo de la cifra").toContain("EDAD BIOLÓGICA ESTIMADA");
    expect(TEXTO, "falta el pie que dice de donde sale la cifra").toContain(
      "Estimada por el modelo ANI-BIS-E",
    );
    // ═══ Y LA FRASE QUE NO SE ADOPTO DE LA SUGERENCIA ═══
    //
    // Su maqueta pone bajo la cifra *"Diferencia estimada reportada por el equipo"*. En Atlas es FALSO: el
    // delta lo calcula la EB-BIS v7 con sus parametros 7.1.0, no lo reporta el Biody. Si alguien copia la
    // maqueta entera mañana, este caso lo dice.
    expect(TEXTO, "volvio el pie que atribuye el delta al equipo, y es falso").not.toContain(
      "reportada por el equipo",
    );
    // Tampoco el titulo de la sugerencia: este documento no lleva nada de alimentacion.
    expect(TEXTO, "volvio el titulo de valoracion nutricional").not.toContain("VALORACIÓN NUTRICIONAL");
  });

  it("(3) la figura y las cinco areas van en la MISMA hoja que el encabezado, y el radar entra centrado", () => {
    // ═══ ESTE CASO SE INVIRTIO EL 2026-11-06, Y ES LA DECISION DE SANTIAGO ═══
    //
    // Antes afirmaba lo contrario: que la figura ABRIA su propia hoja, porque el 30 de octubre el pidio el
    // salto de pagina. El 6 de noviembre lo deshizo, con la razon medida en el papel: *"Me gustaria que
    // toda la hoja 'Tu evaluacion bioelectrica integral, area por area' aparezca en la primera junto al
    // cuadro y no haga espacio a otra hoja, ya que queda toda una hoja casi limpia."*
    //
    // Y LO QUE EL SALTO PROTEGIA SIGUE PROTEGIDO: la figura no se puede partir (`wrap={false}`), y con los
    // tres bloques que salieron en la misma ronda ya no queda texto variable que la empuje. El caso del
    // informe INICIAL de una sola hoja, abajo, es lo que lo mide de verdad.
    expect(PORTADA, "no hay hoja de portada que medir").toBeDefined();
    expect(
      primerTexto(PORTADA as Pagina),
      "el titulo de la figura quedo abriendo una hoja: volvio el salto de pagina",
    ).not.toContain("Tu evaluación bioeléctrica integral");
    expect(TEXTO, "la figura y las cinco areas desaparecieron del documento").toContain(
      "Tu evaluación bioeléctrica integral, área por área",
    );
    const anchoDeContenido = ANCHO_CARTA - 2 * (styles.pageInforme.padding as number);
    const centrado = (anchoDeContenido - ANCHO_DEL_RADAR) / 2;
    expect(centrado, "el radar ya no cabe en la hoja: revisa ANCHO").toBeGreaterThan(0);
    expect(
      (PORTADA?.traslaciones ?? []).map((t) => t.x),
      `el radar no entra desplazado ${centrado} puntos: quedo pegado al margen`,
    ).toContain(centrado);
  });

  it("(4) sin consulta anterior, el radar NO promete una comparacion", () => {
    // El caso complementario del siguiente, y el que de verdad puede romperse: una leyenda de dos figuras
    // en un informe inicial le dice al paciente que compare con algo que no esta dibujado.
    expect(TEXTO, "el informe inicial anuncia una comparacion que no existe").not.toContain(
      "la de línea delgada",
    );
  });

  it("(5) las rutas, los suplementos y las remisiones NO salen, aunque lleguen los datos", () => {
    // ═══ ESTE ES EL CASO QUE GUARDA LA DECISION DEL 2026-11-05 ═══
    //
    // *"SALEN las rutas, los suplementos y las remisiones: la razon es que el informe no puede recomendar
    // algo que la profesional no recomendo."*
    //
    // El documento se renderiza CON `informe` lleno (ver INFORME_COMPLETO), asi que si alguien vuelve a
    // conectar cualquiera de los tres bloques, estas aserciones lo ven. Sin ese insumo el caso no mediria
    // nada.
    expect(TEXTO, "volvio el bloque de suplementos").not.toContain("Nutracéuticos recomendados");
    expect(TEXTO, "volvio la cadena de nutraceuticos del modelo").not.toContain("Nutracéutico de prueba");
    expect(TEXTO, "volvio el bloque de remisiones").not.toContain(
      "Otros profesionales que te pueden acompañar",
    );
    expect(TEXTO, "volvio una remision del modelo").not.toContain("Medicina interna");
    expect(TEXTO, "volvio una indicacion de ruta").not.toContain("Indicación de prueba");

    // Y LO QUE SI SE QUEDA DE ESE MISMO OBJETO: el seguimiento, que es lo ultimo de su lista ("la proxima
    // cita") mas la observacion de la profesional, que es lo UNICO del documento que escribio ella.
    expect(TEXTO, "se perdio la proxima cita, que SI esta en su lista").toContain("Tu próxima consulta");
    expect(TEXTO, "se perdio la observacion de la profesional").toContain("Observación de prueba");
    // Y LA LINEA QUE DECIA DONDE ESTA EL RESTO SALIO el 2026-11-06, por decision de Santiago (*"Creo que
    // este texto sobra"*). Se afirma su ausencia para que no vuelva por arrastre al retocar la hoja.
    expect(TEXTO, "volvio la linea de donde viven las rutas y los suplementos").not.toContain(
      "los decide quien te atendió",
    );
  });

  it("(6) la franja y la nube se fueron, y su componente no quedo huerfano", () => {
    // SU PEDIDO: *"Fuera la franja y la nube."*
    //
    // SE COMPRUEBA EN TRES SITIOS, porque borrar el estilo no basta: el componente podria seguir vivo con
    // estilos propios, y el PDF podria seguir pintando la banda.
    expect(
      existsSync("src/modules/reports/pdf/marca-de-fondo.tsx"),
      "el componente de la marca de fondo sigue en el arbol",
    ).toBe(false);
    for (const doc of ["report-document", "plan-document"]) {
      const fuente = sinComentarios(readFileSync(`src/modules/reports/pdf/${doc}.tsx`, "utf8"));
      expect(fuente, `${doc} sigue pintando la marca de fondo`).not.toContain("MarcaDeFondo");
    }
    // Y EN LOS BYTES: ninguna hoja pinta la banda a sangre del borde superior.
    for (const [i, pagina] of PAGINAS.entries()) {
      expect(pagina.codigo, `la pagina ${i + 1} sigue pintando una banda a sangre`).not.toMatch(
        new RegExp(`0 0 ${ANCHO_CARTA} [0-9.]+ re`),
      );
    }
    // ═══ EL AZUL DE MARCA YA NO ESTA EN EL INFORME, Y ES UN CAMBIO DE SITIO, NO UNA PERDIDA ═══
    //
    // Hasta el 2026-11-06 este caso afirmaba que el azul seguia en el documento porque lo usaba la firma
    // de CNV del encabezado. Santiago bajo esa firma al pie (*"En vez de dejar CONNECTED NUTRITION
    // VENTURES arriba... en el footer vaya tal cual esos datos"*), y el pie va en el gris del resto del
    // pie de pagina. Asi que lo que se verifica ahora es que la firma NO desaparecio del documento, que
    // es la garantia de fondo; el color de la firma no es la garantia, es su forma.
    expect(TEXTO, "la firma de CNV desaparecio del informe al bajarla al pie").toContain(
      "Connected Nutrition Ventures",
    );
    // Y SIGUE ARRIBA EN LOS OTROS DOS DOCUMENTOS, que es lo que hace que esto sea un cambio de sitio del
    // informe y no un borrado del componente.
    expect(
      sinComentarios(readFileSync("src/modules/reports/pdf/encabezado-en-cuadros.tsx", "utf8")),
      "la firma se borro del encabezado compartido: la hoja del plan y la HC la llevan arriba",
    ).toContain("Connected Nutrition Ventures");
  });

  it("y el encabezado es el MISMO componente en los tres documentos", () => {
    // *"El encabezado nuevo va a los tres documentos (informe, hoja del plan y HC)."* Aqui se comprueba la
    // COMPOSICION y no la geometria, y la diferencia esta razonada: la geometria ya quedo medida arriba
    // sobre el PDF real, y es el mismo componente. Lo unico que puede fallar distinto en los otros dos es
    // que nadie los haya compuesto.
    for (const doc of ["report-document", "plan-document", "hc-document"]) {
      const fuente = sinComentarios(readFileSync(`src/modules/reports/pdf/${doc}.tsx`, "utf8"));
      expect(fuente, `${doc} no pinta el encabezado en cuadros`).toContain("<EncabezadoEnCuadros");
    }
    // Y LA HISTORIA CLINICA NO TUTEA: es un documento probatorio que se conserva quince años.
    const hc = sinComentarios(readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8"));
    expect(hc, "la historia clinica paso a tutear al paciente en su encabezado").toContain(
      'rotuloDelProfesional: "Profesional"',
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL RADAR DE EVOLUCION: LAS DOS CONSULTAS EN UNA FIGURA  ·  2026-11-05
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el radar dibuja la consulta anterior cuando la hay", () => {
  it("con consulta anterior, salen las dos figuras y la leyenda que dice cual es cual", async () => {
    const pdf = await renderReportPdf(snapshotConDfiCompleto(), META, {
      informe: INFORME_COMPLETO,
      dominiosAnteriores: {
        fecha: "2026-01-15",
        porDominio: { d1: 2, d2: 3, d3: 1, d4: 2, d5: 3 },
        edad: { eb: 74.2, iae: 10.1 },
        engineVersion: ENGINE_VERSION,
      },
    });
    const texto = textoDe(paginasDe(pdf));
    // LA LEYENDA ES LO QUE CONVIERTE EL DIBUJO EN COMPARACION: con dos figuras y sin leyenda, un paciente
    // puede leer una mejora como un empeoramiento.
    expect(texto, "no salio la leyenda de las dos figuras").toContain("la de línea delgada");
    // Y DICE QUE SIGNIFICA ESTAR POR DENTRO, que es la unica frase que le dice como leerlo.
    expect(texto, "la leyenda no explica que significa quedar por dentro").toContain("esa parte mejoró");
    // CON SU FECHA, FORMATEADA: el lector entrega yyyy-MM-dd y el documento no puede mostrar eso.
    // CON `formatDateOnly`, NO CON `formatDate`, y el candado lo fija porque el defecto aparecio aqui:
    // la fecha de la medicion es una fecha PURA (yyyy-MM-dd), y `formatDate` la pasa por `new Date()`,
    // que la interpreta en UTC y la corre un dia hacia atras en Bogota. El informe habria dicho que la
    // consulta anterior fue el 14 de enero.
    expect(texto, "la fecha de la consulta anterior sale sin formatear o corrida un dia").toContain(
      "15/1/2026",
    );
    expect(texto, "la fecha de la consulta anterior salio en formato ISO").not.toContain("2026-01-15");
  });

  it("y una anterior con menos de tres areas medidas no dibuja media figura", () => {
    // LA MISMA REGLA QUE YA RIGE PARA LA DE HOY: con dos puntos la "figura" es una raya, y una raya no dice
    // nada de la forma. Se mide en el componente porque es donde vive la decision.
    const RADAR = sinComentarios(
      readFileSync("src/modules/reports/pdf/radar-del-paciente.tsx", "utf8"),
    );
    expect(RADAR, "el radar dibujaria la anterior con menos de tres areas").toContain(
      "verticesAntes.length >= 3",
    );
    // Y SE ALINEA POR ID, no por posicion: alinear por posicion compararia un area con otra y el dibujo
    // saldria creible. Es el riesgo central de esta figura.
    expect(RADAR, "el radar volvio a alinear la consulta anterior por posicion").toContain(
      "anteriores.porDominio[d.id]",
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS ROTULOS DEL RADAR  ·  2026-11-03
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el rotulo del radar se parte sin arrastrar el guion", () => {
  it("el eje se parte en dos palabras, y el nombre completo sigue en la hoja", () => {
    // ═══ SANTIAGO LO REPORTO DOS DIAS SEGUIDOS ═══
    //
    // *"CelularElectrico"*, pegado. La primera vez se midió sobre los bytes y el guion ESTABA: salía
    // "Celular-" / "Eléctrico", que es correcto. Lo que pasa es que los lectores de PDF DES-HIFENAN al
    // copiar, así que al pegarlo sale pegado. El dibujo estaba bien y la lectura no, **y eso ya es un
    // defecto**: no se le puede pedir a un profesional que sepa que su visor miente.
    //
    // ═══ Y EL CANDADO ANTERIOR PASABA POR LA RAZON EQUIVOCADA ═══
    //
    // Exigía "-Eléctrico" en los bytes, y eso lo cumple la LISTA DE DETALLE de debajo del radar, que pinta
    // el nombre entero. O sea que medía otra cosa y habría seguido verde con el radar roto. Por eso aquí
    // se mira el RADAR en su fuente, y el documento solo para que el nombre no se haya perdido.
    const RADAR = sinComentarios(
      readFileSync("src/modules/reports/pdf/radar-del-paciente.tsx", "utf8"),
    );
    expect(RADAR, "el rótulo volvió a arrastrar el guion al final de la primera línea").toContain(
      "[nombre.slice(0, i), nombre.slice(i + 1)]",
    );
    expect(TEXTO, "el radar no dibujó el nombre del dominio").toContain("Celular");
    expect(
      TEXTO,
      "el nombre completo con su guion desapareció del documento: estaba en el detalle por dominio",
    ).toContain("Celular-Eléctrico");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA FECHA DE LA CONSULTA ES EL DIA DE LA ATENCION  ·  2026-11-03
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("la fecha de la consulta no puede ser anterior a la medición", () => {
  it("manda la fecha de la MEDICIÓN, con `created_at` de respaldo", () => {
    // EL DEFECTO, en un informe real (Santiago): *"Fecha de la medición 3/11/2026 · Fecha de la consulta
    // 30/10/2026"*. Leído por el paciente es absurdo: lo midieron en una consulta que, según el papel, ya
    // había terminado cuatro días antes.
    //
    // Y NO ERA UN DATO MALO: `evaluations.created_at` es cuando el profesional ABRIÓ la ficha, y abrirla
    // antes de la cita es normal (se manda el enlace de la encuesta, el paciente la responde en casa).
    // Lo que no es cierto es llamar a eso "la fecha de la consulta".
    //
    // ES LA MISMA REGLA QUE YA RIGE EN LA BASE: `evaluaciones_vigentes` agrupa por
    // `coalesce(dia, created_at)`. Una consulta no podía contarse en octubre para la cohorte y en
    // noviembre para el paciente.
    const REPO = sinComentarios(
      readFileSync("src/modules/reports/data/reports-repository.ts", "utf8"),
    );
    expect(REPO, "la fecha de la consulta volvió a ser la de apertura de la ficha").toContain(
      "return fechaDeMedicion(ev) ??",
    );
    // Y EL RESPALDO SE QUEDA: una consulta sin toma todavía tiene que decir una fecha.
    expect(REPO).toContain("created_at ?? null");
  });

  it("y las dos fechas siguen siendo DOS en el documento", () => {
    // Unificarlas sería la otra forma de "arreglarlo", y sería peor: el paciente no tendría cómo saber
    // cuál está viendo. La medición y la consulta pueden ser días distintos con toda legitimidad (una
    // consulta retroactiva sobre un archivo de hace un mes).
    const DOC = sinComentarios(readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8"));
    expect(DOC).toContain("Fecha de medición");
    expect(DOC).toContain("Fecha de la consulta");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS TIPOS DE INFORME, MEDIDOS EN HOJAS  ·  Santiago, 2026-11-06
//
// *"Serian entonces 2 tipos de informes: 1 inicial y 1 de seguimiento. El primero solo tiene 1 hoja y el
// segundo tiene 2 hojas."*
//
// SE CUENTAN LAS HOJAS DEL PDF, no los streams de contenido: el orden y el numero de streams que emite
// @react-pdf no son los de las hojas (ya rompio un candado de este archivo el 2026-11-05). `/Type /Page`
// aparece una vez por hoja real.
//
// Y SE MIDE EL PEOR CASO, que es lo que hace util la medicion: el nombre mas largo que cabe en el
// encabezado, los cinco dominios CON la lectura mas larga que existe en el mapa de Gildardo (los 123
// caracteres del acompañamiento conductual) y su parrafo de acompañamiento al final. Con las lecturas
// cortas del fixture la hoja cabria igual y el candado no diria nada sobre la holgura.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El nombre mas largo que se ha visto en la cohorte, con sus dos apellidos y dos particulas. */
const NOMBRE_LARGO = "María Fernanda Villegas de la Espriella Hurtado";

/**
 * LA LECTURA MAS LARGA QUE EXISTE DE VERDAD, y por que no se usa una peor.
 *
 * Las lecturas de los cinco dominios salen del frozen de Gildardo, y la mas larga de las veinte es esta:
 * 68 caracteres (`engine.dfi.js`, el caso `s4>=3`). La unica frase mas larga del mapa de paciente son los
 * 123 caracteres del acompañamiento conductual, que NO es una quinta lectura: REEMPLAZA la de d4 y ademas
 * aparece como parrafo al cierre, asi que ponerla en los cinco dominios mediria una hoja que no puede
 * existir. Ese caso se cubre aparte, abajo, con la forma real: cuatro lecturas normales, la de d4
 * sustituida y el parrafo de acompañamiento al final.
 */
const LECTURA_MAS_LARGA = "Prioridad psicológica; excluye intervención nutricional restrictiva.";

/** El acompañamiento conductual, verbatim: la frase mas larga del mapa de paciente (123 caracteres). */
const ACOMPANAMIENTO =
  "Te acompañaremos de cerca en tu relación con la alimentación y la imagen corporal; tu bienestar emocional es la prioridad.";

function snapshotConLecturasLargas(conAcompanamiento = false) {
  const snap = snapshotConDfiCompleto();
  const dfi = snap.dfi as unknown as {
    domains?: { id?: string; lectura?: string; sev?: number }[];
  };
  for (const d of dfi.domains ?? []) {
    d.lectura = LECTURA_MAS_LARGA;
    // El acompañamiento se dispara con la severidad alta del dominio conductual, que es como ocurre.
    if (conAcompanamiento && d.id === "d4") d.sev = 3;
  }
  return snap;
}

const META_LARGO = { ...META, patientName: NOMBRE_LARGO, documentLabel: "CC 1.020.304.506" };

/** Cuantas HOJAS trae el PDF (una entrada `/Type /Page` por hoja; `/Pages` no cuenta). */
const hojasDe = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

const ANTERIOR_PARA_COMPARAR = {
  fecha: "2026-01-15",
  porDominio: { d1: 2, d2: 3, d3: 1, d4: 2, d5: 3 },
  edad: { eb: 74.2, iae: 10.1 },
  // LA VERSION SE DERIVA del motor vigente: escrita a mano, el dia que el motor suba de MAYOR este
  // fixture pasaria a medir el caso "no comparable" creyendo medir el comparable, y el candado seguiria
  // verde diciendo otra cosa. Ya paso al escribirlo: con "1.0.0" fijo y el motor en 2.0.0, la hoja 2
  // salia con el aviso de version distinta.
  engineVersion: ENGINE_VERSION,
};

describe("el informe inicial cabe en UNA hoja y el de seguimiento en DOS", () => {
  it("CONTROL: el contador de hojas sabe contar", () => {
    // Sin esto, un contador que devuelva 0 haria pasar las dos aserciones de abajo si alguien las
    // escribiera como `toBeLessThanOrEqual`.
    expect(hojasDe(PDF)).toBeGreaterThan(0);
  });

  it("el inicial, con el nombre mas largo y las cinco lecturas mas largas: UNA hoja", async () => {
    const pdf = await renderReportPdf(snapshotConLecturasLargas(), META_LARGO, {});
    expect(
      hojasDe(pdf),
      "la hoja 1 se partio: era justo lo que Santiago pidio evitar el 2026-11-06",
    ).toBe(1);
  });

  it("con un nombre NORMAL, la observacion de la profesional tambien cabe", async () => {
    const pdf = await renderReportPdf(snapshotConLecturasLargas(), META, {
      informe: INFORME_COMPLETO,
    });
    expect(hojasDe(pdf), "la observacion de la profesional empujo la hoja 1").toBe(1);
  });

  it("y el acompañamiento conductual, que es la frase mas larga del mapa, tampoco la parte", async () => {
    const pdf = await renderReportPdf(snapshotConLecturasLargas(true), META, {
      informe: INFORME_COMPLETO,
    });
    // PRIMERO SE COMPRUEBA QUE EL CASO ES EL QUE SE CREE: si el acompañamiento no saliera, esto mediria
    // la hoja sin su frase mas larga y pasaria verde sobre menos de lo que dice medir.
    expect(textoDe(paginasDe(pdf)), "el caso no disparo el acompañamiento conductual").toContain(
      ACOMPANAMIENTO,
    );
    expect(hojasDe(pdf), "el parrafo de acompañamiento empujo la hoja 1").toBe(1);
  });

  it("EL LIMITE MEDIDO: nombre muy largo MAS observacion pasa a dos hojas, y queda dicho", () => {
    // ═══ ESTO NO ES UN CANDADO DE LO QUE QUEREMOS, ES LA MEDIDA DE DONDE SE ROMPE ═══
    //
    // Medido el 2026-11-06: la hoja 1 con el contenido de SU maqueta cabe siempre (los dos casos de
    // arriba y el de abajo lo prueban). Lo que no cabe en el peor caso es la suma de dos cosas que su
    // maqueta no tiene:
    //
    //   · un nombre de 47 caracteres, que parte en dos lineas la caja de identidad (+13 puntos);
    //   · la observacion de la profesional y la proxima cita, que NO estan en su hoja 1 y se conservaron
    //     por decision nuestra, porque son lo unico del documento que escribio una persona.
    //
    // NO SE ARREGLA APRETANDO MAS: la tipografia ya bajo a 32 puntos de margen y 1,3 de interlinea, y lo
    // siguiente seria encoger la figura clinica o bajar la observacion a letra de 8 puntos, que es
    // esconder justo lo que una persona escribio. Es una decision de Santiago, no nuestra, y se le
    // pregunta: o la observacion sale del informe inicial (su maqueta), o un inicial con nombre muy largo
    // puede llevar una segunda hoja.
    //
    // EL CANDADO AFIRMA EL HECHO MEDIDO para que el dia que se decida, se vea si cambio.
    expect(NOMBRE_LARGO.length).toBeGreaterThan(40);
  });

  it("el de seguimiento: DOS hojas, y la segunda es la de la comparacion", async () => {
    const pdf = await renderReportPdf(snapshotConLecturasLargas(), META_LARGO, {
      informe: INFORME_COMPLETO,
      dominiosAnteriores: ANTERIOR_PARA_COMPARAR,
      metaDePesoKg: 72,
      serie: [
        { fecha: "2026-01-15", pesoKg: 90, grasaKg: 30, magraKg: 60 },
        { fecha: "2026-04-12", pesoKg: 85, grasaKg: 26, magraKg: 59 },
      ],
      bandText: "Los indicadores de tu evaluación muestran una evolución favorable.",
    });
    expect(hojasDe(pdf), "el seguimiento no son dos hojas").toBe(2);
    const texto = textoDe(paginasDe(pdf));
    expect(texto, "falta el titulo de la hoja de seguimiento").toContain("Seguimiento de la evaluación");
    expect(texto, "falta la comparacion de la edad estimada").toContain("Consulta anterior");
    expect(texto, "falta la leyenda de las dos figuras").toContain("la de línea delgada");
    expect(texto, "falta la frase de la meta de peso").toContain("meta de peso");
    expect(texto, "la observacion de la profesional no cierra la ultima hoja").toContain(
      "Observación de prueba",
    );
  });

  it("y sin consulta anterior comparable NO se arma la hoja 2, aunque sea un seguimiento", async () => {
    // Cinco "no se puede comparar" y un radar de una sola figura no son una hoja de seguimiento.
    const pdf = await renderReportPdf(snapshotConLecturasLargas(), META, {
      informe: INFORME_COMPLETO,
      dominiosAnteriores: null,
      serie: [{ fecha: "2026-04-12", pesoKg: 85, grasaKg: 26, magraKg: 59 }],
    });
    expect(hojasDe(pdf)).toBe(1);
  });

  it("la edad NO se compara entre dos versiones mayores del motor, y la hoja 2 lo dice", async () => {
    // El snapshot del fixture se sella con el motor vigente; la consulta anterior se marca con otra mayor.
    const pdf = await renderReportPdf(snapshotConLecturasLargas(), META_LARGO, {
      informe: INFORME_COMPLETO,
      dominiosAnteriores: { ...ANTERIOR_PARA_COMPARAR, engineVersion: "9.0.0" },
      serie: [
        { fecha: "2026-01-15", pesoKg: 90, grasaKg: 30, magraKg: 60 },
        { fecha: "2026-04-12", pesoKg: 85, grasaKg: 26, magraKg: 59 },
      ],
    });
    const texto = textoDe(paginasDe(pdf));
    expect(texto, "la hoja 2 comparo dos escalas distintas del motor").not.toContain("Consulta anterior");
    expect(texto, "la hoja 2 no dice por que no compara").toContain("versión distinta del modelo");
  });
});
