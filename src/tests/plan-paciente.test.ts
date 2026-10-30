import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { titulosDeLaHoja, titulosDelInforme, titulosDelPlanPdf } from "./helpers/titulos-del-plan";

// CANDADO DEL PLAN QUE RECIBE EL PACIENTE (Gildardo §7.1, 2026-08-26).
//
// SU LISTA, literal: "el paciente recibe el plan completo, no solo el informe de composición: el
// diagnóstico, la meta y los objetivos, el plan dietético, el ejemplo de menú, la distribución por
// porciones, las recomendaciones automáticas según el caso, y la lista de intercambio -no la lista
// completa, sino los alimentos principales por región o ciudad-".
//
// SON SIETE BLOQUES Y VAN LOS SIETE (desde el 2026-09-03). El séptimo, la lista recortada por región,
// estuvo meses fuera: su `INTER_TABLA_B` es nacional y faltaba el mapa de qué alimentos corresponden a
// cada región. Llegó en su entrega del 3-sep (§2). Este candado los cuenta para que nadie los dé por
// completos, y desde entonces también vigila que el séptimo esté cableado a las dos superficies.

const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const READER = readFileSync("src/modules/reports/data/plan-paciente-reader.ts", "utf8");
const SEND = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const RENDER = readFileSync("src/modules/reports/services/render-report.tsx", "utf8");
const RUTA = readFileSync("src/app/(app)/reportes/[id]/pdf/route.ts", "utf8");
const DOC_PLAN = readFileSync("src/modules/reports/components/plan-imprimible.tsx", "utf8");

const BLOQUES = readFileSync("src/modules/reports/pdf/bloques-del-plan.tsx", "utf8");

// ── LOS TITULOS SE EXTRAEN, no se buscan con `toContain` ────────────────────────────────────────────
//
// Un `toContain("Tu meta")` lo contenta el COMENTARIO que explica por qué ese bloque se retiró, y eso ya
// dejó pasar un bloque ausente (2026-10-28). Y desde que el JSX de los bloques vive en un módulo
// compartido, el título ya no está en el documento sino en el bloque que el documento COMPONE: el
// ayudante resuelve las dos formas. Ver `helpers/titulos-del-plan.ts`.
const seccionesDelPlan = titulosDeLaHoja;
const seccionesDelPdf = titulosDelInforme;

// ── LOS CUATRO BLOQUES QUE PASARON A VIVIR SOLO EN LA HOJA DEL PLAN (2026-10-28) ────────────────────
//
// Una nutricionista, via Santiago: *"Quitar el apartado que dice tu meta dieta X calórica, proteína X,
// Priorizar X y Vigilar X. También quitar el apartado de 'cómo repartir tus porciones en el día' y
// 'recomendaciones para tu caso'."*
//
// POR QUE ESTE CANDADO NO SE BORRA NI SE RELAJA, SINO QUE SE DA VUELTA. Vigila la §7.1 de Gildardo, que
// dice lo que el PACIENTE RECIBE, no en que archivo: *"el paciente recibe el plan completo... el
// diagnóstico, la meta y los objetivos, el plan dietético, el ejemplo de menú, la distribución por
// porciones, las recomendaciones automáticas según el caso, y la lista de intercambio"*. Los siete siguen
// saliendo; lo que cambio es por cual de las dos hojas. Asi que la asercion se MUEVE a la hoja del plan,
// que es donde ahora se cumple, y ADEMAS se exige que no hayan vuelto al informe: si alguien los repone,
// el informe vuelve a competir con el plan.
//
// Y LOS TITULOS SE LEEN DE LOS TITULOS EXTRAIDOS, no con `toContain` sobre el archivo. Al quitarlos, el
// `toContain("Tu meta")` siguio pasando: lo satisfacia el COMENTARIO que explica la retirada. Un candado
// que un comentario puede contentar no vigila nada.
// ── Y LOS TRES ULTIMOS SE LES UNEN EL 2026-10-30, CON UN CRITERIO MAS GENERAL ──────────────────────
//
// Santiago: *"[El informe] es transversal a todas las disciplinas: trata la salud bioeléctrica, no la
// alimentación. Salen también: la lista de intercambio; el ejemplo de menú para una semana; y 'Lo que
// debes evitar', si es de alimentación. Todo eso ya va en la hoja del plan, que el correo adjunta cuando
// hay prescripción. Ajusta el candado de la §7.1 para que lo exija así."*
//
// EL CRITERIO DEL 28 ERA EL EQUIVOCADO, y lo dice este archivo mismo unas lineas arriba: entonces la linea
// se trazo entre la CIFRA del profesional (que salia) y lo que el paciente puede seguir (que se quedaba).
// Con esa linea, el menu de la semana se quedaba. La linea de verdad es otra: el informe trata la salud
// bioelectrica del paciente, y la alimentacion es UNA de las disciplinas que la aplican.
//
// ASI QUE SON SIETE, Y LOS SIETE EN LA HOJA DEL PLAN. El informe queda sin una sola linea del plan.
const SOLO_EN_LA_HOJA: Record<string, string> = {
  "Tu meta": "la prescripción se entrega en la hoja del plan, no en el informe (nutricionista, 2026-10-28)",
  "Tu plan de alimentación": "por lo mismo: el tipo de dieta, las kcal y los macros son del plan",
  "Cómo repartir tus porciones en el día": "la tabla de porciones es la hoja de la cocina",
  "Recomendaciones para tu caso": "las recomendaciones automáticas van con el plan",
  "Lo que debes evitar": "es de alimentación: son las restricciones, lo que no puede comer (2026-10-30)",
  "Tu lista de intercambio": "alimentación: va en la hoja del plan, no en un informe transversal",
  "Ejemplo de menú para una semana": "lo mismo, y es el bloque más largo del plan",
};

