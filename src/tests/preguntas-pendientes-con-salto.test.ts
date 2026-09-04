import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// LA LISTA DE PREGUNTAS PENDIENTES LLEVA A CADA PREGUNTA (portado de su encuesta, 2026-09-04).
//
// QUE RESOLVIA. Atlas decia "te faltan 61 preguntas" y nada mas, asi que el paciente tenia que buscarlas a
// mano por ocho secciones. Su archivo lo resuelve con un listado donde cada fila salta a su pregunta.
//
// LO QUE **NO** SE PORTO, y es lo que este candado protege tanto como el salto: EL TONO. El suyo pinta las
// filas de ambar con numeros naranja y el contador en rojo, o sea que convierte lo que el paciente NO SABE
// en un error suyo. Eso contradice la frase que hay justo encima ("puedes enviarla asi y completarlas con
// tu profesional") y es de la familia de los encabezados de categoria que retiramos el 2026-08-31.
//
// LA REGLA CLINICA QUE MANDA AQUI, de Santiago: "si hay algo que no sabe, no entiende o no conoce, es
// mejor no responderlo para que el profesional lo ayude despues". Verificado que NO choca con el gate: el
// gate esta en SELLAR EL DIAGNOSTICO, no en enviar la encuesta ("el guardado por partes del intake es otro
// flujo y NO se toca", `run-pipeline.ts`). Asi que el permiso es verdad, y por eso se puede escribir.

const FORM = readFileSync("src/modules/evaluations/components/survey-phase-form.tsx", "utf8");
const SIN_COMENTARIOS = sinComentarios(FORM);

describe("la lista existe y lleva a la pregunta", () => {
  it("cada fila salta a su sección y deja la pregunta a la vista", () => {
    expect(SIN_COMENTARIOS).toContain("const irAPregunta =");
    expect(SIN_COMENTARIOS).toContain("onClick={() => irAPregunta(q)}");
    expect(SIN_COMENTARIOS).toContain("scrollIntoView");
  });

  it("y el salto espera al cuadro siguiente, porque la sección destino aún no se ha pintado", () => {
    // `setStep` es estado: el nodo está montado pero oculto hasta que React pinta. Buscarlo antes devuelve
    // un elemento sin caja y `scrollIntoView` no hace nada. Es un fallo que se ve en un navegador y en
    // ningún test de los nuestros, así que la forma se fija aquí.
    expect(SIN_COMENTARIOS).toContain("requestAnimationFrame");
  });

  it("la pregunta tiene ancla, y sobre el CONTENEDOR, no sobre el control", () => {
    // Al saltar tiene que verse el enunciado. Si el ancla estuviera en el input, el paciente aterrizaría
    // en unas píldoras sin saber qué se le está preguntando.
    expect(SIN_COMENTARIOS).toContain("const anclaPregunta =");
    expect(SIN_COMENTARIOS).toContain("id={anclaPregunta(q.id)}");
    expect(SIN_COMENTARIOS).toContain("scroll-mt-24");
  });
});

describe("UNA sola vara para contar y para listar", () => {
  it("el conteo se deriva de la lista, no la recorre por su cuenta", () => {
    // Dos recorridos del mismo formulario son dos varas, y la barra al 100 % con el aviso diciendo que
    // faltan tres es exactamente el fallo que ya costó un smoke. `countUnanswered` es `sinResponder().length`.
    expect(SIN_COMENTARIOS).toContain("const sinResponder = (form: HTMLFormElement): SurveyQuestionView[]");
    expect(SIN_COMENTARIOS).toContain("const countUnanswered = (form: HTMLFormElement): number => sinResponder(form).length");
  });

  it("y el predicado sigue siendo el del gate del profesional", () => {
    // `isAnswered` es el mismo que usa el servidor. Si aquí se relajara, el paciente vería una encuesta
    // completa y el profesional un hueco.
    expect(SIN_COMENTARIOS).toContain("isAnswered(stored)");
    expect(FORM).toContain('from "@/modules/clinical-pipeline/services/survey-completeness"');
  });
});

