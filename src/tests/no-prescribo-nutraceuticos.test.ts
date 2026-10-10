import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ "NO PRESCRIBO NUTRACÉUTICOS" ES OTRO HECHO, NO OTRO NOMBRE (Santiago, 2026-10-10. Migración 0214) ═══
//
// ── DE DÓNDE SALE ────────────────────────────────────────────────────────────────────────────────
//
// De su reunión con la integrante que más vende. Textual suyo: *"una cosa es prescribir un producto, que
// básicamente eso lo hacen los integrantes, y otra cosa es que el paciente quiera comprar o no quiera comprar
// algún producto"*, y la mitad que decide: *"no me parece correcto registrar por qué un paciente no se lleva un
// producto cuando puede ser por precio y muchas razones"*.
//
// ── QUÉ PROTEGE ESTE CANDADO, Y POR QUÉ CADA COSA ───────────────────────────────────────────────
//
// 1. QUE LOS DOS HECHOS NO SE FUNDAN. El campo viejo (`nutraceutical_decision`) preguntaba si el PACIENTE
//    adquiere; el nuevo registra el criterio del PROFESIONAL. Santiago eligió la opción (a), campo nuevo con
//    el viejo congelado, y su razón es la que hay que sostener: *"lo que se registra aquí entra en la
//    investigación, así que reinterpretar el histórico ensucia justo lo que el campo existe para medir."*
//    El día que alguien "simplifique" reusando el viejo, el histórico pasa a leerse como criterio clínico.
//
// 2. QUE EL HISTÓRICO SE SIGA VIENDO. Hay consultas cerradas con el registro viejo, y es su historia clínica.
//    Se retiró la forma de ESCRIBIRLO, no la de leerlo.
//
// 3. LOS HAZARDS DE FORMULARIO. El bloque vive DENTRO del formulario de la prescripción, y ahí el hazard 7 de
//    CLAUDE.md ya nos costó un bloqueo real (un `<form>` dentro de otro: el navegador descarta el interno, y
//    pulsar "Registrar" guardaba la prescripción). Los campos van sin `name` por lo mismo: con `name`
//    viajarían en el envío de afuera, que es la mitad del defecto que no se ve.
//
// 4. QUE LA LISTA DE PENDIENTES CONOZCA LA VÍA NUEVA. Eso lo prueba `cierre-consulta.test.ts`; aquí se vigila
//    que el detalle del pendiente no vuelva a nombrar el botón retirado.
const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");
/**
 * El archivo SIN COMENTARIOS. Hace falta porque estos comentarios NOMBRAN lo que prohiben (un <form> dentro
 * de otro, un `name`), y buscarlo sobre el texto crudo se acusa a si mismo: el candado daria rojo por su
 * propia explicacion. Es el mismo cuidado del candado de los backticks en SQL, que empezo acusando a seis
 * archivos correctos.
 */