describe("los bloques de su §7.1 siguen saliendo, y se sabe por cuál hoja", () => {
  it.each(Object.entries(SOLO_EN_LA_HOJA))("%s sale en la hoja del plan", (titulo) => {
    expect(seccionesDelPlan(), `falta el bloque "${titulo}" en la hoja del plan`).toContain(titulo);
  });

  it.each(Object.keys(SOLO_EN_LA_HOJA))("%s también sale en el PDF del plan, que es el adjunto", (titulo) => {
    // ES LA MITAD QUE IMPORTA desde el 2026-10-28: la hoja de pantalla depende de que el profesional se
    // acuerde de imprimirla, y el adjunto del correo le llega al paciente siempre. Si estos cuatro
    // estuvieran solo en la pantalla, la §7.1 dependeria de que alguien pulse imprimir.
    expect(titulosDelPlanPdf(), `el adjunto del correo no lleva "${titulo}"`).toContain(titulo);
  });

  it("y NINGUNO volvió al informe", () => {
    const enElPdf = seccionesDelPdf().filter((t) => t in SOLO_EN_LA_HOJA);
    expect(
      enElPdf,
      "un bloque del plan volvió al informe: el paciente queda otra vez con dos papeles que compiten",
    ).toEqual([]);
  });

  it("el diagnóstico, que va PRIMERO", () => {
    // Su §7.1 lo pone primero en la lista, y la razón es la que dio Santiago: primero se le explica al
    // paciente qué tiene, y después la solución. Va traducido a su lenguaje (`dfiParaPaciente`).
    //
    // EL ANCLA CAMBIA POR TERCERA VEZ, así que conviene decir cuál es la regla que no cambia. Fue "Tu
    // meta" hasta el 28 de octubre y "Lo que debes evitar" hasta el 30; los dos salieron del informe. Lo
    // que el informe conserva de "la solución" es lo que NO es del plan: lo que va a trabajar, sus
    // suplementos, a quién más acudir y su seguimiento, que es lo que Santiago llamó "lo que hace de esto
    // un informe y no solo un plan". Contra eso se ancla ahora.
    const titulos = seccionesDelPdf();
    const diagnostico = titulos.indexOf("Cómo estás");
    const primeroDeLaSolucion = titulos.indexOf("Lo que vas a trabajar");
    expect(diagnostico, "el informe dejó de abrir con el diagnóstico").toBeGreaterThan(-1);
    expect(primeroDeLaSolucion).toBeGreaterThan(-1);
    expect(diagnostico, "el diagnóstico quedó después de la solución").toBeLessThan(primeroDeLaSolucion);
  });

  it("pero el informe SI dice que el plan llega en una hoja aparte", () => {
    // `PLAN_DISENO_DOCUMENTOS.md` §3 defendía que el informe llevara el plan entero, y de su argumento
    // sobrevive una mitad que ahora hace falta más que antes: que el informe DIGA que el plan va con él.
    // Sin esta línea, un paciente que abre solo el informe no vería ni el plan ni una señal de que existe.
    expect(DOC, "el informe no dice que el plan llega aparte").toContain("en una hoja aparte");
    // EN CONDICIONAL, porque el informe ya no recibe el plan y no puede saber si hay: así la frase es
    // cierta en los dos casos y quien no tiene plan no lee que le mandaron uno que no está.
    expect(DOC).toContain("Si tu profesional te indicó un plan de alimentación");
  });

  it("y el informe no compone NINGUN bloque del plan, ni uno", () => {
    // La aserción de arriba va por TÍTULO y esta por COMPONENTE, y la diferencia importa: un bloque nuevo
    // del módulo compartido que alguien compusiera en el informe no estaría en SOLO_EN_LA_HOJA y pasaría.
    // Esto cubre también los que todavía no existen.
    expect(
      [...DOC.matchAll(/<(Bloque\w+)\s/g)].map((m) => m[1]),
      "el informe volvió a componer un bloque del plan",
    ).toEqual([]);
  });

  it("y tampoco RECIBE el plan: la prop se quitó, no se dejó sin usar", () => {
    // Una prop que nadie lee es el cable que alguien vuelve a conectar sin saber por qué se desconectó. Si
    // volviera, los tres bloques podrían reaparecer sin que este candado se enterara.
    expect(DOC, "el informe volvió a recibir el plan").not.toMatch(/plan\?: PlanPaciente/);
    expect(RENDER, "el render del informe volvió a pasarle el plan").not.toContain("plan={options.plan}");
  });

  it("LA OTRA MITAD, que es la que hace seguro el recorte: el correo ADJUNTA la hoja del plan", () => {
    // Santiago pidió las dos juntas: *"Todo eso ya va en la hoja del plan, QUE EL CORREO ADJUNTA cuando
    // hay prescripción. Ajusta el candado de la §7.1 para que lo exija así."*
    //
    // Sin el adjunto, quitar los tres bloques del informe sería quitarle al paciente su menú. Así que las
    // dos mitades se exigen en el MISMO caso: si alguien retirara el adjunto, esto falla aquí, al lado de
    // la aserción que lo justifica, y no en un archivo lejano.
    expect(SEND, "el correo dejó de renderizar la hoja del plan").toContain("renderPlanPdf(");
    expect(SEND, "el adjunto del plan dejó de viajar en el correo").toContain("extra: planAdjunto");
    // Y SIN PRESCRIPCIÓN NO VA SEGUNDO ARCHIVO: un adjunto que el paciente abre y no dice nada es peor que
    // no mandarlo, y el texto del correo se deriva de si existe (si dijera "tu informe y tu plan" fijo, el
    // correo se contradiría con su propio contenido).
    expect(SEND).toContain("textoDelCorreo(dispatch.patientName, planAdjunto != null)");
  });

  it("y el profesional puede VER ese segundo documento desde donde aprueba", () => {
    // La ruta del preview afirma de sí misma que es "el mismo documento que sale". Con el plan fuera del
    // informe enseñaba la mitad: el profesional aprobaba sin ver lo que el paciente recibe en el segundo
    // adjunto. Un preview que enseña la mitad es peor que ninguno, porque parece completo.
    expect(RUTA, "la ruta del preview no sirve la hoja del plan").toContain('=== "plan"');
    expect(RUTA).toContain("renderPlanPdf(");
    // Y LA RAMA DEL PLAN VA ANTES QUE LA DEL INFORME ENVIADO. Escrita después, un `?doc=plan` sobre un
    // reporte ya enviado salía por la rama de Storage y devolvía el INFORME: el enlace que dice "Ver la
    // hoja del plan enviada" abría el otro documento, y se abre bien, así que nadie lo nota.
    expect(RUTA.indexOf("if (quierePlan)")).toBeLessThan(RUTA.indexOf("if (dispatch.storagePath)"));
    // De un reporte enviado se sirven LOS BYTES QUE SALIERON, igual que el informe: re-renderizar el plan
    // mostraría otro documento afirmando que es el que recibió el paciente.
    expect(RUTA, "el preview del plan enviado no recupera los bytes que salieron").toContain(
      "downloadPlanPdf(",
    );
    const TARJETA = readFileSync("src/modules/reports/components/report-card.tsx", "utf8");
    expect(TARJETA, "la tarjeta no ofrece la hoja del plan").toContain("?doc=plan");
    // SOLO CUANDO HAY PRESCRIPCIÓN: un enlace que lleva a "no hay plan" es una puerta cerrada.
    expect(TARJETA).toContain("report.conPlan ?");
  });

  it("y las recomendaciones, solo las que aplican a su caso", () => {
    expect(DOC_PLAN).toContain("plan.recomendaciones.map");
    // Los bloques PENDIENTES son avisos PARA EL PROFESIONAL ("esto se emitirá cuando..."). En el
    // documento del paciente serían ruido sobre algo que no puede resolver.
    expect(READER).toContain(".filter((r) => !r.pendiente)");
  });
});

