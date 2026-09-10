import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ARCHIVAR, Y NO ELIMINAR (Santiago, 2026-09-10).
//
// LA RAZON DE NO CONSTRUIR ELIMINAR se conserva escrita porque es la que va a volver a preguntarse: un
// paciente con datos clinicos arrastra evaluaciones, diagnosticos sellados y su rastro de auditoria.
// Borrarlo rompe la trazabilidad que la regla dura 8 protege, y ademas deja eventos de auditoria
// apuntando a una entidad que ya no existe.

const WRITER = readFileSync("src/modules/patients/data/patients-archive-writer.ts", "utf8");
const ACCIONES = readFileSync("src/modules/patients/actions.ts", "utf8");
const LISTA = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");

describe("archivar no borra nada", () => {
  it("el writer solo mueve `status`", () => {
    // SI ESTO SE PONE ROJO no basta con ajustar el candado: hay que decirlo EN EL BOTON, porque hoy dice
    // "no se borra nada y se puede deshacer" y el profesional lo pulsa creyendo eso.
    const cuerpo = sinComentarios(WRITER);
    expect(cuerpo, "archivar empezó a borrar").not.toContain("delete(");
    expect(cuerpo).toContain('.set({ status: archivar ? "inactive" : "active" })');
  });

  it("y no toca evaluaciones ni consentimientos", () => {
    const cuerpo = sinComentarios(WRITER);
    for (const tabla of ["evaluations", "patientConsents", "diagnoses"]) {
      expect(cuerpo, `archivar empezó a tocar ${tabla}`).not.toContain(tabla);
    }
  });

  it("es reversible, y por eso no pide confirmación", () => {
    // Una acción de un clic que no se puede deshacer es la que se pulsa por error y no tiene arreglo. Con
    // desarchivar al lado, archivar deja de dar miedo y por eso se usa.
    expect(ACCIONES).toContain("archivar: form.get(\"archivar\") === \"1\"");
    expect(readFileSync("src/modules/patients/components/archivar-paciente.tsx", "utf8")).toContain(
      'archivado ? "Desarchivar" : "Archivar"',
    );
  });
});

describe("queda registrado quién lo sacó de la lista", () => {
  it("con evento propio para cada sentido", () => {
    // Un `{archivado: false}` dentro de un evento llamado "archivado" es la clase de registro que se lee
    // al revés con prisa.
    expect(WRITER).toContain('event: archivar ? "patient.archived" : "patient.unarchived"');
  });

  it("e INLINE en la transacción, nunca por el bus (regla dura 8)", () => {
    // Si la escritura se revierte, el evento también. Si no, quedaría registrado un archivado que no
    // ocurrió.
    const iTx = WRITER.indexOf("db.transaction");
    const iAudit = WRITER.indexOf("recordAudit(tx");
    expect(iTx).toBeGreaterThan(-1);
    expect(iAudit, "el evento se escribe fuera de la transacción").toBeGreaterThan(iTx);
  });

  it("y por qué se audita algo que no es clínico", () => {
    // Porque cambia QUIÉN APARECE en la lista de trabajo, y eso se vuelve clínico por omisión: lo que
    // deja de verse deja de atenderse.
    expect(WRITER).toContain("deja de verse deja de atenderse");
  });
});

describe("la lista los oculta, pero no los esconde", () => {
  it("por defecto no salen", () => {
    // Si siguieran en la lista, el botón no serviría de nada.
    expect(LISTA).toContain('p.status !== "inactive"');
    expect(LISTA).toContain("const [verArchivados, setVerArchivados] = useState(false);");
  });

  it("y hay cómo verlos", () => {
    // Un paciente que desaparece sin forma de encontrarlo es indistinguible de uno borrado, y entonces
    // archivar deja de dar confianza.
    expect(LISTA).toContain("Ver archivados");
    expect(LISTA).toContain("Ocultar archivados");
  });

  it("el interruptor solo aparece si hay alguno", () => {
    // Un mando que siempre vale cero no hace nada e insinúa que hay algo escondido cuando no lo hay.
    expect(LISTA).toContain("archivados > 0 ?");
  });

  it("y la fila archivada lo dice", () => {
    expect(LISTA).toContain("Archivado");
  });
});

describe("la acción NO revalida: la pantalla refresca", () => {
  it("no hay revalidatePath", () => {
    // ESTE CANDADO ME CAZO A MI: la primera versión revalidaba Y la pantalla usa
    // `useFormToastAndRefresh`. Son los dos ciclos que `refresco-una-sola-vez` prohíbe.
    const i = ACCIONES.indexOf("archivarPacienteAction");
    expect(sinComentarios(ACCIONES.slice(i)), "volvió el doble ciclo").not.toContain(
      "revalidatePath(",
    );
  });
});
