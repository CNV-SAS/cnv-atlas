import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Modulo congelado en JS; `allowJs` lo resuelve.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";

// CANDADO DE "EL MOTOR QUE GOBIERNA ES EL QUE SE MUESTRA" (Gildardo, respuesta a la ronda del 2026-08-23).
//
// SU DECISION, textual: "`motorTratNutri` gobierna la prescripcion nutricional. Es el que tiene la ciencia
// actualizada, y el sodio lo demuestra: 1.500 mg en hipertension es lo que sostienen OMS, DASH/NHLBI y
// AHA/ACC 2025. Los 2.300 del otro motor son el corte viejo. Porten las nueve filas de `motorTratNutri`."
//
// EL DEFECTO QUE CIERRA, y es el mas caro de la semana: el motor estaba PORTADO desde el 26 de agosto, con
// sus tres correcciones y su golden, y NADIE LO LLAMABA. De los CUATRO motores de tratamiento, tres
// llegaban a pantalla (medico, ejercicio, psico) y el del nutricionista no. Lo que el profesional leia, y
// lo que viajaba al generador de menus, salia de `atlas-protocolo`: a un hipertenso le decia "Sodio < 2300
// mg/dia" ocho dias despues de que el ordenara 1.500. El mismo nos habia señalado esa incoherencia.
//
// POR QUE SE NOS ESCAPO: una nota de la cola decia "VERIFICADO contra sus respuestas: no esta contestada",
// escrita ANTES de que llegara la respuesta. Una nota que dice "verificado" es mas peligrosa que una
// suposicion, porque nadie la vuelve a comprobar.
//
// POR ESO ESTE CANDADO VA SOBRE LOS SITIOS DE LLAMADA y no sobre el motor: el motor siempre estuvo bien.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const MENU = readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8");
const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");

/** Paciente hipertenso: el caso que hacia visible el defecto. */
const HIPERTENSO = { d5_39: ["Hipertensión arterial"], edad: 50, sexo: "Masculino" };
const BIS = { sexo: "Masculino", peso: 92, talla: 171, FMI: 8, FFMI: 19 };

describe("el sodio que ve el hipertenso es el que él ordenó", () => {
  it("el motor que gobierna prescribe 1.500, no 2.300", () => {
    const m = motorTratNutri(HIPERTENSO, BIS, {}) as { sodioMax: number; attrs: string[] };
    expect(m.sodioMax).toBe(1500);
    expect(m.attrs.join(" ")).toContain("Hiposódica");
    expect(m.attrs.join(" ")).toContain("DASH");
  });

  it("y el 2.300 del otro motor sigue existiendo, congelado, para que se note si vuelve a la pantalla", () => {
    // No se edita el frozen: `atlas-protocolo` es transcripcion byte a byte y su 2300 es lo que su archivo
    // dice. Lo que cambia es QUE MOTOR alimenta la pantalla, no lo que cada motor calcula.
    const protocolo = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
    expect(protocolo).toContain("< 2300 mg/día");
  });
});