describe("el tono: es una ayuda para navegar, no un reproche", () => {
  it("no usa la escala clínica ni el ámbar operativo para lo que el paciente no respondió", () => {
    // La regla completa vive en `capa-clinica-solo-veredictos.test.ts`. Aquí se afirma sobre esta pantalla
    // en concreto, porque es la que un paciente contesta y donde el color puede mover la respuesta.
    expect(SIN_COMENTARIOS).not.toMatch(/(?:text|bg|border)-clinical-/);
    expect(SIN_COMENTARIOS).not.toMatch(/(?:text|bg|border)-attention/);
  });

  it("y el permiso sigue escrito, que es la mitad que importa", () => {
    // Sin esto, alguien podría dejar la lista neutra y quitar la frase, y el defecto se invertiría: una
    // caja gris con 61 preguntas listadas y sin decir que puede enviarla igual presiona más, no menos.
    expect(FORM).toContain("Puedes enviarla así y completarlas con tu profesional");
    expect(FORM).toContain("Puedes dejar en blanco lo que no sepas");
  });

  it("la lista se acota, para que los dos botones no salgan de la pantalla del teléfono", () => {
    // Con 61 sin responder, listarlas todas dentro del aviso empuja "Enviar así" y "Volver a revisar"
    // fuera de la vista, y el paciente se queda con el reproche y sin las dos salidas.
    expect(SIN_COMENTARIOS).toContain("pendientes.slice(0, 8)");
    expect(SIN_COMENTARIOS).toContain("pendientes.length - 8");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// LA TIRA DE COLOR DE LA ORINA, con la condición que la hace correcta.
//
// Santiago probó las dos versiones en el móvil y prefiere la de Gildardo: opciones arriba, tira debajo.
// Se monta la suya. Lo que se conserva del argumento en contra es la CONDICIÓN: su tira es una fila
// aparte de cuatro barras, y eso solo empareja mientras las cuatro opciones quepan en UNA fila. En un
// teléfono no caben (las cuatro etiquetas de esta pregunta miden unos 540 px contra los ~358 px útiles de
// una pantalla de 390), así que con `flex-wrap` caerían en dos filas y cada barra quedaría bajo la opción
// equivocada. Eso no es una tira fea: es un dato mal leído.
//
// Por eso las barras y las opciones comparten REJILLA. El emparejamiento es por construcción, no por
// suerte, y sobrevive a cualquier ancho. Si alguien vuelve a `flex-wrap` en las opciones y deja la tira
// aparte, esto sale rojo, que es el único momento en que se puede saber.

const WIDGETS = readFileSync("src/modules/evaluations/components/survey-widgets.tsx", "utf8");
const WIDGETS_SIN_COMENTARIOS = sinComentarios(WIDGETS);

describe("la tira de color de la orina", () => {
  it("va debajo de las opciones, como en su archivo", () => {
    expect(WIDGETS_SIN_COMENTARIOS).toContain("const conTira =");
    expect(WIDGETS_SIN_COMENTARIOS).toContain("MUESTRA_COLOR");
  });

  it("y COMPARTE REJILLA con las opciones, que es lo que empareja cada barra con la suya", () => {
    // Las dos rejillas tienen que declarar las MISMAS columnas. Si una cambia y la otra no, las barras
    // dejan de caer bajo su opción sin que nada falle.
    const rejillas = WIDGETS_SIN_COMENTARIOS.match(/grid grid-cols-2 gap-2 sm:grid-cols-4/g) ?? [];
    expect(rejillas, "las opciones y la tira dejaron de compartir rejilla").toHaveLength(2);
  });

  it("la tira solo aparece si TODAS las opciones tienen muestra", () => {
    // Una tira a medias emparejaría barras con opciones equivocadas, que es peor que no tenerla.
    expect(WIDGETS_SIN_COMENTARIOS).toContain("options.every((o) => MUESTRA_COLOR[o.text])");
  });

  it("los colores NO salen de la escala clínica: son los colores físicos de la respuesta", () => {
    // Si vinieran de `--clinical-*`, mover un umbral de severidad cambiaría el color de una orina.
    const bloque = WIDGETS.slice(WIDGETS.indexOf("const MUESTRA_COLOR"), WIDGETS.indexOf("export function PillsSingle"));
    expect(bloque).not.toMatch(/clinical-/);
    expect(bloque).toMatch(/#[0-9a-f]{6}/i);
  });

  it("y la tira no habla a los lectores de pantalla: el texto de la opción ya lo dice", () => {
    expect(WIDGETS_SIN_COMENTARIOS).toContain("<div aria-hidden");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// COLOR E ICONOS EN LA ENCUESTA: identidad sí, veredicto no.
//
// La decisión completa vive en BACKLOG. Lo que se fija aquí son las dos reglas que evitan repetir el
// defecto de su archivo, que pone ⚠ en "Conductas alimentarias" y pinta "Alergias y digestión" en rojo
// sobre preguntas tan neutras como cuántas comidas haces o si te han operado.

describe("los iconos de dominio son identidad, no calificación", () => {
  it("hay un icono por cada uno de los ocho dominios", () => {
    const bloque = FORM.slice(FORM.indexOf("const ICONO_DOMINIO"), FORM.indexOf("const initialSubmit"));
    const iconos = bloque.match(/^\s{2}"?[A-ZÁÉÍÓÚa-zá-ú ]+"?:\s*[A-Z]\w+,$/gm) ?? [];
    expect(iconos).toHaveLength(8);
  });

  it("y NINGUNO es un símbolo de veredicto", () => {
    // Un plato, una gota o una casa dicen DÓNDE estás. Un triángulo de alerta, un visto bueno o una cruz
    // dicen QUÉ TAL vas, y eso califica al paciente antes de que conteste. Es la línea exacta que su
    // archivo cruza.
    const bloque = FORM.slice(FORM.indexOf("const ICONO_DOMINIO"), FORM.indexOf("const initialSubmit"));
    const prohibidos = /(?:Triangle|Alert|Warning|Check|Circle(?:Check|Alert|X)|XCircle|ShieldAlert|ThumbsUp|ThumbsDown|Ban|Skull)/;
    expect(bloque, "un icono de veredicto en un encabezado de dominio").not.toMatch(prohibidos);
  });

  it("van en ink, sin color propio, porque no hay rampa categórica todavía", () => {
    // Un tono por dominio sería identidad legítima, pero hoy lo único cromático sin valencia es el azul de
    // marca, que además es el color de acción: ocho encabezados azules se leerían como pulsables. Ampliar
    // la paleta es decisión de Santiago (BRAND.md) y va después de ver la encuesta terminada.
    expect(SIN_COMENTARIOS).toContain('<Icono className="size-5 shrink-0 text-muted-foreground" aria-hidden />');
  });
});

describe("la píldora de porción lleva tinte de marca, no de la escala clínica", () => {
  it("usa el azul de marca al 10 %, que ya existe en la app", () => {
    expect(WIDGETS_SIN_COMENTARIOS).toContain("bg-primary/10");
  });

  it("y no verde ni ámbar, que ahí SÍ calificarían", () => {
    // Un verde junto a "Verduras" leería "alimento bueno", y el mismo verde junto a "Ultraprocesados"
    // leería lo contrario: el color estaría calificando el ALIMENTO, no señalando una unidad de medida.
    const bloque = WIDGETS.slice(WIDGETS.indexOf("hint?.referencia"), WIDGETS.indexOf("{isMulti ?"));
    expect(bloque).not.toMatch(/clinical-|attention|green|emerald|amber|yellow/);
  });
});
