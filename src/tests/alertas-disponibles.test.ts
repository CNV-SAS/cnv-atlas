import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { alertasDisponibles } from "@/clinical-engine/alertas-disponibles";
import { constFlechaDelHtml } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE `generarAlertas`, en tres niveles:
//   1. TRANSCRIPCION: el frozen es byte a byte su funcion. Se coteja, no se cree.
//   2. QUE CORRE HOY: las cinco reglas que leen la encuesta, con su traduccion de campos.
//   3. QUE NO CORRE Y POR QUE, para que dentro de un mes nadie lea el silencio como "el paciente esta
//      bien" en vez de "no lo estamos evaluando".
//
// CORRECCION A LO QUE ESTE ARCHIVO AFIRMABA AYER, y la leccion vale mas que el codigo: di por abierta una
// pregunta que Gildardo YA HABIA CONTESTADO. Su respuesta del 2026-08-28, punto 11b: "Las dos leen el
// grupo equivocado y las dos deben leer d1_13... Portenla YA CON LA CORRECCION; no la porten literal para
// que yo la arregle despues". Yo habia concluido justo lo contrario (dejarlas literales y preguntarle),
// con un argumento que sonaba bien: que corregir haria discrepar Atlas de su archivo en el cotejo. El
// argumento era correcto y la conclusion equivocada, porque el ya habia decidido esa disyuntiva.

describe("generarAlertas: transcripción verbatim del archivo de Gildardo", () => {
  it("el módulo portado contiene su función entera, sin una sola diferencia", () => {
    // Por NOMBRE y contra la entrega DERIVADA, nunca por rango de lineas ni por ruta literal. La
    // traduccion de campos vive en el adaptador para que ESTO siga siendo cierto.
    const fuente = constFlechaDelHtml("generarAlertas");
    const portado = readFileSync("src/clinical-engine/frozen/atlas-alertas.js", "utf8");
    expect(portado).toContain(fuente);
    expect(fuente).toContain("const generarAlertas = (enc, cons, get, rda, peso)");
  });
});

const enc = (extra: Record<string, unknown> = {}) => ({
  d5_39: [] as string[],
  d6_43: [] as string[],
  d2_21: [] as string[],
  ...extra,
});

describe("las cinco reglas que hoy tienen todos sus insumos", () => {
  it("TCA activo: se dispara con una bandera del ítem 21", () => {
    const al = alertasDisponibles(enc({ d2_21: ["Laxantes"] }));
    expect(al.map((a) => a.t)).toEqual(["TCA activo detectado"]);
    expect(al[0].niv).toBe("crítico");
    // El texto es el suyo, sin retocar: es lo que el profesional lee para decidir una derivación.
    expect(al[0].txt).toContain("Derivación urgente");
  });

  it("riesgo glucémico: DM2 más azúcares frecuentes, leyendo d1_13 como él indicó", () => {
    // "3–4 días" es el indice 2 de FREQ_OPC, y su condicion es `>= 2`.
    const al = alertasDisponibles(
      enc({ d5_39: ["Diabetes tipo 2"], d1_13_i: "3–4 días" }),
    ).map((a) => a.t);
    expect(al).toContain("Riesgo glucémico crítico");
  });

  it("y NO se dispara con la misma diabetes y azúcares poco frecuentes", () => {
    // Control del UMBRAL, no solo de la regla: "1–2 días" es el indice 1, por debajo de su `>= 2`.
    const al = alertasDisponibles(
      enc({ d5_39: ["Diabetes tipo 2"], d1_13_i: "1–2 días" }),
    ).map((a) => a.t);
    expect(al).not.toContain("Riesgo glucémico crítico");
  });

  it("estrés alto más azúcares: la segunda que él mandó apuntar a d1_13", () => {
    const al = alertasDisponibles(enc({ d3_29: 8, d1_13_i: "Todos los días" })).map((a) => a.t);
    expect(al).toContain("Estrés alto + azúcares elevados");
  });

  it("deshidratación e hidratación leen d7_agua, que es la misma unidad que d1_16", () => {
    // Su mapeo del 2026-07-28: "Hidratacion -> enc.d7_agua, vasos de 200 ml, la misma unidad que
    // esperaba d1_16". Son VASOS contados, no un indice: sus cortes son `<= 3` y `>= 8`.
    const seco = alertasDisponibles(
      enc({ d7_agua: "2", d7_58: "Oscuro (naranja / marrón)" }),
    ).map((a) => a.t);
    expect(seco).toContain("Deshidratación probable");

    const bien = alertasDisponibles(enc({ d7_agua: "9" })).map((a) => a.t);
    expect(bien).toContain("Hidratación adecuada");
  });

  it("y sin el dato del agua NINGUNA de las dos se dispara, que es lo que estaba mal", () => {
    // ESTE ES EL DEFECTO QUE LA TRADUCCION CIERRA. Leyendo `d1_16` (inexistente), `agua` era siempre 0:
    // `agua <= 3` se cumplia SIEMPRE y "Deshidratación probable" salia por la orina oscura sola,
    // afirmandole al profesional "Agua: 0 vasos" sobre una pregunta que el paciente nunca respondio.
    const sinAgua = alertasDisponibles(enc({ d7_58: "Oscuro (naranja / marrón)" })).map((a) => a.t);
    expect(sinAgua).not.toContain("Deshidratación probable");
    expect(sinAgua).not.toContain("Hidratación adecuada");
  });

  it("un paciente sin banderas no genera ninguna alerta", () => {
    expect(alertasDisponibles(enc())).toEqual([]);
  });
});

