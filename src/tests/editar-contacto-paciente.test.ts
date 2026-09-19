import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CORREGIR EL CONTACTO DEL PACIENTE, Y SOLO EL CONTACTO (2026-09-19) ═══
//
// DE DONDE SALE: en el smoke, un paciente que empeoró no tenía correo, así que no se le podía entregar ni
// el reporte ni la historia clínica, y la ficha era de solo lectura entera.
//
// LO QUE ESTE CANDADO PROTEGE NO ES LA FUNCIÓN, ES SU FRONTERA. Corregir nombre, documento o fecha de
// nacimiento toca la resolución de identidad, la auditoría clínica y el consentimiento firmado: es el
// punto 2 del backlog, diferido con esa nota. Si mañana alguien "completa" este formulario añadiendo esos
// campos, se salta esa decisión sin que nadie lo note. Por eso la ausencia se afirma aquí.

const ACCIONES = sinComentarios(readFileSync("src/modules/patients/actions.ts", "utf8"));
const WRITER = sinComentarios(readFileSync("src/modules/patients/data/patient-contact-writer.ts", "utf8"));
const UI = sinComentarios(readFileSync("src/modules/patients/components/editar-contacto.tsx", "utf8"));
const POLICY = readFileSync("src/modules/patients/policies/can-edit-patient-contact.ts", "utf8");
const VALIDACIONES = sinComentarios(readFileSync("src/modules/patients/validations.ts", "utf8"));

describe("solo se corrige el contacto", () => {
  it("la identidad NO viaja en el formulario ni en el esquema", () => {
    for (const campo of ["firstName", "lastName", "documentNumber", "documentType", "birthDate"]) {
      expect(UI, `el formulario abrió la puerta a ${campo}`).not.toContain(`name="${campo}"`);
      expect(
        VALIDACIONES.slice(VALIDACIONES.indexOf("contactoPacienteSchema")),
        `el esquema del contacto aceptó ${campo}`,
      ).not.toContain(campo);
    }
  });

  it("y el writer escribe SOLO la tabla de contacto", () => {
    expect(WRITER).toContain("patientContacts");
    for (const tabla of ["patientProfiles", "patients,", "patientConsents"]) {
      expect(WRITER, `el writer tocó ${tabla}`).not.toContain(tabla);
    }
  });

  it("la pantalla DICE por qué la identidad no está aquí", () => {
    // Un campo ausente sin explicación se lee como un olvido, y alguien lo "arregla".
    expect(UI).toContain("no se corrigen aquí");
    expect(UI).toContain("consentimiento");
  });
});

describe("la escritura deja rastro y no se salta la autorización", () => {
  it("guarda el valor ANTERIOR, que es la pregunta que el backlog dejaba abierta", () => {
    expect(WRITER).toContain('event: "patient.contact_updated"');
    expect(WRITER).toContain("email_anterior");
    expect(WRITER).toContain("telefono_anterior");
  });

  it("el rastro va INLINE en la misma transacción (regla dura 8)", () => {
    const tx = WRITER.slice(WRITER.indexOf("db.transaction"));
    expect(tx).toContain("recordAudit(tx");
  });

  it("es un UPSERT: un paciente sin fila de contacto tiene que poder recibir la suya", () => {
    // Con un UPDATE a secas, el guardado no tendría efecto y tampoco daría error: la pantalla diría
    // "guardado" y el paciente seguiría sin correo, que es justo el caso que esto viene a resolver.
    expect(WRITER).toContain("onConflictDoUpdate");
  });

  it("la action verifica la policy Y que el paciente sea suyo (leyéndolo bajo RLS)", () => {
    const fn = ACCIONES.slice(ACCIONES.indexOf("export async function guardarContactoPacienteAction"));
    expect(fn).toContain("canEditPatientContact(user)");
    expect(fn, "sin leerlo bajo RLS, se escribiría sobre un paciente ajeno").toContain(
      "getPatientDetail(",
    );
    expect(fn).toContain("No se encontró ese paciente.");
  });

  it("el correo se valida como correo, no como texto cualquiera", () => {
    // Si no, el envío falla después, lejos de este formulario y con un mensaje que no habla de él.
    const schema = VALIDACIONES.slice(VALIDACIONES.indexOf("contactoPacienteSchema"));
    expect(schema).toContain("email()");
    expect(schema, "el vacío tiene que guardarse como null, no como cadena vacía").toContain("null");
  });

  it("la policy es del profesional y del admin, no de cualquiera", () => {
    expect(POLICY).toContain('hasAnyRole(user, ["professional", "admin"])');
  });
});
