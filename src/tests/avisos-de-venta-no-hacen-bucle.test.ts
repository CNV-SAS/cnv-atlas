import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ TRES AVISOS QUE SE PISABAN ENTRE SI, Y LA VENTA NO SALIA NUNCA (Santiago, 2026-10-02) ═══
//
// EL BUCLE, con los dos avisos CORRECTOS:
//   1. "ADAPTO-STRESS no estaba prescrito..."  -> "Registrarlo así"
//   2. "...tiene un link de pago sin pagar..." -> "Anular el link y cobrar en efectivo"
//   3. y vuelve al 1, indefinidamente.
//
// LAS DOS CAUSAS, y hacen falta las dos para que el bucle se cierre:
//
//   (a) EL SERVIDOR LOS DABA DE UNO EN UNO. Cada guard devolvia al encontrarse, asi que los avisos se
//       descubrian en vueltas sucesivas y nunca se veian juntos.
//   (b) Y EL CLIENTE PERDIA LA CONFIRMACION ANTERIOR. "Registrarlo así" manda su dato en el `name`/`value`
//       del BOTON, asi que solo viaja en el envio de ESE boton; "Anular el link" envia por `onClick`, sin
//       submitter, y esa confirmacion ya no iba. El servidor volvia a calcular el primer aviso.
//
// SE ARREGLAN LAS DOS. Juntar los avisos mejora lo que se VE; acumular las confirmaciones es lo que GARANTIZA
// que no haya bucle, tambien el dia que se agregue un cuarto aviso que devuelva temprano.

const ACCIONES = sinComentarios(readFileSync("src/modules/payments/actions.ts", "utf8"));
const FORM = sinComentarios(readFileSync("src/modules/payments/components/register-cash-sale-form.tsx", "utf8"));

describe("el servidor devuelve TODOS los avisos juntos", () => {
  it("ningun return trae un aviso lleno y los demas en null a la fuerza", () => {
    // ESA ES LA FORMA EXACTA DEL BUCLE: un guard que, al encontrarse, devuelve SU aviso y apaga los otros
    // escribiendo `null` literal. Asi los demas no llegan a calcularse y se descubren en vueltas sucesivas.
    //
    // Un return con TODOS los avisos en null (el camino de error o el de exito) es legitimo y no cuenta.
    // Y el return conjunto tampoco, porque los tres salen de variables, no del literal `null`.
    const AVISOS = ["outOfPlanWarning", "pendingLinkWarning", "duplicateWarning"];
    const culpables: string[] = [];
    for (const m of ACCIONES.matchAll(/return\s*\{[^}]*\}/g)) {
      const bloque = m[0];
      const presentes = AVISOS.filter((a) => bloque.includes(`${a}:`));
      if (presentes.length === 0) continue;
      const llenos = presentes.filter((a) => !new RegExp(`${a}:\\s*null`).test(bloque));
      const apagados = presentes.filter((a) => new RegExp(`${a}:\\s*null`).test(bloque));
      if (llenos.length > 0 && apagados.length > 0) {
        culpables.push(`${llenos.join(", ")} se devuelve mientras ${apagados.join(", ")} va en null literal`);
      }
    }
    expect(
      culpables,
      "un guard corta con su aviso y apaga los otros: eso es el bucle que Santiago reporto el 2026-10-02",
    ).toEqual([]);
  });

  it("y hay un solo sitio donde se devuelven, con los tres", () => {
    // El control: si alguien borrara el return conjunto, los casos de arriba pasarian por vacuidad.
    expect(ACCIONES).toMatch(/if \(fueraDelPlan \|\| pendingLink \|\| duplicado\)/);
  });
});

describe("el cliente no pierde una confirmacion ya dada", () => {
  it("las acumula en vez de mandar solo la del clic", () => {
    expect(FORM, "dejo de acumular las confirmaciones: una confirmacion perdida reabre el bucle").toMatch(
      /confirmado\.current = \{/,
    );
    // Las tres se re-mandan en CADA envio, vengan de donde vengan.
    for (const campo of ["confirmDuplicate", "anularLinks", "fueraDelPlanConfirmado"]) {
      expect(FORM, `${campo} dejo de re-enviarse desde lo ya confirmado`).toMatch(
        new RegExp(`if \\(confirmado\\.current\\.\\w+\\) fd\\.set\\("${campo}"`),
      );
    }
  });

  it("y la del boton con name/value tambien se recuerda, que es la que se perdia", () => {
    // "Registrarlo así" es el unico que viaja por el submitter. Si solo se mirara `opciones`, su confirmacion
    // se perderia igual que antes y el bucle volveria con otro disfraz.
    expect(FORM).toContain('fd.get("fueraDelPlanConfirmado") === "true"');
  });

  it("caducan al concretarse la venta, para no saltarse los avisos de la siguiente", () => {
    // Arrastrarlas seria el error en el otro sentido: la venta siguiente se registraria sin que nadie viera
    // sus avisos. Van atadas a la clave de idempotencia, que cambia al concretarse una venta.
    expect(FORM).toMatch(/confirmado\.current\.key === keyRef\.current/);
  });

  it("y cuando hay varios avisos, un solo boton los confirma todos", () => {
    expect(FORM).toContain("confirmar-todo");
    expect(FORM, "el boton unico no dice que hace: un 'aceptar todo' generico esconde lo que confirma").toContain(
      "Registrarlo así",
    );
  });
});