describe("las diez de consumo se apagan solas, sin lista blanca", () => {
  it("ninguna aparece con los insumos nutricionales vacíos", () => {
    // Si alguna apareciera, seria que se esta evaluando el cuadro nutricional con ceros, que es peor que
    // no evaluarlo: un cero afirma "consume cero", no "no lo sabemos". Se apagan por la aritmetica
    // (`undefined > 3000` es false), no por una lista que alguien tenga que mantener al dia.
    const al = alertasDisponibles(
      enc({ d5_39: ["Diabetes tipo 2"], d6_43: ["Leche"], d3_23: "6", d1_13_i: "Todos los días" }),
    ).map((a) => a.t);
    for (const t of [
      "Sodio excesivo",
      "Déficit calórico severo",
      "Exceso calórico marcado",
      "Proteína insuficiente para nivel de actividad",
      "Fibra muy baja",
      "Déficit de hierro",
      "Calcio insuficiente",
      "Alergia a lácteos + calcio deficiente",
      "Excelente ingesta de fibra",
      "Buena ingesta de Omega-3",
    ]) {
      expect(al, `${t} no debería poder correr sin cons`).not.toContain(t);
    }
  });

  it("los campos viejos ya no se leen crudos: el seed no tiene ninguno de los tres", () => {
    // La traduccion los rellena desde los vigentes. Si alguien creara `d1_14` en la encuesta, habria dos
    // fuentes del mismo dato y la traduccion pisaria una: por eso el candado mira tambien la CAPTURA.
    const seed = readFileSync("supabase/seed.ts", "utf8");
    for (const k of ["d1_14", "d1_15", "d1_16"]) {
      expect(seed.includes(`key: "${k}"`), `${k} no debería existir en la encuesta`).toBe(false);
    }
    // Y los vigentes de los que salen SI tienen que existir, o la traduccion queda apuntando al vacio.
    for (const k of ["d1_13_i", "d7_agua", "d7_58", "d2_21"]) {
      expect(seed.includes(`key: "${k}"`), `${k} debería existir en la encuesta`).toBe(true);
    }
  });
});

