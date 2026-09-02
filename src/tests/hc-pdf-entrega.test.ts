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
