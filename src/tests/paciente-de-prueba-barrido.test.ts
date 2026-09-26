import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leyendaDePrueba, ROTULO_DE_PRUEBA } from "@/modules/patients/de-prueba";

// ═══ EL BARRIDO DE "PACIENTE DE PRUEBA", CON SU CANDADO (2026-09-25) ═══
//
// EL PROBLEMA NO ERA LA CASILLA. `patients.is_test` existia desde antes y se respetaba en UN SOLO SITIO (la
// facturacion). En todo lo demas un paciente de prueba contaba igual que uno real. MARCAR SOLO EXCLUYE DONDE
// ALGUIEN ESCRIBIO QUE EXCLUYA, asi que el trabajo era el barrido, y un barrido sin candado se desarma en la
// siguiente pantalla que cuente pacientes.
//
// ── POR QUE ESTE CANDADO MIRA EL CODIGO FUENTE ──
//
// Porque lo que hay que vigilar es una AUSENCIA en un sitio que todavia no existe. Un test de comportamiento
// solo puede probar las cifras que hoy tenemos; este falla cuando alguien escriba una CIFRA NUEVA y se le
// olvide el filtro, que es exactamente como se perdio la primera vez.
//
// Y LA LISTA DE EXCEPCIONES ES EL DOCUMENTO: cada lectura que NO filtra tiene que decir por que. Una excepcion
// sin razon es un olvido con permiso.

const raiz = process.cwd();

const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

describe("la regla de que significa 'de prueba'", () => {
  it("distingue PROPUESTO de MARCADO, porque mientras no se confirme sigue contando", () => {
    // Si la pantalla dijera "de prueba" desde que el profesional lo propone, la pantalla y la cifra se
    // contradirian sobre el mismo paciente. Esa clase de contradiccion (dos partes que leen fuentes
    // distintas) ya nos costo un diagnostico mal leido.
    const propuesto = leyendaDePrueba({ esDePrueba: false, propuesto: true, motivoPropuesto: "es mi cuenta" });
    expect(propuesto).toContain("esperando");
    expect(propuesto).toContain("sigue contando");
    expect(propuesto).not.toBe(ROTULO_DE_PRUEBA);

    const marcado = leyendaDePrueba({ esDePrueba: true, propuesto: false, motivoPropuesto: null });
    expect(marcado).toContain("No cuenta en las cifras");

    expect(leyendaDePrueba({ esDePrueba: false, propuesto: false, motivoPropuesto: null })).toBeNull();
  });
});

describe("las cifras no cuentan a los pacientes de prueba", () => {
  it("el conteo del tablero del profesional los excluye", () => {
    const src = leer("src/modules/dashboard/data/tablero-reader.ts");
    expect(src).toContain('.eq("is_test", false)');
  });

  it("los pacientes asignados de un integrante, en la pantalla de admin, los excluyen", () => {
    const src = leer("src/modules/payments/data/integrante-reader.ts");
    // El join hace falta: la tabla de relacion no sabe si el paciente es de prueba.
    expect(src).toContain("join patients p on p.id = r.patient_id");
    expect(src).toContain("coalesce(p.is_test, false) = false");
  });

  it("la facturacion ya lo respetaba, y sigue", () => {
    const src = leer("src/modules/payments/data/facturacion-repository.ts");
    expect(src).toContain("isTest");
  });
});

describe("la lista del profesional SI los muestra, marcados", () => {
  it("el lector trae la marca y la propuesta", () => {
    const src = leer("src/modules/patients/data/patients-list-reader.ts");
    expect(src).toContain("is_test, test_proposed_at");
    expect(src).toContain("esDePrueba:");
    expect(src).toContain("propuestoDePrueba:");
  });

  it("y NO los filtra, que es lo que la haria inutil para probar", () => {
    const src = leer("src/modules/patients/data/patients-list-reader.ts");
    expect(src).not.toContain('.eq("is_test", false)');
  });
});

describe("solo admin confirma la marca", () => {
  it("el profesional propone y no marca", () => {
    const src = leer("src/modules/patients/data/de-prueba-writer.ts");
    // La propuesta NO toca is_test: si lo tocara, el profesional podria sacar de las cifras a un paciente
    // real sin que nadie lo revise, que es lo que la asimetria existe para impedir.
    const propuesta = src.slice(src.indexOf("export async function proponerPacienteDePrueba"), src.indexOf("export async function resolverPropuestaDePrueba"));
    expect(propuesta).not.toContain("is_test = true");
  });

  it("y las dos acciones de admin exigen canAccessAdmin", () => {
    const src = leer("src/modules/patients/actions.ts");
    const resolver = src.slice(src.indexOf("export async function resolverPropuestaDePruebaAction"));
    expect(resolver).toContain("canAccessAdmin(user)");
    const desmarcar = src.slice(src.indexOf("export async function desmarcarPacienteDePruebaAction"));
    expect(desmarcar).toContain("canAccessAdmin(user)");
  });

  it("los tres actos quedan en el audit", () => {
    const src = leer("src/modules/patients/data/de-prueba-writer.ts");
    expect(src).toContain("paciente.propuesto_de_prueba");
    expect(src).toContain("paciente.marcado_de_prueba");
    expect(src).toContain("paciente.desmarcado_de_prueba");
  });
});
