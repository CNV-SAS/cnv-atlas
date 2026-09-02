import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA HISTORIA CLINICA EN PDF Y DE SU ENTREGA (2026-09-02).
//
// LA CONDICIÓN QUE SANTIAGO PUSO PARA PORTARLA, y es lo que este candado protege por encima de todo: **el
// PDF y la pantalla salen del MISMO lector**. Sin eso, portar la historia a `@react-pdf` habría creado la
// segunda construcción que llevamos una semana evitando, y esta es de un documento probatorio.
//
// Y por qué se portó en vez de renderizar la pantalla con un navegador sin interfaz (la "tercera vía"): esa
// paga con una superficie AUTENTICADA NUEVA PARA PHI, además de una dependencia pesada y arranques en frío.
// Reescribir los bloques sobre `@react-pdf`, que ya está aprobado y ya tenía andamiaje, no abre superficie.

const DOC = readFileSync("src/modules/reports/pdf/hc-document.tsx", "utf8");
const READER = readFileSync("src/modules/reports/data/hc-documento-reader.ts", "utf8");
const SERVICIO = readFileSync("src/modules/reports/services/entregar-hc.ts", "utf8");
const WRITER = readFileSync("src/modules/reports/data/hc-entregas-writer.ts", "utf8");
const MIGRACION = readFileSync("drizzle/0098_hc_entregas.sql", "utf8");
const PAGE = sinComentarios(readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8"));

describe("el PDF no compone: recibe lo que compone el lector de la pantalla", () => {
  it("el documento solo recibe un `HistoriaClinicaDoc`", () => {
    expect(sinComentarios(DOC)).toContain("hc: HistoriaClinicaDoc");
    // Las señales de que hubiera empezado a componer por su cuenta.
    for (const prohibido of ["computeProtocoloEfectivo", "recomendacionesDe", "resolverAntecedentes"]) {
      expect(sinComentarios(DOC), `el PDF empezó a componer: ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("y el lector usa la MISMA composición y los MISMOS lectores que la pantalla", () => {
    expect(READER).toContain("componerHistoriaClinica(");
    for (const compartido of [
      "getHcHeaderForEvaluation",
      "resolverAntecedentes",
      "listReferralsForTreatment",
      "getPatientConsents",
    ]) {
      expect(READER, `el PDF dejó de usar el lector compartido ${compartido}`).toContain(compartido);
    }
  });
});

describe("el sello de consentimiento VIAJA al PDF", () => {
  it("lleva la versión de ESTA consulta, no la vigente hoy", () => {
    // "Hubo permiso" sin decir de qué texto no es constancia de nada: las autorizaciones cambian de
    // redacción y lo que se pactó fue el texto de SU versión.
    expect(READER).toContain("consentVersion: header.consentVersion");
    expect(DOC).toContain("hc.consentVersion");
  });

  it("y distingue REVOCADA de NUNCA OTORGADA, como la pantalla", () => {
    // En un documento probatorio la diferencia es la que importa: una dice que el permiso existió y se
    // retiró, la otra que nunca lo hubo. Un solo "no" las confundiría.
    expect(DOC).toContain('"Vigente"');
    expect(DOC).toContain('"Revocada"');
    expect(DOC).toContain('"No otorgada"');
  });

  it("y va ANTES de la firma, que es donde cierra el documento", () => {
    const sello = DOC.indexOf("Autorizaciones del paciente");
    const firma = DOC.indexOf("Profesional tratante");
    expect(sello).toBeGreaterThan(-1);
    expect(firma).toBeGreaterThan(sello);
  });
});

describe("la entrega queda registrada donde el profesional pueda MOSTRARLA", () => {
  it("en una tabla de dominio con su RLS, no solo en el audit log", () => {
    // `clinical_audit_log` es admin-only para SELECT: un registro que el profesional escribe y no ve nunca
    // es medio registro. Es la lección del descarte del aviso de alérgeno: un almacén se elige por TODAS
    // sus propiedades, y la de LECTURA es la que se olvida.
    expect(MIGRACION).toContain("create table if not exists hc_deliveries");
    expect(MIGRACION).toContain("enable row level security");
    expect(MIGRACION).toContain("hc_deliveries_select");
  });

  it("Y TAMBIÉN en el audit log, inline en la misma transacción (regla dura 8)", () => {
    // No es duplicar: la tabla es el HECHO que el profesional consulta; el log es el RASTRO del acto con
    // su actor y su IP, que es lo que se revisa cuando alguien pregunta quién sacó un documento con PHI.
    expect(WRITER).toContain("db.transaction");
    expect(WRITER).toContain("recordAudit(tx");
    expect(WRITER).toContain('event: "hc.delivered"');
    // El destino va al rastro: "se le envió a su correo" sin decir a cuál no prueba nada.
    expect(WRITER).toContain("sent_to: input.sentTo");
  });

  it("y el registro va DESPUÉS del correo: no se registra lo que no salió", () => {
    // Mismo orden que `sendReport` (D4, la acción externa hacia afuera). Si el correo falla, no puede
    // quedar un registro diciendo que se entregó algo que nunca salió.
    const correo = SERVICIO.indexOf("sendReportEmail(");
    const registro = SERVICIO.indexOf("writeHcDelivery(");
    expect(correo).toBeGreaterThan(-1);
    expect(registro, "el registro quedó antes del envío").toBeGreaterThan(correo);
    expect(SERVICIO).toContain("if (!enviado.ok) return enviado;");
  });

  it("y la pantalla dice cuándo se entregó, que es para lo que existe la tabla", () => {
    expect(PAGE).toContain("getUltimaEntregaHc(id)");
    expect(PAGE).toContain("<HcEntregar");
  });
});

describe("sin correo del paciente se dice qué falta y dónde se arregla", () => {
  it("no un 'no se pudo enviar' genérico", () => {
    // Un error genérico deja al profesional sin saber si el problema es suyo, del paciente o del sistema.
    expect(SERVICIO).toContain("no tiene un correo registrado");
    expect(SERVICIO).toContain("Regístralo en su ficha");
  });
});

// ── LOS SIETE BLOQUES QUE FALTABAN (smoke de Santiago, 2026-09-02) ─────────────────────────────────
//
// EL PDF ENVIADO NO LLEVABA: el resumen diagnóstico del nutricionista, el DFI narrativo, la meta
// terapéutica, la composición corporal, los índices ANI y las rutas activadas. **Los seis por la MISMA
// razón**: el lector pasaba `snapshot: null`, así que todo lo que depende del diagnóstico salía vacío.
//
// Y LA LECTURA DE SANTIAGO, que es la que gobierna: es el mismo documento por otro canal, y el paciente que
// pide su historia clínica tiene derecho a la COMPLETA, no a un extracto. Una HC sin el diagnóstico
// funcional ni la composición corporal no es la historia clínica: es un resumen, que es justo lo que el
// legal dijo que no se puede entregar.
describe("el PDF lleva TODO lo que lleva la pantalla, no un extracto", () => {
  it("el lector carga el snapshot del diagnóstico", () => {
    // La causa raíz de los seis: sin esto, todos los bloques del diagnóstico salían vacíos.
    expect(READER).toContain("getEvaluationResults(evaluationId)");
    expect(sinComentarios(READER)).not.toContain("snapshot: null,");
  });

  it.each([
    ["resumen diagnóstico del nutricionista", "resumenProfesional"],
    ["DFI narrativo", "dfiParrafo"],
    ["meta terapéutica", "metaTerapeutica"],
    ["índices ANI", "indices"],
    ["rutas activadas", "rutas"],
    ["composición corporal", "composicion"],
    ["remisiones", "remisiones"],
  ])("y el documento imprime %s", (_n, campo) => {
    expect(sinComentarios(DOC), `el PDF no imprime ${campo}`).toContain(`hc.${campo}`);
  });

  it("el resumen del profesional es SIEMPRE el del nutricionista", () => {
    // No el de quien genera el documento: la historia que se entrega no puede depender de quién la sacó.
    expect(READER).toContain('"nutricionista"');
  });

  it("y cuando la narrativa NO se puede emitir, se dice POR QUÉ", () => {
    // Un bloque ausente sin explicación, en un documento probatorio, se lee como que no se evaluó.
    expect(READER).toContain("motivoSinNarrativa");
    expect(DOC).toContain("hc.motivoSinNarrativa");
  });

  it("los índices ANI SÍ van aquí, al revés que en el reporte del paciente", () => {
    // CONTROL de que este candado y el de `report-render` no se confundan: lo que allí está prohibido,
    // aquí es obligatorio. Su §7.1 prohíbe los índices en lo que el paciente recibe COMO reporte; la
    // historia que él mismo pide es su registro clínico.
    expect(DOC).toContain("Índices ANI BIS-E");
  });

  it("y la composición lleva su VEREDICTO, del clasificador compartido", () => {
    // Al portar la HC esto salió sin clasificación: `wangRowDx` necesitaba un contexto que solo armaba el
    // componente de pantalla, y reconstruirlo aquí habría sido una segunda construcción del clasificador
    // (si divergiera, la historia impresa y la enviada clasificarían distinto al mismo paciente).
    //
    // Ese contexto vive ahora en `composicionClasificada`, que llaman los dos. El veredicto por fila es
    // información clínica y no podía estar en una sola de las dos historias.
    expect(sinComentarios(READER)).toContain("composicionClasificada(composition, sexoM)");
    // Y el reader sigue SIN reconstruirlo por su cuenta.
    expect(sinComentarios(READER)).not.toContain("computeRefPob");
    expect(sinComentarios(READER)).not.toContain("wangRowDx(");
  });
});

// ── LO QUE SALIO DEL COTEJO DEL PDF ENVIADO (versión 2, 2026-09-02) ────────────────────────────────
//
// Se extrajo el TEXTO del PDF real y se comparó bloque por bloque contra la pantalla. Dos hallazgos, y los
// dos de la misma familia: **un bloque que en pantalla dice "no hay" y en el PDF desaparece.**
describe("los quince bloques van SIEMPRE, con o sin dato", () => {
  // EN UN DOCUMENTO PROBATORIO LA DIFERENCIA DECIDE: un bloque AUSENTE se lee como que no se evaluó; uno
  // que dice "no se registró" dice que se miró y no había. En la pantalla estos bloques SÍ aparecen
  // vacíos; en el PDF se omitían, así que el documento enviado tenía menos bloques que el impreso.
  it.each([
    ["Objetivo del tratamiento", "No se registró"],
    ["Remisiones", "No se remitió a otro profesional"],
    ["Rutas de atención activadas", "no activó rutas"],
    ["Composición corporal", "no tiene medición de composición"],
    ["Índices ANI BIS-E alterados", "quedó fuera de su rango"],
  ])("%s se imprime aunque esté vacío", (titulo, vacio) => {
    expect(DOC, `falta el bloque ${titulo}`).toContain(titulo);
    expect(DOC, `${titulo} desaparece cuando no hay dato`).toContain(vacio);
  });

  it("y la SECCIÓN nunca cuelga de un condicional: solo su contenido", () => {
    // LA FORMA EXACTA QUE LOS HACÍA DESAPARECER, y la distinción importa: que el CONTENIDO elija entre la
    // lista y el "no hay" está bien; lo que no puede es que el `<Seccion>` entero viva dentro de un
    // `length > 0 ? (`, porque entonces el bloque se va del documento.
    //
    // (Mi primera versión de este candado prohibía la cadena a secas y se puso roja sobre el código
    // CORRECTO, que usa ese mismo condicional dentro de la sección para elegir el contenido.)
    const codigo = sinComentarios(DOC);
    for (const titulo of [
      "Objetivo del tratamiento",
      "Remisiones",
      "Rutas de atención activadas",
      "Composición corporal",
      "Índices ANI BIS-E alterados",
      "Observaciones del profesional",
      "Recomendaciones",
    ]) {
      const i = codigo.indexOf(`<Seccion titulo="${titulo}">`);
      expect(i, `falta la sección ${titulo}`).toBeGreaterThan(-1);
      const antes = codigo.slice(Math.max(0, i - 90), i);
      // Se comprueba sin regex a propósito: al escribir este archivo por script los escapes se pierden, y
      // una regex rota aquí haría pasar el candado por construcción (ya me pasó tres veces esta semana).
      expect(
        antes.trimEnd().endsWith("? ("),
        `la sección ${titulo} quedó dentro de un condicional`,
      ).toBe(false);
    }
  });
});

describe("el solapamiento de `Meta terapéutica`", () => {
  it("las secciones se pueden partir entre hojas; lo que no se parte es la fila", () => {
    // `wrap={false}` en la sección le prohíbe partirse: cuando no cabe, `@react-pdf` la empuja, y si
    // tampoco cabe allí la PINTA ENCIMA de lo que sigue. Un párrafo largo es justo ese caso.
    const seccion = DOC.slice(DOC.indexOf("function Seccion("), DOC.indexOf("function Dato("));
    expect(seccion, "la sección volvió a llevar wrap={false}").not.toContain("wrap={false}");
    // Y la unidad chica sí: una fila de datos partida a la mitad es ilegible.
    const dato = DOC.slice(DOC.indexOf("function Dato("), DOC.indexOf("const noRegistrado"));
    expect(dato).toContain("wrap={false}");
  });

  it("y el título no se queda solo al pie de una hoja", () => {
    expect(DOC).toContain("minPresenceAhead");
  });
});