describe("lo que el paciente NO puede comer va en el plan, y antes del menú", () => {
  it("el bloque existe, y sale por las DOS superficies del plan", () => {
    // Su §7.1 no lo nombra, y va igual, declarado (punto 10.6 de la ronda): el paciente recibe un menú, y
    // un menú sin las restricciones al lado es un plan que no puede seguir. Peor: puede contradecirlas.
    //
    // ERAN TRES SUPERFICIES HASTA EL 2026-10-30, cuando salió del informe con los otros dos bloques de
    // alimentación. Siguen siendo las dos que importan, y la razón de que sean dos y no una está unas
    // líneas abajo: la hoja de pantalla depende de que alguien pulse imprimir, el adjunto del correo no.
    for (const [que, titulos] of [
      ["la hoja de pantalla", seccionesDelPlan()],
      ["el PDF del plan", titulosDelPlanPdf()],
    ] as const) {
      expect(titulos, `${que} no lleva las restricciones`).toContain("Lo que debes evitar");
    }
    expect(READER).toContain("restricciones: protocol.restricciones");
  });

  it("y va ANTES del menú en las dos, no después", () => {
    // Se lee el menú para saber qué comer, así que hay que llegar sabiendo qué evitar.
    for (const [que, titulos] of [
      ["la hoja de pantalla", seccionesDelPlan()],
      ["el PDF del plan", titulosDelPlanPdf()],
    ] as const) {
      const evitar = titulos.indexOf("Lo que debes evitar");
      const menu = titulos.indexOf("Ejemplo de menú para una semana");
      expect(evitar, `${que}: falta el bloque de restricciones`).toBeGreaterThan(-1);
      expect(menu, `${que}: falta el menú`).toBeGreaterThan(-1);
      expect(evitar, `${que}: las restricciones quedaron después del menú`).toBeLessThan(menu);
    }
  });

  it("no repite las del MODELO, que ya salen con su cifra", () => {
    // El sodio y los atributos del patrón salen arriba, en el plan dietético, con su número. Repetirlos
    // aquí sin el número sería decir dos veces lo mismo y peor la segunda.
    expect(READER).not.toContain("...(prescripcion?.atributos ?? []),");
  });
});

