import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// CANDADO DE LA HISTORIA CLINICA IMPRIMIBLE (2026-09-01).
//
// POR QUE EXISTE ESTA PIEZA: el paciente tiene derecho a su historia clinica completa (Resolucion 1995,
// Ley 1581) y quien se la entrega es su profesional, no CNV (Anexo 3, clausula 13). Para poder entregarla
// hay que poder sacarla, y hasta hoy la historia existia solo como pantalla: no se podia imprimir ni
// archivar. El criterio clinico de Gildardo (§7.1: la historia es el documento del profesional y no va al
// paciente por defecto) se respeta entero: esto no la envia, la hace imprimible.
//
// Y AQUI SI VAN LOS INDICES, al reves que en el reporte del paciente. Es el documento tecnico: la tabla de
// Wang, los indices ANI-BIS-E, el DFI con sus severidades. Los dos candados dicen cosas opuestas sobre los
// mismos datos, y esa oposicion es el punto: `report-render` prohibe lo que este exige.

const GLOBALS = readFileSync("src/app/globals.css", "utf8");
const PAGE = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
const SELLO = readFileSync("src/modules/reports/components/hc-consentimiento.tsx", "utf8");
const BOTON = readFileSync("src/modules/reports/components/hc-imprimir.tsx", "utf8");

describe("se imprime lo que se ve, sin una segunda construcción del documento", () => {
  it("el botón imprime la pantalla, no genera un documento aparte", () => {
    // La decision de fondo. Generar la historia otra vez en el servidor exigiria una SEGUNDA construccion
    // del mismo documento (con @react-pdf, que no entiende este HTML), y dos construcciones del mismo
    // insumo es el defecto que llevamos una semana cerrando: la segunda hereda los huecos de la primera y
    // se desincronizan sin que nada avise. Con `print()` lo impreso ES lo que se ve, por construccion.
    expect(BOTON).toContain("window.print()");
  });

  it("la historia lleva la marca de impresión, y el botón no sale en el papel", () => {
    expect(PAGE).toContain('className="imprimible hoja-larga flex flex-col gap-4"');
    expect(BOTON).toContain("no-print");
  });

  it("y se declara HOJA LARGA, que es lo que evita las páginas con solo el título", () => {
    // EL DEFECTO (Santiago, 2026-11-03): *"en la hoja 3 aparece «COMPOSICIÓN CORPORAL · ÍNDICES
    // ALTERADOS» pero de resto la hoja es totalmente vacía."* No faltaba contenido: la regla de impresión
    // `section { break-inside: avoid }` no puede cumplirse cuando la sección es más alta que la página, el
    // navegador la parte igual y el corte cae justo después del título.
    //
    // `hoja-larga` es la clase que ya resolvió esto mismo en el SOAP (2026-09-20) y lo que hace son dos
    // cosas: las secciones pueden partirse y los títulos quedan pegados a lo que encabezan. Se afirma
    // sobre las DOS, porque con una sola el síntoma vuelve: sin `break-after` el título se queda solo, y
    // sin `break-inside: auto` la sección entera salta y deja el hueco.
    expect(PAGE, "la historia clínica dejó de declararse hoja larga").toContain("hoja-larga");
    expect(GLOBALS).toContain(".hoja-larga section {");
    expect(GLOBALS).toContain("break-inside: auto;");
    expect(GLOBALS).toContain("break-after: avoid;");
  });

  it("en papel no queda el fondo del lienzo ni un contenedor con scroll", () => {
    // LOS DOS REPORTES DE LA HC DESCARGADA (Santiago, 2026-11-03):
    //
    //   · *"Se ve muy raro el fondo como gris azulado y encima las cards blancas."* Lo pinta `<main>` con
    //     `bg-surface-sunken`, y `print-color-adjust: exact` (que existe porque el color SÍ es información
    //     clínica en los veredictos) lo manda al papel tal cual.
    //   · *"aparece la flecha/deslizable para uno desplazarse en la tabla, cosa que no es funcional en el
    //     PDF."* La tabla de Wang vive en un `overflow-x-auto` con ancho mínimo, correcto en pantalla
    //     estrecha y sin sentido en una hoja: además de la flecha, el contenedor RECORTA lo que no entra.
    expect(GLOBALS, "el fondo del lienzo volvió al papel").toContain("background: #fff !important;");
    expect(GLOBALS, "un contenedor con scroll volvió a recortar la tabla impresa").toContain(
      "overflow: visible !important;",
    );
    expect(GLOBALS, "una tabla partida volvería a quedar sin encabezado").toContain(
      "display: table-header-group;",
    );
  });

  it("al imprimir sale la hoja y SOLO la hoja, sin páginas en blanco", () => {
    // ESTE CANDADO CAMBIÓ DE MECANISMO, NO DE GARANTÍA (2026-09-02). Exigía ocultar por `visibility` y
    // PROHIBÍA `display`, con esta razón: "display:none sobre un ancestro esconde también a sus
    // descendientes". Eso es cierto, y por eso hace falta `:has()`; lo que la razón no vio es que
    // `visibility:hidden` ESCONDE PERO DEJA EL ALTO, así que todo el resto de la página seguía paginando
    // en blanco. El plan del paciente ocupa dos hojas y salían QUINCE. Con la historia no se notó porque
    // es larga y su propio contenido llenaba las hojas: el defecto llevaba ahí desde el principio.
    //
    // La garantía que este caso protege es la misma de siempre y por eso la fila se queda: se imprime el
    // bloque marcado, sin el layout alrededor. Lo que cambia es cómo se consigue.
    const i = GLOBALS.indexOf("@media print");
    expect(i, "se perdió el bloque @media print").toBeGreaterThan(-1);
    const impresion = GLOBALS.slice(i);
    expect(impresion).toContain("display: none !important");
    // La cadena de ancestros se conserva: es lo que la razón vieja protegía, y sigue siendo necesario.
    expect(impresion, "sin :has() el display:none escondería también la hoja").toContain(
      ":has(.imprimible)",
    );
    // Y NO se vuelve a ocultar por visibility, que es lo que dejaba las hojas en blanco.
    expect(impresion, "ocultar por visibility deja el alto y pagina en blanco").not.toContain(
      "visibility: hidden",
    );
  });

  it("el color se fuerza: en esta pantalla el color ES información clínica", () => {
    // Los veredictos usan color como significado (el naranja de Moderado sale de sus clasificadores). Un
    // navegador que los quite por ahorrar tinta estaria borrando informacion, no decoracion.
    expect(GLOBALS).toContain("print-color-adjust: exact");
  });
});