describe("los dos consumidores leen del motor que gobierna, y de UNA sola fuente", () => {
  it("hay un solo lector (`getPrescripcionNutricional`) y corre el motor correcto", () => {
    expect(READER).toContain("export async function getPrescripcionNutricional");
    // El tercer argumento del motor pasa por el COMPLETADOR desde el 2026-09-03: `indicators` no trae
    // peso ni talla, y sin ellos el motor no falla, contesta con sus defaults (70/170) y devuelve 1,0 g/kg
    // para todos. Lo que este caso afirma sigue siendo lo mismo (hay un solo lector y corre el motor
    // correcto); lo que cambia es que el bis que le entra esta completo. Ver `motor-bis-completo`.
    expect(READER).toContain("motorTratNutri(enc, bisCompleto, edit)");
  });

  it("y los DOS argumentos de la cadena LLEGAN, desde los dos sitios de llamada", () => {
    // EL CANDADO VA SOBRE LOS SITIOS DE LLAMADA, no sobre la firma (smoke 2026-09-01). Al conectar el motor
    // el 31 se le dio el parametro `pesoMeta` y NINGUN CALLER LO PASABA: el motor caia a su peso por
    // defecto (Lorentz) y los gramos de proteina no eran los de la cadena que el profesional miraba. Igual
    // el objetivo: sin el, `tipoEnergia` se computa con el objetivo interno del motor y el titulo se queda
    // clavado en "hipocalorica" ponga el profesional 500 o 5.000. Tercera vez en la semana que una pieza
    // terminada se queda sin su ultimo cable, y la segunda en esta misma pieza.
    expect(READER).toContain("edit.peso_meta = pesoMeta");
    expect(READER).toContain("edit.kcal_obj = kcalObjetivo");
    // La PANTALLA los computa de la cadena efectiva y los pasa.
    expect(PAGE).toContain("cadenaEfectiva?.pesoEfectivo ?? null");
    expect(PAGE).toContain("Math.round(cadenaEfectiva.calorico.kcalObj)");
    // Y el MENU, de la suya.
    expect(MENU).toContain("efectivo.pesoEfectivo");
    expect(MENU).toContain("Math.round(efectivo.calorico.kcalObj)");
  });

  it("el `enc` entrega los multi-select como ARRAY, con el decodificador compartido", () => {
    // EL DEFECTO MAS CARO DEL SMOKE. Habia DOS constructores del `enc` y solo el del motor principal
    // decodificaba los multi. Este dejaba el JSON crudo (`'["Cáncer"]'`), asi que el
    // `Array.isArray(e.d5_39)` del motor daba false y `dx` quedaba VACIO: hasCancer, hasDM, hasDislip y
    // hasERC en falso PARA TODOS LOS PACIENTES. Al de ERC no le bajaba la proteina a 0,7; al de cancer no
    // le aplicaba la rama hipercalorica; al de dislipidemia no le ponia el limite de grasa saturada. Y lo
    // mismo viajaba al prompt del menu. Lo que se vio en pantalla fue la punta: faltaba una alerta.
    expect(READER).toContain("decodeSurveyValue(key, q?.question_type");
    expect(READER).toContain("question_type");
    // Y se REUSA, no se reescribe: dos decodificadores es como se llego aqui.
    const BEI = readFileSync("src/modules/clinical-pipeline/services/build-engine-input.ts", "utf8");
    expect(BEI).toContain("export function decodeSurveyValue(");
  });

  it("la PANTALLA del nutricionista muestra esa prescripción, no las restricciones selladas", () => {
    // EL SITIO CAMBIÓ, NO LA ASERCIÓN (cotejo 2026-08-31, punto h): la prescripción se muestra ahora DENTRO
    // del bloque de objetivo, con el título dinámico y los chips, en vez de suelta en el plan alimentario,
    // donde repetía lo que el título ya decía. Lo que se afirma sigue siendo lo mismo: que la pantalla lee
    // del motor que gobierna y no del snapshot.
    expect(PANEL).toContain("prescripcion.filas.map");
    expect(PANEL).toContain("prescripcion.atributos.map");
    // El bloque sellado sigue existiendo SOLO como respaldo, y rotulado como "de la emisión": si volviera a
    // ser la fuente principal, el hipertenso vería otra vez el 2.300.
    expect(PANEL).toContain("Restricciones del modelo (de la emisión)");
    expect(PANEL, "el bloque sellado volvió a ser la fuente principal").toContain(
      "{!prescripcion && snapRestricciones.length > 0 ? (",
    );
  });

  it("y el PROMPT DEL MENÚ recibe las mismas, no las del snapshot", () => {
    // Es la mitad que no se ve: la IA recibia "Sodio < 2300" y adaptaba el menu contra el corte viejo.
    expect(MENU).toContain("getPrescripcionNutricional(");
    expect(MENU).toContain("const restriccionesModelo = prescripcion");
    // Y con los LIMITES, no con todas las filas: la proteina objetivo es una meta y contarla abriria el
    // gate de la IA para todos los pacientes, rompiendo su §13.
    expect(MENU).toContain("prescripcion.limites.concat");
  });

  it("la página la computa y se la pasa al panel", () => {
    expect(PAGE).toContain("getPrescripcionNutricional(");
    expect(PAGE).toContain("prescripcion={prescripcionNutricional}");
  });
});