describe("el séptimo bloque ya está: la lista de intercambio recortada por región", () => {
  // ESTE CANDADO CAMBIO DE ASERCION EL 2026-09-03, y el motivo es que se cumplio lo que vigilaba. Decia
  // "el séptimo bloque falta, y está dicho dónde", y afirmaba que el reader explicara la ausencia citando
  // la pregunta P2 de la ronda del 31. Gildardo respondio (su §2 del 3-sep: el mapa existia desde el 2,
  // pero llego SUELTO en la carpeta, fuera del HTML donde su documento dijo que estaba), asi que la
  // ausencia dejo de existir y con ella el motivo del candado.
  //
  // La asercion no se relaja, se DA VUELTA: lo que se vigila ahora es que el bloque este cableado a las
  // DOS superficies. Una pieza portada y no renderizada es el defecto que ya nos costo tres veces.
  it("el reader lo arma y ya no habla de una ausencia", () => {
    expect(READER).toContain("armarListaIntercambio");
    expect(READER).toContain("LOS SIETE SE ARMAN AQUI");
    expect(READER, "quedo texto describiendo el bloque como pendiente").not.toContain(
      "El septimo, la lista recortada por region, NO",
    );
  });

  it("y sale por las DOS caras del plan: la pantalla y el PDF que adjunta el correo", () => {
    // Las dos leen el MISMO `plan.listaIntercambio`, que es la unica forma de que no puedan discrepar: la
    // pantalla por su cuenta, y el PDF por el bloque compartido.
    //
    // ERA LA TERCERA CARA HASTA EL 2026-10-30: el informe la pintaba, y salió con el menú y las
    // restricciones por el mismo criterio (es alimentación, y el informe es transversal).
    for (const [que, titulos] of [
      ["el plan imprimible", seccionesDelPlan()],
      ["el PDF del plan", titulosDelPlanPdf()],
    ] as const) {
      expect(titulos, `${que} no pinta la lista`).toContain("Tu lista de intercambio");
    }
    expect(DOC_PLAN, "la pantalla no lee el bloque del plan").toContain("plan.listaIntercambio");
    expect(BLOQUES, "el bloque compartido no lee el plan").toContain("plan.listaIntercambio");
  });

  it("los dos cortes suyos viajan: ocho alimentos por subgrupo y el resto como «entre otros»", () => {
    expect(READER).toContain("foods.slice(0, 8)");
    expect(READER).toContain("foods.length > 8");
    // UNA SOLA COPIA en los dos PDF, que es lo que los hace incapaces de divergir.
    expect(BLOQUES).toContain("entre otros");
    expect(DOC_PLAN).toContain("entre otros");
  });

  it("cada alimento sale con su MEDIDA, no solo con los gramos (P-110)", () => {
    // POR QUE ESTO ES UN CANDADO Y NO UNA PREFERENCIA. Su tabla tiene doce alimentos repetidos en
    // Leguminosas que NO son duplicados: son el mismo alimento en dos tamaños de porción (1 cucharón
    // colmado 110 g y medio cucharón 60 g). Sin la medida, las dos filas se leen como el mismo fríjol
    // repetido, y el corte a ocho hace que las medias porciones ocupen puestos y le quiten variedad real
    // al paciente. Si alguien vuelve a `(${"$"}{x.g} g)` a secas, el defecto vuelve sin dar error.
    expect(READER).toContain("${x.g} g, ${x.med}");
    // Y el control: que la tabla siga trayendo la medida en TODAS sus filas. Un `med` vacío imprimiría
    // "(110 g, )", que es peor que no ponerla.
    const TABLA = readFileSync("src/clinical-engine/intercambio-alimentos.ts", "utf8");
    const filas = (TABLA.match(/\{sub:"/g) ?? []).length;
    const conMedida = (TABLA.match(/med:"[^"]+"\}/g) ?? []).length;
    expect(filas, "la tabla dejó de tener 350 filas").toBe(350);
    expect(conMedida, "hay filas sin medida, y saldrían con el paréntesis a medias").toBe(filas);
  });
});

describe("los DOS canales son el mismo documento, no dos documentos", () => {
  // EL CANDADO QUE FALTABA, y es el que explica los seis desfases que salieron al cotejar los dos PDF que
  // Santiago exportó el 2026-09-04 (la hoja que se imprime desde la subpestaña, y el preview del reporte).
  //
  // LO QUE SÍ ESTABA GARANTIZADO: el DATO. Las dos superficies leen el mismo `PlanPaciente`, así que no
  // pueden decir dos cifras distintas. Eso funcionó: la meta, la proteína, el menú y la lista por región
  // coinciden byte por byte en los dos PDF.
  //
  // LO QUE NO GARANTIZABA NADIE ERA EL DOCUMENTO, y `plan-imprimible.tsx` lo afirmaba en su cabecera
  // ("EL ORDEN ES EL DEL PDF, y a propósito... dos órdenes distintos del mismo plan se leen como dos
  // planes"). Era una afirmación sin nada que la derivara, que es como envejecen todas. Habían divergido
  // en seis cosas: el menú y la distribución intercambiados, el tipo de dieta escrito de dos maneras
  // ("Hipocalórica" contra "Dieta hipocalórica de 1529 kcal al día"), el orden interno del bloque de
  // alimentación, el título del menú, la frase de "es un ejemplo" solo en uno, y el encabezado que
  // agrupa las recomendaciones solo en el otro.
  //
  // NINGUNA ERA UN DATO MAL: las seis eran presentación, y las seis eran invisibles a los tests porque
  // ningún test miraba las dos superficies A LA VEZ.

  /**
   * Las secciones que SOLO tiene el PDF, cada una con su razón. Van en lista cerrada a propósito: si
   * mañana aparece una séptima, alguien añadió un bloque a un canal y no al otro, que es exactamente el
   * desfase que esto vigila.
   */
  const SOLO_EN_EL_PDF: Record<string, string> = {
    "Cambio respecto a tu medición anterior": "solo aplica en seguimiento, y la hoja de consulta es del día",
    "Cómo estás":
      "el diagnóstico abre el REPORTE completo; la hoja impresa es solo el plan, lo que el paciente necesita en la cocina (declarado en plan-imprimible.tsx)",
    "Tus suplementos": "va con el informe completo, no con la hoja de la cocina",
    "Tu edad biológica estimada":
      "la EB-BIS v7 que su tabla 3 manda al paciente (2026-10-26): es lectura del modelo sobre su " +
      "medición, no parte del plan dietético, y la hoja de la cocina no lleva diagnóstico",
    "Cómo has cambiado":
      "la gráfica de la trayectoria: necesita dos consultas y la hoja del plan es de UNA, la de hoy",
    "Nota de tu profesional":
      "solo para informes VIEJOS, que no traen el bloque de seguimiento: la observación de la consulta ya va en \"Tu seguimiento\"",
    // LAS TRES DEL INFORME (2026-09-19). El informe reúne la consulta entera; la hoja impresa del plan
    // sigue siendo solo el plan, que es lo que el paciente pega en la nevera.
    "Lo que vas a trabajar": "son las rutas de atención: viven en su propia hoja imprimible y en el informe",
    "Otros profesionales que te pueden acompañar": "las remisiones, por lo mismo",
    "Tu seguimiento": "la observación de la consulta y la próxima cita: son del informe, no del plan",
    // LA HOJA NUEVA DEL INFORME (2026-10-30): la figura y las cinco áreas pasaron a su propia página, con
    // su título. Es diagnóstico, como "Cómo estás", del que se partió; la hoja de la cocina no lo lleva.
    "Cómo estás, área por área":
      "la figura del radar y las cinco áreas, en su propia hoja del informe: es diagnóstico, no plan",
  };

  it("CONTROL: la comparación encuentra secciones de verdad en los dos archivos", () => {
    // Sin esto, todo lo de abajo pasaría verde el día que un cambio de formato rompa la extracción: dos
    // listas vacías coinciden perfectamente. Una afirmación de igualdad necesita saber que comparó algo.
    expect(seccionesDelPlan().length, "no se extrajo ninguna sección de la hoja impresa").toBeGreaterThan(5);
    expect(seccionesDelPdf().length, "no se extrajo ninguna sección del PDF").toBeGreaterThan(
      seccionesDelPlan().length,
    );
    // Y que sean las de verdad, no cualquier cadena: dos anclas de las que el paciente lee.
    expect(seccionesDelPlan()).toContain("Tu meta");
    expect(seccionesDelPdf()).toContain("Cómo estás");
  });

  it("cada sección de la hoja impresa existe en el PDF con el MISMO título, o está declarada", () => {
    // LA ASERCION SE DIO VUELTA EL 2026-10-28, y el motivo es que la divergencia pasó a ser DELIBERADA:
    // cuatro bloques del plan salieron del informe por pedido de una nutricionista. Lo que se vigila ya no
    // es que los dos canales lleven lo mismo (no lo llevan), sino que CADA diferencia esté declarada con
    // su razón en una de las dos listas. Una diferencia sin declarar sigue siendo el defecto de siempre:
    // alguien cambió un canal y no el otro.
    const pdf = seccionesDelPdf();
    for (const t of seccionesDelPlan()) {
      if (t in SOLO_EN_LA_HOJA) continue;
      expect(pdf, `"${t}" no existe en el PDF, o está escrito distinto`).toContain(t);
    }
  });

  it("y en el MISMO ORDEN: dos órdenes del mismo plan se leen como dos planes", () => {
    // Este es el que estaba roto: el menú iba después de la distribución en un canal y antes en el otro.
    // Se comparan SOLO las compartidas, por los dos lados: lo que vive en una sola hoja no tiene orden
    // relativo que contradecir.
    const enPlanCompartidas = seccionesDelPlan().filter((t) => !(t in SOLO_EN_LA_HOJA));
    const enPdfCompartidas = seccionesDelPdf().filter((t) => enPlanCompartidas.includes(t));
    expect(enPdfCompartidas).toEqual(enPlanCompartidas);
  });

  it("y el PDF DEL PLAN cuenta el plan ENTERO en el orden de la hoja de pantalla", () => {
    // ES LA COMPARACION QUE IMPORTA desde que el correo lleva el adjunto: son los DOS documentos que
    // contienen el plan completo, y es el mismo paciente el que puede tener los dos en la mano (uno
    // impreso en la consulta y otro en el correo). Dos ordenes del mismo plan se leen como dos planes.
    expect(titulosDelPlanPdf()).toEqual(seccionesDelPlan());
  });

  it("y lo que solo tiene el PDF está declarado, uno por uno", () => {
    const enPlan = seccionesDelPlan();
    const sueltas = seccionesDelPdf().filter((t) => !enPlan.includes(t) && !(t in SOLO_EN_EL_PDF));
    expect(
      sueltas,
      "bloques que solo salen por un canal sin decir por qué: decláralos o añádelos al otro",
    ).toEqual([]);
  });

  it("la frase del tipo de dieta vive en la hoja del plan, completa y en un solo sitio", () => {
    // ESTE CASO COMPARABA LOS DOS CANALES hasta el 2026-10-28, porque la frase salía en los dos y había
    // divergido ("Hipocalórica" contra "Dieta hipocalórica de 1529 kcal al día"). Ahora sale en UNO, así
    // que lo que queda por vigilar es que siga completa donde quedó, y que no reaparezca en el informe
    // suelta: una prescripción escrita a medias en el segundo canal es el defecto original.
    expect(DOC_PLAN, "la hoja del plan no lleva la frase completa del tipo de dieta").toContain(
      "Dieta {plan.tipoDieta.toLowerCase()}",
    );
    expect(DOC_PLAN, "falta las kcal en la frase").toContain("kcal al día.");
    expect(DOC, "la prescripción volvió al informe").not.toContain(
      "Dieta {plan.tipoDieta.toLowerCase()}",
    );
  });

  it("y la advertencia de que el menú es un ejemplo sale por los dos canales", () => {
    for (const [que, texto] of [
      ["la hoja impresa", DOC_PLAN],
      ["el bloque compartido de los dos PDF", BLOQUES],
    ] as const) {
      expect(texto, `${que}: el menú no dice que es un ejemplo`).toContain("Es un ejemplo, no una obligación");
    }
  });
});

describe("el plan llega a los sitios que renderizan el documento", () => {
  it("al envío, al reenvío y al preview", () => {
    // EL CANDADO VA SOBRE LOS SITIOS DE LLAMADA, que es donde ya se nos quedó dos veces una pieza sin su
    // último cable. Y el PREVIEW es el que más importa de los tres: el profesional APRUEBA mirando eso,
    // así que un preview sin el plan le haría aprobar un documento distinto del que se envía.
    //
    // SON TRES LECTURAS EN `send-report` desde el 2026-10-28, no dos: el envío (que arma el informe y el
    // adjunto del plan con la MISMA lectura) y las dos del reenvío (el respaldo del informe y el respaldo
    // del plan, cada una en su rama). Se exige "al menos dos" en vez de un número exacto porque una cifra
    // absoluta aquí envejece con cada rama nueva y falla por otra razón.
    expect(
      (SEND.match(/getPlanPaciente\(/g) ?? []).length,
      "falta el plan en envío o reenvío",
    ).toBeGreaterThanOrEqual(2);
    // ═══ Y VIAJA AL RENDER DEL PLAN, NO AL DEL INFORME (2026-10-30) ═══
    //
    // Hasta hoy esto contaba las veces que un `plan,` entraba en las OPCIONES DEL INFORME, porque el
    // informe pintaba tres bloques del plan. Ya no pinta ninguno, así que esa cuenta vigilaría que vuelva
    // justo lo que se quitó. Lo que hay que exigir ahora es que el plan llegue a SU PROPIO render, que es
    // el que produce el segundo adjunto del correo.
    expect(
      (SEND.match(/renderPlanPdf\(/g) ?? []).length,
      "el plan no llega al render de su PDF en envío o reenvío",
    ).toBeGreaterThanOrEqual(2);
    // EL PREVIEW LO SIRVE POR SU PROPIA RAMA (`?doc=plan`): el profesional aprueba desde la tarjeta, que
    // ofrece los dos documentos. Un preview que enseñara solo el informe le haría aprobar la mitad.
    expect(RUTA, "el preview no sirve la hoja del plan").toContain("renderPlanPdf(");
    expect(RUTA, "el preview no lee el plan").toContain("getPlanPaciente(");
  });

  it("y el PDF del plan se renderiza, se guarda y se adjunta", () => {
    // LAS TRES COSAS, porque falla distinto si falta cada una: sin render no hay adjunto; sin guardar, el
    // reenvío manda un plan distinto afirmando que es el mismo; sin adjuntar, el paciente no lo recibe y
    // la cifra de calorías no le llega por ningún canal (que es el defecto que esto cierra).
    expect(SEND, "el plan no se renderiza").toContain("renderPlanPdf(");
    expect(SEND, "los bytes del plan enviado no se guardan").toContain("uploadPlanPdf(");
    expect(SEND, "el reenvío no recupera el plan que salió").toContain("downloadPlanPdf(");
    expect(SEND, "el plan no viaja como segundo adjunto").toContain("extra: planAdjunto");
    expect(RENDER, "el renderizador no expone el PDF del plan").toContain("PlanDocument plan={plan}");
  });

  it("el texto del correo DERIVA del adjunto, no lo afirma", () => {
    // Si el texto dijera "tu informe y tu plan" fijo, un paciente sin prescripción leería que le mandaron
    // un plan que no está ahí: el correo y su contenido se contradirían, que es el hazard 4 por correo.
    expect(SEND).toContain("textoDelCorreo(dispatch.patientName, planAdjunto != null)");
    expect(SEND).toContain("conPlan");
  });

  it("y el renderizador del plan es el suyo, no una opción del informe", () => {
    // Era `plan={options.plan}` dentro del informe. Ahora el plan tiene su propio renderizador y su propia
    // cabecera compartida, que es lo que impide que el preview y el adjunto del correo salgan con fechas o
    // profesionales distintos en el encabezado del mismo documento.
    expect(RENDER).toContain("export function renderPlanPdf(");
    expect(RENDER, "la cabecera del plan no está en un solo sitio").toContain(
      "export function metaDelPlan(",
    );
    expect(RENDER, "el informe volvió a recibir el plan").not.toContain("plan={options.plan}");
  });
});

describe("el plan sale de los MISMOS números que ve el nutricionista", () => {
  it("usa la cadena efectiva, no un recálculo con otros criterios", () => {
    // El paciente no puede recibir un objetivo distinto del que su profesional prescribió. Se computa con
    // `computeProtocoloEfectivo` sobre los ajustes guardados, igual que el panel.
    expect(READER).toContain("computeProtocoloEfectivo(snap, {");
    expect(READER).toContain("deficit: protocol.adjDeficit");
    expect(READER).toContain("pesoMeta: protocol.pesoMetaFijado");
  });

  it("y las porciones guardadas PISAN a las calculadas, como en su pantalla", () => {
    expect(READER).toContain("protocol.intercambioPorciones?.porciones[a.sub] ?? a.porciones");
    expect(READER).toContain("protocol.tiempos?.celdas?.[alimento]?.[t.id]");
  });

  it("se compone de los lectores que ya existen, con UNA consulta propia declarada", () => {
    // Dos formas de armar el mismo insumo es como el motor de nutrición terminó viendo cero
    // comorbilidades. Aquí solo se DA FORMA a lo que esos lectores devuelven.
    expect(READER).toContain("getTreatmentProtocol(evaluationId)");
    expect(READER).toContain("getPrescripcionNutricional(");
  });

  it("y esa consulta propia es UNA sola: la ciudad, que ningún lector devuelve", () => {
    // EL TITULO DE ARRIBA DECIA "no consulta por su cuenta" HASTA EL 2026-09-03, y dejó de ser cierto al
    // entrar el séptimo bloque: la lista por región necesita la ciudad del paciente, y ninguno de los
    // lectores existentes la trae. Traerse `getHcHeaderForEvaluation` entero por una columna acoplaría el
    // plan a la historia clínica, así que la excepción se toma y se DECLARA, que es la diferencia entre
    // una decisión y una erosión.
    //
    // Lo que este caso vigila es que siga siendo UNA. En cuanto aparezca una segunda, el patrón dejó de
    // ser una excepción y hay que volver a componer.
    // Se cuenta la LLAMADA, no el import: el import aparece una vez pase lo que pase, así que contarlo
    // haría que una segunda consulta no moviera el número y el candado no viera nada.
    expect((READER.match(/await createSupabaseServerClient()/g) ?? []).length).toBe(1);
    expect(READER).toContain("async function getCiudadPaciente(");
    // Y con el hint del embed, que es la regla que ya nos rompió tres consultas en runtime sin que tsc
    // dijera nada (CLAUDE.md, sección Supabase).
    expect(READER).toContain("patients!inner(patient_profiles!inner(city))");
  });
});

describe("lo que NO viaja al paciente, y es deliberado", () => {
  it("la referencia bibliográfica de la prescripción se queda", () => {
    // Al paciente le sirve el número, no de qué guía sale. Eso es del documento del profesional.
    //
    // SE AFIRMA LA GARANTIA, NO LA FORMA (corregido el 2026-09-03). Este caso comparaba la expresion
    // literal `({ nombre: f.nombre, valor: f.valor })`, y se puso rojo al reescribir el mapeo para que la
    // proteina saliera de la cadena efectiva: la garantia seguia intacta y el candado decia que no. Un
    // candado atado a como esta escrito algo se rompe cada vez que se reescribe sin cambiar lo que
    // garantiza, y ahi se acaba editando la asercion, que es como los candados dejan de leerse.
    expect(READER).toContain("nombre: f.nombre");
    expect(READER).toContain("valor: f.valor");
    // Lo que de verdad se prohibe: que la referencia viaje.
    expect(READER).not.toContain("ref: f.ref");
  });

  it("el menú son SIETE días, no los veintiuno del ciclo", () => {
    // Su §7.1 dice "ejemplo de menú". Veintiún días de comidas en un PDF es un documento que nadie lee.
    expect(READER).toContain("DIAS_MENU_PACIENTE = 7");
    expect(READER).toContain("Array.from({ length: 7 }");
  });

  it("y el plan entero se omite si no hay protocolo, en vez de salir a medias", () => {
    expect(READER).toContain("if (!protocol || !snap) return null;");
    // LA RAMA SE MUDÓ AL DOCUMENTO DEL PLAN, que es el que ahora lo pinta: el informe ya no tiene qué
    // omitir, porque no recibe el plan. Y el correo tampoco adjunta nada cuando el plan es null, que es la
    // misma regla vista desde el otro lado.
    const DOC_PLAN_PDF = readFileSync("src/modules/reports/pdf/plan-document.tsx", "utf8");
    expect(DOC_PLAN_PDF, "el PDF del plan no se arma desde el plan").toContain("plan={plan}");
  });
});