describe("el sello de consentimiento: bajo qué autorizaciones se recogió", () => {
  it("dice la versión de ESTA consulta, no la vigente hoy", () => {
    // `evaluations.consent_version` sella con que version se capturo la consulta, que puede no ser la de
    // hoy. "Hubo permiso" sin decir de que texto no es constancia de nada: las autorizaciones cambian de
    // redaccion y lo que se pacto fue el texto de SU version.
    const header = readFileSync("src/modules/reports/data/hc-header-reader.ts", "utf8");
    expect(header).toContain("consent_version");
    expect(header).toContain("consentVersion");
    expect(PAGE).toContain("versionDeLaConsulta={hcHeader.consentVersion}");
  });

  it("distingue REVOCADA de NUNCA OTORGADA", () => {
    // En un documento probatorio la diferencia es la que importa: una dice que el permiso existio y se
    // retiro, la otra que nunca lo hubo. Un solo "no" las confundiria.
    expect(SELLO).toContain('"Revocada"');
    expect(SELLO).toContain('"No otorgada"');
    expect(SELLO).toContain('"No vigente"');
  });

  it("lee las autorizaciones del MISMO reader que la ficha del paciente", () => {
    // Dos lecturas del mismo dato es como se crean las discrepancias, y este documento es probatorio.
    expect(PAGE).toContain("getPatientConsents(protocol.patientId)");
    expect(PAGE).toContain("CONSENT_TYPE_LABELS");
  });

  it("y no dice 'sin autorizaciones' a secas cuando no hay ninguna", () => {
    // Un bloque vacio sin explicar, en un documento probatorio, se lee como "no se pidio permiso".
    expect(SELLO).toContain("No hay autorizaciones registradas para este paciente.");
  });
});