describe("un cero MEDIDO no es un cero ausente, tampoco aquí", () => {
  it("el paciente que responde 0 vasos SÍ dispara la deshidratación", () => {
    // Es la distincion entera, y la misma del punto 4 sobre el ISCM: lo que frena la regla es la
    // AUSENCIA del dato, no su valor. Si esto se rompiera habriamos cambiado "no inventes un dato" por
    // "ignora un dato valido", que en esta regla significa callar sobre un paciente deshidratado.
    const al = alertasDisponibles(
      enc({ d7_agua: "0", d7_58: "Oscuro (naranja / marrón)" }),
    ).map((a) => a.t);
    expect(al).toContain("Deshidratación probable");
  });

  it("y el texto que lee el profesional cita el número que el paciente respondió", () => {
    // El defecto original no era que la regla se disparara: era que AFIRMABA "Agua: 0 vasos" sin que
    // nadie hubiera respondido 0. Ahora el numero del texto sale del dato.
    const al = alertasDisponibles(enc({ d7_agua: "2", d7_58: "Oscuro (naranja / marrón)" }));
    expect(al.find((a) => a.t === "Deshidratación probable")?.txt).toContain("Agua: 2 vasos");
  });
});

// ─── LAS TRES POSITIVAS, EN BLOQUE APARTE (Gildardo 2026-08-30 §5) ───────────────────────────────────
//
// Su instruccion, textual: "Aparte. Una hidratacion adecuada y un TCA activo no pueden compartir lista ni
// peso visual. Lo que la alerta hace es dirigir la mirada del profesional, y mezclarlas gasta esa atencion
// en lo que ya esta bien."
//
// El candado va sobre el COMPONENTE y no solo sobre el motor, porque la particion es de presentacion: el
// motor devuelve las quince juntas, con su nivel, y quien las separa es la pantalla.

