import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { rolDeUsuarioSchema } from "@/modules/auth/admin-validations";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: UN ROL QUE SE PUEDE DAR TAMBIEN SE PUEDE QUITAR, Y NO DEJA A NADIE FUERA ═══
//
// ── DE DONDE SALE (Santiago, 2026-10-24) ─────────────────────────────────────────────────────────
//
// *"Gildardo queda con profesional y obbia a la vez. Asignale el rol obbia."*
//
// `user_roles` es N:N desde el inicio y `hasAnyRole` ya soportaba varios roles, pero el UNICO sitio que
// escribia esa tabla era `createUser`: al nacer la cuenta, y con UN rol. El modelo admitia dos y el sistema
// no tenia forma de dar el segundo, asi que la unica via era SQL a mano contra produccion.
//
// LO QUE ESTO DEFIENDE, que no es el camino felizac:
//
//   1. QUE EXISTA EL CAMINO DE VUELTA. Dar un permiso sin construir como se revoca deja a CNV con una
//      llave que solo se quita pidiendole a alguien que escriba SQL.
//   2. QUE NO SE QUITE EL ULTIMO ROL. Un usuario sin ningun rol entra y no ve nada: se parece a un defecto,
//      no a una baja. La baja tiene su propio camino (desactivar la cuenta), el de la regla dura 14.
//   3. QUE NADIE SE QUITE SU PROPIO admin. Es el unico movimiento que, al terminar, quien lo hizo ya no
//      tiene permiso para deshacer.
//   4. QUE EL ROL VIAJE EN UN CAMPO OCULTO Y NO EN EL BOTON (hazard 5): con un envio propio el
//      `name`/`value` del submitter no viaja, y el servidor recibiria un rol vacio.
//
// Que los dos roles juntos no abren ninguna puerta clinica se prueba CONTRA LA BASE, en
// `dos-roles-no-abren-mas-puertas-db.test.ts`: eso es una afirmacion sobre la RLS.

const ACCIONES = "src/modules/auth/admin-actions.ts";
const PANTALLA = "src/modules/auth/components/roles-del-integrante.tsx";

describe("el schema del rol de un usuario", () => {
  it("exige un usuario y un rol del vocabulario", () => {
    expect(
      rolDeUsuarioSchema.safeParse({ userId: "11111111-1111-1111-1111-111111111111", rol: "obbia" })
        .success,
    ).toBe(true);
    expect(rolDeUsuarioSchema.safeParse({ userId: "no-es-uuid", rol: "obbia" }).success).toBe(false);
    expect(
      rolDeUsuarioSchema.safeParse({
        userId: "11111111-1111-1111-1111-111111111111",
        rol: "superadmin",
      }).success,
      "un rol inventado no puede llegar a la base para que la FK lo rechace: se frena antes",
    ).toBe(false);
  });
});

describe("las dos direcciones y los dos frenos", () => {
  const src = sinComentarios(readFileSync(ACCIONES, "utf8"));

  it("se puede dar Y se puede quitar", () => {
    expect(/export async function agregarRolAUsuario\(/.test(src)).toBe(true);
    expect(
      /export async function quitarRolAUsuario\(/.test(src),
      "dar un permiso sin construir como se revoca deja la llave sin cerradura",
    ).toBe(true);
  });

  it("las dos pasan por la policy de admin (regla dura 3)", () => {
    for (const fn of ["agregarRolAUsuario", "quitarRolAUsuario"]) {
      const i = src.indexOf(`export async function ${fn}(`);
      const cuerpo = src.slice(i, i + 600);
      expect(/requireAdmin\(\)/.test(cuerpo), `${fn} sin policy`).toBe(true);
    }
  });

  it("el ultimo rol no se quita", () => {
    expect(/UltimoRolError/.test(src)).toBe(true);
    expect(/suyos\.length <= 1/.test(src)).toBe(true);
    expect(
      /desactiva la cuenta/.test(readFileSync(ACCIONES, "utf8")),
      "el freno tiene que decir cual es el camino que si sirve, no solo que no se puede",
    ).toBe(true);
  });

  it("nadie se quita su propio admin", () => {
    expect(/userId === user\.id && rol === "admin"/.test(src)).toBe(true);
  });

  it("las dos escriben su rastro inline (regla dura 8)", () => {
    expect(src.match(/recordAudit\(tx, \{\s*event: "admin\.rol_(agregado|quitado)"/g)?.length).toBe(2);
  });

  it("'ya lo tiene' no se absorbe en silencio", () => {
    // Un `onConflictDoNothing` daria un "listo" sobre algo que no paso, y quien mira creeria que cambio
    // algo. Es una respuesta distinta, no un no-op.
    expect(/YaLoTieneError/.test(src)).toBe(true);
    expect(/onConflictDoNothing/.test(src)).toBe(false);
  });
});

describe("la pantalla no cae en el hazard del boton", () => {
  const src = readFileSync(PANTALLA, "utf8");

  it("el rol viaja en un campo oculto, no en el value del boton (hazard 5)", () => {
    expect(/<input type="hidden" name="rol" value=\{rol\} \/>/.test(src)).toBe(true);
    const botones = src.match(/<Button[\s\S]*?>/g) ?? [];
    for (const b of botones) {
      expect(/\bname=/.test(b), "un boton con name/value no manda su dato con un envio propio").toBe(false);
    }
  });

  it("usa enviarSinReset, no la prop action (hazard 2)", () => {
    expect(/onSubmit=\{enviarSinReset\(action\)\}/.test(src)).toBe(true);
    expect(/<form action=\{/.test(src)).toBe(false);
  });

  it("dice que los dos roles valen a la vez y que investigacion no abre historias", () => {
    expect(src).toMatch(/más de un rol/);
    expect(src).toMatch(/no le abre ninguna historia clínica que no sea suya/);
  });
});