describe("la historia clínica SÍ lleva lo técnico (al revés que el reporte del paciente)", () => {
  it("lleva los índices ANI-BIS-E y la tabla de indicadores alterados", () => {
    // CONTROL de que este candado y el del reporte del paciente no se confundan: lo que alli esta
    // prohibido, aqui es obligatorio. Si algun dia alguien "limpiara" la historia con el criterio del
    // reporte, este test lo dice.
    // EL ANCLA SE MUEVE, NO LA ASERCION (Santiago, 2026-09-10): los índices ANI-BIS-E dejaron de ser una
    // TABLA APARTE debajo de la de Wang y entraron DENTRO, como un nivel más, que es como los tiene el
    // archivo de Gildardo. Lo que este caso afirma es lo mismo: que la HC los lleva.
    expect(PAGE).toContain('titulo: "ANI-BIS-E"');
    expect(PAGE).toContain("bloqueFinal={{");
    expect(PAGE).toContain("<HcResumenDiagnostico");
    expect(PAGE).toContain("<HcPlanNutricional");
    expect(PAGE).toContain("<HcObservaciones");
  });

  it("y el sello va ANTES de la firma, que es donde cierra el documento", () => {
    const sello = PAGE.indexOf("<HcConsentimiento");
    const firma = PAGE.indexOf("<HcFirmaYFecha");
    expect(sello).toBeGreaterThan(-1);
    expect(firma).toBeGreaterThan(-1);
    expect(sello, "el sello quedó después de la firma").toBeLessThan(firma);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS DOS DOCUMENTOS SE LLAMAN DISTINTO, Y LA FIRMA NO PIDE UNA RAYA  ·  LA DECISION DE FONDO
//
// ═══ DE DONDE SALE (Santiago, 2026-11-03) ═══
//
// Mirando la pantalla de Reporte: *"A dia de hoy tenemos un bloque que se llama «Reporte»... y justo
// debajo hay 3 botones «Ver en formato SOAP», «Imprimir o guardar en PDF» y «Enviársela al paciente»...
// Al menos ser mas especificos. Y en cuanto al bloque de arriba, pienso que en vez de reporte seria
// mejor de una vez «Informe ANI-BIS-E»."*
//
// Y LA DECISION DE FONDO QUE LO ORDENA: la HC es el REGISTRO CLINICO DEL PROFESIONAL, no un documento
// para el paciente (su §7.1). Por eso se queda con el plan, el ICN y las notas al pie, y por eso el
// documento del paciente es el informe ANI-BIS-E con su hoja del plan. En una pantalla con los dos, un
// rotulo generico encima de uno de ellos no los distingue, y los tres botones sueltos no decian de que
// documento eran.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("los dos documentos de la consulta se nombran por separado", () => {
  const TARJETA = readFileSync("src/modules/reports/components/report-card.tsx", "utf8");
  const ENTREGAR = readFileSync("src/modules/reports/components/hc-entregar.tsx", "utf8");
  const HC = readFileSync("src/modules/reports/components/historia-clinica.tsx", "utf8");

  it("el bloque del paciente se llama por su nombre, no «Reporte»", () => {
    expect(PAGE).toContain("Informe ANI-BIS-E del paciente");
    expect(PAGE, "volvió el título genérico sobre uno de los dos documentos").not.toContain(
      '>Reporte</h2>',
    );
  });

  it("los tres controles de la HC dicen que son de la HC", () => {
    expect(PAGE).toContain("Ver HC en formato SOAP");
    expect(BOTON).toContain("Imprimir o guardar la HC en PDF");
    expect(ENTREGAR).toContain("Enviar copia de la HC al paciente");
    // Y NINGUNO SE QUEDA CON EL ROTULO AMBIGUO, que es lo que de verdad confundía: "Enviársela" no dice
    // qué, y en una pantalla con dos documentos el pronombre apunta a los dos.
    expect(ENTREGAR, "volvió el pronombre sin antecedente").not.toContain("Enviársela al paciente");
  });

  it("el texto del envío dice que el plan va APARTE, no dentro del informe", () => {
    // Decía *"su informe: el diagnóstico en lenguaje claro, su plan, lo que va a trabajar..."*, como si el
    // plan fuera un capítulo. Desde el 2026-10-30 el correo lleva la hoja del plan como SEGUNDO adjunto
    // cuando hay prescripción emitida, y el profesional tiene que saber que el paciente recibe dos
    // archivos. Y si no hay prescripción no va el segundo, así que la frase lo condiciona.
    // Se afirma un trozo de UNA linea: el JSX reparte la frase en varias y un literal largo se cazaria
    // con el salto de linea, que es un falso rojo por el formateo.
    expect(TARJETA).toContain("plan va adjunta aparte");
    expect(TARJETA).toContain("Si tiene prescripción emitida");
    expect(TARJETA, "volvió a prometer el plan dentro del informe").not.toContain(
      "su informe: el diagnóstico en lenguaje claro, su plan",
    );
  });

  it("la firma no deja una raya que nadie llena", () => {
    // *"Hay una raya que nunca se llena con la firma. Entonces para que dejarla ahi vacia siempre?"* Y es
    // cierto: este documento no se firma a mano, nace de una consulta con actor autenticado (el
    // diagnóstico lleva `confirmed_by`/`confirmed_at` y la entrega queda en `hc_deliveries`). El pie dice
    // qué es y quién lo generó, que es más fuerte que la raya, no menos.
    expect(HC).toContain("Documento generado en Atlas por");
    expect(HC, "volvió la línea en blanco del pie").not.toContain('<div className="h-8 border-b border-border" />');
  });
});