describe("las positivas se separan por SU nivel, no por una lista nuestra", () => {
  const COMP = readFileSync("src/modules/diagnoses/components/alertas-clinicas.tsx", "utf8");

  it("la partición usa `niv === \"positivo\"`, que es el campo que trae su regla", () => {
    // Una lista de titulos a mano quedaria desactualizada el dia que el agregue una cuarta positiva, y
    // esa cuarta caeria entre las criticas sin que nadie se entere.
    expect(COMP).toContain('a.niv !== "positivo"');
    expect(COMP).toContain('a.niv === "positivo"');
  });

  it("y son DOS listas distintas, no una con orden", () => {
    // Ordenarlas al final seguiria compartiendo lista y peso visual, que es lo que el excluye.
    expect(COMP).toContain("Lo que el paciente ya hace bien");
    expect((COMP.match(/<ul /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("el bloque de positivas no se muestra vacío", () => {
    // Un encabezado sin contenido tambien reclama la mirada, que es justo el recurso que su punto 5 cuida.
    expect(COMP).toContain("positivas.length ?");
  });

  it("y las tres positivas de su modelo siguen siendo tres", () => {
    // Si alguna dejara de estar marcada como positiva, se iria al bloque de las criticas sin ruido.
    const FROZEN = readFileSync("src/clinical-engine/frozen/atlas-alertas.js", "utf8");
    expect((FROZEN.match(/niv: "positivo"/g) ?? []).length).toBe(3);
  });
});


// ═══ DONDE APARECEN: CUATRO SUPERFICIES, Y LA PESTAÑA "ENCUESTA" NO ES UNA (2026-09-10) ═══
//
// SU INSTRUCCION DEL 2026-08-28 (11a): "Esas alertas aparecen al inicio, cuando el profesional abre la
// informacion de la encuesta del paciente. Son lo que le dice que mirar ANTES de evaluar, no una
// conclusion del diagnostico".
//
// SE APLICO A LA PESTAÑA "Encuesta", Y ESE ERA EL ERROR DE LECTURA. Lo precisa Santiago el 2026-09-10:
// "abrir la informacion de la encuesta" es la PANTALLA de ver/editar la encuesta. Asi que su instruccion
// no se revierte, se cumple donde el la queria, y se suman las tres que pidio despues.

describe("las alertas viven en las cuatro superficies donde se decide", () => {
  const PAGE = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
  const ENCUESTA = readFileSync("src/app/(app)/ani-bis-e/[id]/encuesta/page.tsx", "utf8");

  it("en la pantalla de ver/editar la encuesta, que es donde él las pidió", () => {
    expect(ENCUESTA).toContain("<AlertasClinicas");
    expect(ENCUESTA).toContain("alertasDisponibles(");
  });

  it("y NO en la pestaña Encuesta, que es el único sitio donde dijo que no van", () => {
    // CONTROL de lo de arriba: sin esto, "ponerlas en todas partes" también pasaría verde.
    for (const marca of ['encuesta={<EntradaEvaluacion panel="encuesta"', '{/* La correccion YA NO vive aqui']) {
      const i = PAGE.indexOf(marca);
      expect(i, `no se encontró la pestaña Encuesta (${marca})`).toBeGreaterThan(-1);
    }
    // La pestaña Encuesta de la rama CON diagnóstico: entre su apertura y la siguiente pestaña.
    const iEnc = PAGE.indexOf("      encuesta={");
    const iAntro = PAGE.indexOf("      antro={", iEnc);
    expect(
      PAGE.slice(iEnc, iAntro),
      "las alertas volvieron a la pestaña Encuesta",
    ).not.toContain("alertasNode");
  });

  it("se arman UNA vez y se reusan en las tres pestañas", () => {
    // Repetir la llamada en cada sitio es como se consigue que una pestaña reciba un dato y la otra no.
    // Es el mismo motivo por el que `entrada*Diagnostico` se arma una vez.
    expect(PAGE).toContain("const alertasNode = (");
    // Diagnóstico (las dos ramas), la subpestaña del profesional en Tratamiento, y Reporte/HC.
    expect((PAGE.match(/\{alertasNode\}/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("y son las MISMAS en los cuatro: una función, sin filtro por profesión", () => {
    // No se filtra a propósito: el psicólogo necesita ver el riesgo glucémico igual que la nutricionista
    // necesita ver el TCA. Si algún día alguien filtra, dos profesionales verían banderas distintas del
    // mismo paciente y ninguno sabría cuál es la lista completa.
    const COMP = readFileSync("src/modules/diagnoses/components/alertas-clinicas.tsx", "utf8");
    // SOBRE EL CODIGO SIN COMENTARIOS: el comentario que explica por que NO se filtra nombra las dos
    // profesiones, asi que la asercion se cazaba a si misma. Es la misma forma de siempre.
    expect(
      sinComentarios(COMP),
      "el componente empezó a filtrar por profesión",
    ).not.toMatch(/profesion|profession/i);
  });
});

describe("el pie no promete lo que Gildardo cerró", () => {
  const COMP = readFileSync("src/modules/diagnoses/components/alertas-clinicas.tsx", "utf8");

  it("decía \"que aún no se calcula\", y eso afirma que va a llegar", () => {
    // EL PUENTE ESTA CERRADO POR EL, dos veces: P-70 (2026-08-30, "no hay puente que construir": la
    // frecuencia es un patrón, no una cuantificación) y P-83 (2026-09-03, sobre las porciones por grupo
    // de la TCAC: "No va, y no es que falte: es que no debe existir"). Prometer en un pie de pantalla una
    // vía que él cerró es afirmar más de lo que sabemos.
    expect(sinComentarios(COMP), "volvió la promesa de que el cálculo llega").not.toContain(
      "que aún no se calcula",
    );
    expect(COMP).toContain("la\n        encuesta no captura");
  });

  it("pero el pie SIGUE, porque su razón no cambió", () => {
    // Sin él, "ninguna alerta" se lee como "el paciente está bien" cuando significa "de lo nutricional no
    // estamos evaluando nada". Que la causa sea permanente lo hace más necesario, no menos.
    expect(COMP).toContain("ALERTAS_NO_DISPONIBLES.porConsumo");
    expect(COMP).toContain("La ausencia de avisos no equivale a ausencia de riesgo.");
  });
});