describe("lo que NO se conectó, y es deliberado", () => {
  it("las cifras calóricas del motor NO se muestran: su fórmula de gasto difiere de la cadena", () => {
    // `motorTratNutri` usa Mifflin siempre sobre el peso meta; la cadena que el profesional edita usa
    // Cunningham cuando hay masa libre de grasa, que es siempre (medimos bioimpedancia). El lo nombro y
    // dijo "no lo cambien ahora". Mostrar las dos seria repetir el defecto que esto cierra: dos numeros del
    // mismo concepto en la misma pantalla. Esta preguntado en la ronda del 31.
    // SE MIRA LO QUE SALE DEL MOTOR, no cualquier aparicion del nombre: desde el 2026-09-01 el lector
    // RECIBE un `kcalObjetivo` (el de la cadena, que entra como su `edit.kcal_obj` para que el tipo
    // energetico se recalcule). Entrar no es mostrarse, y confundir las dos cosas volveria este candado
    // un detector de nombres. Lo que sigue prohibido es leer las CIFRAS que el motor calcula.
    expect(READER, "se filtraron las kcal del otro motor a la pantalla").not.toContain("m.kcalObjetivo");
    expect(READER, "se filtro el GEB del otro motor a la pantalla").not.toContain("m.geb");
    expect(READER, "se filtro el GET del otro motor a la pantalla").not.toContain("m.get");
  });

  it("CONTROL: el motor SÍ calcula esas cifras; lo que se decide es no mostrarlas", () => {
    // Sin este control, el test de arriba pasaria verde tambien si el motor hubiera dejado de calcularlas,
    // que seria haberlo roto en vez de haber decidido algo.
    const m = motorTratNutri(HIPERTENSO, BIS, {}) as { kcalObjetivo: number; geb: number };
    expect(m.kcalObjetivo).toBeGreaterThan(0);
    expect(m.geb).toBeGreaterThan(0);
  });
});

describe("los bloques de la historia clínica que esperaban al motor", () => {
  const HC = readFileSync("src/modules/reports/data/hc-recomendaciones.ts", "utf8");

  it("TRES dejaron de esperar: DASH, nefroprotección y masa muscular", () => {
    // Solo necesitaban `sodioMax` y `protKg/protG`, que el motor ya entrega. Su texto va verbatim.
    for (const f of ["function dash(", "function nefro(", "function masaMuscular("]) {
      expect(HC, `falta el bloque ${f}`).toContain(f);
    }
    expect(HC).toContain("Al menos 3 g de leucina por comida");
    expect(HC).toContain("Evitar aditivos de fosfato en procesados");
  });

  it("y UNO sigue esperando, con el motivo CORRECTO", () => {
    // Decía "el porte bloqueado", que era falso desde el 23 de agosto: el motor estaba portado y su
    // respuesta había llegado. Lo que de verdad espera es la fórmula del gasto.
    // El comentario CITA la frase vieja para explicar por qué cambió, así que se mira solo el bloque de
    // PENDIENTES, donde vive el motivo vigente. Un candado que caza su propia documentación es ruido.
    const doc = HC.slice(HC.indexOf("// EL UNICO que sigue esperando"), HC.indexOf("const PENDIENTES"));
    expect(doc, "el motivo volvió a ser el porte").not.toContain("porte bloqueado");
    expect(doc).toContain("FORMULA DEL GASTO");
    const i = HC.indexOf("const PENDIENTES");
    const j = HC.indexOf("];", i);
    const bloque = HC.slice(i, j);
    expect(bloque).toContain("Manejo del exceso de grasa corporal");
    expect(bloque, "se quedó pendiente algo que ya se puede resolver").not.toContain("DASH");
  });

  it("sin las cifras, los tres vuelven a marcarse pendientes en vez de inventar una", () => {
    // La otra mitad: si la evaluación no tiene encuesta legible, el motor no corre. Un valor por defecto
    // pondría una cifra inventada en un documento clínico.
    expect(HC).toContain("const hayCifras = ctx.protKg != null && ctx.protG != null");
    expect(HC).toContain("pendiente: true");
  });
});
