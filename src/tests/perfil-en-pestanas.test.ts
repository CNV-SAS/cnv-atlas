import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { completitudDelPerfil } from "@/modules/professionals/completitud";
import { PESTANAS, parsePestana } from "@/modules/professionals/pestanas";
import { bankAccountSchema, taxIdentitySchema } from "@/modules/professionals/validations";

// ═══ EL PERFIL EN PESTAÑAS (2026-09-25) ═══
//
// LO QUE ESTO PROTEGE ES EL CORTE, no la pantalla. Lo tributario y lo bancario eran UN formulario con UN
// envio, y partirlos rompe dos cosas que no se ven leyendo el codigo nuevo:
//
//   1 · cada mitad tiene que poder guardarse SOLA (si un schema sigue exigiendo campos de la otra, la pestaña
//       no guarda nunca y el error habla de un campo que no esta en pantalla);
//   2 · y la marca de "el integrante dio su parte", que es el gate que deja LIQUIDAR, tiene que seguir
//       exigiendo LAS DOS. Ese es el riesgo real del corte: un perfil "completo" sin cuenta bancaria deja
//       pasar un giro que no tiene a donde ir.
//
// El punto 2 se verifica contra la base en `perfil-completitud-db.test.ts`, porque la marca la calcula el
// escritor leyendo la fila.

describe("el corte del formulario del perfil", () => {
  const tributaria = { personType: "natural", hasRut: true, idType: "CC", idNumber: "1020304050", idDv: null };
  const bancaria = {
    bankName: "Bancolombia",
    bankAccountType: "ahorros",
    bankAccountNumber: "123456789",
    bankAccountHolderName: "Nombre Apellido",
    bankAccountHolderDocument: "1020304050",
  };

  it("lo tributario se guarda sin la cuenta", () => {
    expect(taxIdentitySchema.safeParse(tributaria).success).toBe(true);
  });

  it("la cuenta se guarda sin lo tributario", () => {
    expect(bankAccountSchema.safeParse(bancaria).success).toBe(true);
  });

  it("y ninguno de los dos pide campos del otro", () => {
    // Si un schema colara un campo de la otra mitad, su pestaña mostraria un error sobre algo que no esta en
    // pantalla, que es el peor error posible: el usuario no puede corregirlo.
    const t = taxIdentitySchema.parse(tributaria) as Record<string, unknown>;
    const b = bankAccountSchema.parse(bancaria) as Record<string, unknown>;
    expect(Object.keys(t).some((k) => k.startsWith("bank"))).toBe(false);
    expect(Object.keys(b).some((k) => k === "personType" || k === "idNumber" || k === "hasRut")).toBe(false);
  });
});

describe("la pestaña activa", () => {
  it("vive en la URL y una desconocida cae a la primera", () => {
    // Con estado local, recargar o compartir un enlace abria SIEMPRE en la primera. Es el mismo bug que ya
    // tuvimos en las etapas de la evaluacion, y por eso aqui la pestaña es un parametro.
    expect(parsePestana("bancaria")).toBe("bancaria");
    expect(parsePestana(null)).toBe("datos");
    expect(parsePestana("inventada")).toBe("datos");
  });

  it("y toda pestaña de la lista es alcanzable por la URL", () => {
    // El parseo valida contra la LISTA: agregar una pestaña y olvidar el parseo daria una a la que la URL
    // nunca llega, y se veria como "el enlace no funciona".
    for (const p of PESTANAS) expect(parsePestana(p.id)).toBe(p.id);
  });
});

describe("la completitud del perfil", () => {
  const vacio = {
    personType: null,
    idNumber: null,
    rutUploaded: false,
    hasRut: null,
    rutVerified: false,
    bankName: null,
    bankAccountNumber: null,
    bankAccountHolderDocument: null,
    license: null,
  };

  it("dice QUE falta, no solo cuanto", () => {
    const c = completitudDelPerfil(vacio);
    expect(c.porcentaje).toBe(0);
    // Un porcentaje sin la lista no se puede accionar: es la razon de que la lista sea el dato principal.
    expect(c.faltantes.length).toBe(c.total);
    expect(c.faltantes.join(" ")).toContain("registro profesional");
  });

  it("no le exige el RUT a quien declara que no tiene", () => {
    // Exigirselo dejaria su perfil incompleto para siempre por algo que no puede resolver.
    const sinRut = completitudDelPerfil({ ...vacio, hasRut: false });
    const conRut = completitudDelPerfil({ ...vacio, hasRut: true });
    expect(sinRut.total).toBe(conRut.total - 2);
    expect(sinRut.faltantes.join(" ")).not.toContain("RUT en PDF");
  });

  it("separa lo que hace el integrante de lo que hace CNV", () => {
    // Subir el RUT es de el; verificarlo es de CNV. Mezclarlos le pediria algo que no depende de el.
    const subido = completitudDelPerfil({ ...vacio, hasRut: true, rutUploaded: true });
    expect(subido.faltantes.join(" ")).not.toContain("Subir tu RUT");
    expect(subido.faltantes.join(" ")).toContain("la hace CNV");
  });

  it("llega a 100 cuando no falta nada", () => {
    const completo = completitudDelPerfil({
      personType: "natural",
      idNumber: "1020304050",
      rutUploaded: true,
      hasRut: true,
      rutVerified: true,
      bankName: "Bancolombia",
      bankAccountNumber: "123456789",
      bankAccountHolderDocument: "1020304050",
      license: "RM-12345",
    });
    expect(completo.porcentaje).toBe(100);
    expect(completo.faltantes).toEqual([]);
  });
});