const soloCodigo = (rel: string) =>
  leer(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

const NUEVO = "src/modules/treatment/components/sin-prescripcion-form.tsx";
const VIEJO = "src/modules/treatment/components/no-los-adquiere-form.tsx";
const SECCION = "src/modules/treatment/components/nutraceuticals-section.tsx";
const WRITER = "src/modules/treatment/data/treatment-writer.ts";
const VALIDACIONES = "src/modules/treatment/validations.ts";
const MIGRACION = "drizzle/0214_no_prescribo_nutraceuticos.sql";

describe("el criterio clínico se registra en su propio campo", () => {
  it("escribe las tres columnas nuevas y NO toca la congelada", () => {
    const src = leer(WRITER);
    const bloque = src.slice(
      src.indexOf("export async function registrarSinPrescripcion"),
      src.indexOf("export type SaveTiemposActivosWrite"),
    );
    expect(bloque).toContain("sinPrescripcionMotivo: input.motivo");
    expect(bloque).toContain("sinPrescripcionAt:");
    expect(bloque).toContain("sinPrescripcionBy: input.actorId");
    // SI ESTO FALLA, el histórico del campo viejo pasa a leerse como criterio clínico, que es justo lo que la
    // opción (a) se eligió para evitar.
    expect(bloque, "el camino nuevo no escribe el campo congelado").not.toContain("nutraceuticalDecision");
  });

  it("no deja registrarlo si ya hay prescripción, y lo comprueba en la transacción", () => {
    const src = leer(WRITER);
    const bloque = src.slice(
      src.indexOf("export async function registrarSinPrescripcion"),
      src.indexOf("export type SaveTiemposActivosWrite"),
    );
    // Decir las dos cosas sobre la misma consulta deja a quien la lea después sin saber cuál creer, y es la
    // historia clínica. La pantalla ya no lo ofrece, pero una guarda que solo vive en la pantalla se salta
    // invocando la acción.
    expect(bloque).toContain("treatmentNutraceuticals.treatmentId");
    expect(bloque).toContain("TreatmentStateError");
  });

  it("el motivo es obligatorio, con el mismo mínimo que el CHECK de la base", () => {
    expect(leer(VALIDACIONES)).toContain("registrarSinPrescripcionSchema");
    expect(leer(VALIDACIONES)).toMatch(/\.min\(5,/);
    expect(leer(MIGRACION)).toContain('length(btrim("sin_prescripcion_motivo")) >= 5');
  });

  it("y la migración congela el campo viejo en vez de borrarlo", () => {
    const sql = leer(MIGRACION);
    expect(sql).toContain('COMMENT ON COLUMN "treatments"."nutraceutical_decision"');
    expect(sql).toContain("CONGELADO");
    expect(sql, "un campo con historico clinico no se borra").not.toMatch(/DROP COLUMN[^;]*nutraceutical_decision/);
  });
});

describe("la pantalla ofrece la vía nueva y solo LEE la vieja", () => {
  it("el botón va junto a Guardar prescripción", () => {
    const src = leer(SECCION);
    expect(src).toContain("<SinPrescripcionForm");
    // SE CORTA HASTA UN LINDERO, NO A N CARACTERES: con una ventana fija, el primer comentario que se
    // escriba en medio empuja la asercion fuera y el candado truena contra codigo correcto. Ya paso dos
    // veces en este proyecto.
    const i = src.indexOf('{pending ? "Guardando..." : "Guardar prescripción"}');
    const j = src.indexOf("{faltaCerrar ?", i);
    expect(i, "desaparecio el boton de guardar").toBeGreaterThan(0);
    expect(j, "desaparecio el aviso de falta cerrar, que es el lindero").toBeGreaterThan(i);
    expect(
      src.slice(i, j),
      "las dos salidas van juntas: es el momento en que el profesional cierra",
    ).toContain("<SinPrescripcionForm");
  });

  it("el bloque viejo ya no puede escribir: ni acción, ni campos, ni botón", () => {
    const src = leer(VIEJO);
    expect(src).not.toContain("saveNutraDecisionAction");
    expect(src).not.toContain("ejecutarAccion");
    expect(src).not.toContain("<Input");
    // Y sigue mostrando lo registrado, que es a lo que se queda reducido.
    expect(src).toContain("no los adquiere");
  });

  it("pero la lectura del histórico sigue montada", () => {
    const src = leer(SECCION);
    expect(src).toContain("<NoLosAdquiereForm");
    expect(src).toContain('protocol.nutraceuticalDecision?.decision === "no"');
  });

  it("el bloque nuevo no anida un <form> (hazard 7) ni pone name a sus campos (hazard 4)", () => {
    const src = soloCodigo(NUEVO);
    expect(src, "un <form> dentro de otro lo descarta el navegador").not.toContain("<form");
    expect(src, "con name, el campo viajaría en el envío de la prescripción").not.toMatch(/\bname="/);
    expect(src).toContain("ejecutarAccion");
    // Los dos botones, de tipo button: un submit aquí enviaría el formulario de afuera.
    expect(src.match(/type="button"/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("y el aviso de 'falta cerrar' nombra la salida que existe hoy", () => {
    const src = leer(SECCION);
    expect(src).toContain("<strong>No prescribo nutracéuticos</strong>");
    expect(src, "nombraba un botón retirado").not.toContain("<strong>el paciente no los adquiere por ahora</strong>");
  });
});

// ═══ LAS DOS REGLAS QUE FALTABAN, Y QUE SALIERON DE PROBARLO (Santiago, 2026-10-10) ═══
//
// 1. EL GUARD LEIA LA FUENTE EQUIVOCADA. Él quitó de la grilla unos nutracéuticos ya prescritos, pulsó el
//    botón nuevo, y le salió *"quítalos de la prescripción antes de registrar"*. Textual suyo: *"esto es falso,
//    no se pueden quitar de la prescripción."*
//
//    Y tenía razón dos veces. Quitar una línea de la grilla es estado del NAVEGADOR: el registro seguía
//    teniéndolos, así que el rechazo del servidor era correcto. Pero la salida que el mensaje proponía NO
//    EXISTE, porque guardar una prescripción vacía lo frena el aviso de "no hay nada que guardar todavía". El
//    mensaje mandaba a una puerta cerrada.
//
//    ES EL DEFECTO DE SIEMPRE AQUÍ: dos partes de la pantalla leyendo fuentes distintas del mismo hecho. El
//    arreglo no es cambiar el mensaje, es unir las fuentes: el botón mira LO GUARDADO (y también la grilla, para
//    no ofrecerlo con líneas a punto de guardarse).
//
// 2. Y SE PUEDE CAMBIAR DE DECISIÓN. Suyo: *"puede pasar que primero el profesional no quiera prescribir, pero
//    luego sí lo haga. En ese caso NO debería bloquear."* Lo único que no puede pasar es tener las dos cosas a
//    la vez, y por eso prescribir LEVANTA el "no prescribo", en la misma transacción.
describe("el botón mira lo guardado, no lo que hay en la grilla", () => {
  it("la pantalla pasa las DOS fuentes", () => {
    const src = leer(SECCION);
    expect(src).toContain("hayPrescripcion={protocol.nutraceuticals.length > 0 || nutras.length > 0}");
  });

  it("y el rechazo del servidor ya no manda a quitar lo que no se puede quitar", () => {
    // SIN COMENTARIOS: el writer CITA el mensaje viejo para explicar por que se fue.
    const src = soloCodigo(WRITER);
    expect(src, "el mensaje volvió a mandar a una puerta cerrada").not.toMatch(/[Qq]uítalos de la prescripción/);
    expect(src).toContain("ya tiene una prescripción guardada");
  });
});

describe("se puede cambiar de decisión: prescribir levanta el 'no prescribo'", () => {
  it("se levanta DENTRO del guardado de la prescripción, no en un segundo paso", () => {
    // Si fueran dos pasos, un fallo entre ellos dejaría la consulta afirmando las dos cosas a la vez, que es
    // justo lo que hay que impedir. El comportamiento contra BD real lo prueba `protocol-concurrency.test.ts`
    // ("sin prescripcion se registra, y PRESCRIBIR DESPUES lo levanta solo"); aquí se vigila que siga estando
    // en la misma transacción.
    const src = leer(WRITER);
    const guardado = src.slice(
      src.indexOf("export async function saveNutraceuticals"),
      src.indexOf("export type AddNoteWrite"),
    );
    expect(guardado).toContain("sinPrescripcionMotivo: null");
    expect(guardado).toContain("isNotNull(treatments.sinPrescripcionMotivo)");
    // Y NO SE PIERDE EL HECHO DE QUE EXISTIÓ: queda en el audit log, que es donde vive una decisión corregida.
    expect(guardado).toContain('event: "treatment.sin_prescripcion_levantada"');
  });

  it("y el candado de BD que lo prueba sigue en la suite", () => {
    // Un candado estático sobre una propiedad transaccional no basta; este caso evita que el de BD se borre y
    // quede solo el de arriba, que pasaría con una implementación rota en dos pasos.
    const db = leer("src/tests/protocol-concurrency.test.ts");
    expect(db).toContain("PRESCRIBIR DESPUES lo levanta solo");
    expect(leer("vitest.config.ts")).toContain("src/tests/protocol-concurrency.test.ts");
  });
});
