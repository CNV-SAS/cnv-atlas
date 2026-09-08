import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { generarCodigoSoporte } from "@/modules/patients/codigo-soporte";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA BUSQUEDA POR DOCUMENTO · UNA EXCEPCION A LA RLS, ACOTADA POR EL TIPO.
//
// POR QUE EXISTE LA EXCEPCION. La RLS solo deja ver al paciente PROPIO. Con la sesion del profesional, el
// documento de un paciente de otro profesional de la misma organizacion "no existe": la pantalla diria
// "no existe", intentaria crearlo, y reventaria el unique `patients_org_document_unique`.
//
// Y EL ARGUMENTO QUE LA JUSTIFICA: **la alternativa no es no filtrar, es filtrar peor.** El error de la
// base YA revela el mismo hecho ("duplicate key value violates unique constraint..."), peor redactado y
// sin control sobre las palabras. Con service role se decide con la verdad y se responde con lo minimo.
//
// LO QUE ESTE CANDADO PROTEGE, y son las dos cautelas que pidio Santiago:
//   a) que salga SOLO el veredicto de tres estados y NUNCA la fila;
//   b) y que toda consulta quede AUDITADA, porque un profesional preguntando documentos ajenos uno por
//      uno podria mapear la organizacion.

const SRC = readFileSync("src/modules/patients/data/buscar-por-documento.ts", "utf8");
const LIMPIO = sinComentarios(SRC);

describe("solo sale el veredicto, nunca la fila", () => {
  it("el tipo de retorno tiene TRES estados y ni uno mas", () => {
    const estados = [...SRC.matchAll(/estado: "(\w+)"/g)].map((m) => m[1]);
    expect(new Set(estados)).toEqual(new Set(["libre", "propio", "ajeno"]));
  });

  it("el caso AJENO no lleva ningún dato del paciente", () => {
    // Es el que importa: el profesional se entera de que existe y de NADA mas. Ni nombre, ni de quien es,
    // ni desde cuando. Si mañana alguien le añade un campo "para ayudar", esto truena.
    //
    // LA ASERCION NO SE RELAJO, SE PRECISO (2026-09-08). Antes exigia el objeto pelado; ahora el caso
    // ajeno lleva un `codigo`, y hay que decir por que eso NO es una excepcion a la regla: es ALEATORIO y
    // nuevo en cada intento, no se deriva del documento ni del paciente (ver `codigo-soporte.ts`), asi
    // que no es un dato del paciente por ninguna via. Lo que sigue prohibido
    // es exactamente lo mismo que antes, y el control de abajo lo demuestra.
    const i = SRC.indexOf('| { estado: "ajeno"; codigo: string }');
    expect(i, "cambió la forma del caso ajeno").toBeGreaterThan(-1);
    const tipo = SRC.slice(SRC.indexOf("export type VeredictoDocumento"), SRC.indexOf("export async function buscarPorDocumento"));
    for (const prohibido of ["firstName", "lastName", "nombre", "documentNumber", "professionalId", "createdAt"]) {
      expect(tipo, ["el veredicto ganó el campo", prohibido].join(" ")).not.toContain(prohibido);
    }
    expect(LIMPIO).toContain('if (veredicto === "ajeno") return { estado: "ajeno", codigo: codigo! };');
  });

  it("y el código de soporte NO se deriva del documento ni del paciente", () => {
    // Si se derivara, filtraria por otra via lo que el mensaje calla: una cedula colombiana son ocho a
    // diez digitos, asi que un hash aunque sea recortado se revierte offline probando el espacio entero.
    const COD = readFileSync("src/modules/patients/codigo-soporte.ts", "utf8");
    const limpio = sinComentarios(COD);
    expect(limpio).toContain("randomBytes");
    for (const derivado of ["documentNumber", "patientId", "createHash", "hmac", "createHmac"]) {
      expect(limpio, ["el código se deriva de", derivado].join(" ")).not.toContain(derivado);
    }
    // Y NUEVO EN CADA INTENTO: con uno estable, dos personas comparando codigos descubririan que
    // apuntaron al mismo documento. Se comprueba generando, no leyendo.
    const distintos = new Set(Array.from({ length: 50 }, () => generarCodigoSoporte()));
    expect(distintos.size, "el código se repite: sería estable por documento").toBe(50);
    for (const c of distintos) expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it("la consulta con service role pide SOLO el id, no la fila", () => {
    // Lo que no se lee no se puede filtrar. Un `select("*")` aqui pondria nombre y documento al alcance
    // de un `console.log` o de un mensaje de error.
    const i = LIMPIO.indexOf("createSupabaseAdminClient()");
    const bloque = LIMPIO.slice(i, i + 500);
    expect(bloque).toContain('.select("id")');
    expect(bloque, "el service role no puede traer el perfil").not.toContain("patient_profiles");
    expect(bloque).not.toContain('select("*")');
  });

  it("y el caso PROPIO solo añade lo que la RLS ya dejaba ver", () => {
    // El `patientId` y la evaluación pendiente son suyos: los podía leer igual. Lo que NO puede pasar es
    // que el camino con service role devuelva algo que la RLS le negaría.
    const i = LIMPIO.indexOf('if (veredicto === "ajeno")');
    const cola = LIMPIO.slice(i);
    expect(cola, "la lectura del propio tiene que ir por RLS, no por admin").toContain(
      "createSupabaseServerClient()",
    );
    expect(cola).not.toContain("createSupabaseAdminClient()");
  });

  it("y 'es mío' se le pregunta a la RLS, no se reimplementa", () => {
    // Duplicar `is_patient_professional` en TypeScript sería una segunda definición de "es mío" que puede
    // divergir de la que de verdad gobierna el acceso, y la copia siempre envejece.
    expect(LIMPIO).toContain("async function esDeEsteProfesional");
    expect(LIMPIO, "no se replica la regla de propiedad").not.toContain(
      "patient_professional_relationships",
    );
  });
});

describe("toda consulta queda auditada", () => {
  it("se audita SIEMPRE, exista o no el documento", () => {
    // Si solo se auditaran los aciertos, barrer documentos ajenos sería invisible: los fallos son
    // justamente el patrón que delataría el barrido.
    const iAudit = LIMPIO.indexOf('event: "patient.document_lookup"');
    const iRetornoLibre = LIMPIO.indexOf('if (veredicto === "libre")');
    expect(iAudit, "desapareció la auditoría").toBeGreaterThan(-1);
    expect(iAudit, "se audita después de salir por el caso libre: ese caso quedaría sin registro").toBeLessThan(
      iRetornoLibre,
    );
  });

  it("el registro dice QUÉ se preguntó y QUÉ se respondió", () => {
    // Sin el documento, el registro no sirve para lo que existe (no se puede ver el barrido). Y el audit
    // log es admin-only para lectura, así que guardarlo ahí no amplía quién puede verlo.
    expect(LIMPIO).toContain("document_number: input.documentNumber");
    expect(LIMPIO).toContain("veredicto,");
  });

  it("y va INLINE, nunca por el bus (regla dura 8)", () => {
    expect(LIMPIO).toContain("db.transaction(");
    expect(LIMPIO).toContain("recordAudit(tx, {");
  });
});
