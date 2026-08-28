import { describe, expect, it } from "vitest";

import {
  isNavItemActive,
  NAV_ITEMS,
  navGroupsForRoles,
  navItemsForRoles,
  UMBRAL_ROTULOS,
} from "../components/layout/nav-config";

// B3: la navegacion es adaptativa por rol. Aqui se prueba la decision de
// visibilidad (modulo puro); el render del shell se valida en el smoke de dev.
describe("B3: navegacion adaptativa por rol", () => {
  it("admin ve mas items que professional y secciones que el profesional no ve", () => {
    const adminHrefs = navItemsForRoles(["admin"]).map((i) => i.href);
    const proHrefs = navItemsForRoles(["professional"]).map((i) => i.href);

    // Admin ve la gestion de usuarios y lo comercial; el profesional no.
    expect(adminHrefs).toContain("/admin");
    expect(adminHrefs).toContain("/comercial");
    expect(proHrefs).not.toContain("/admin");
    expect(proHrefs).not.toContain("/comercial");

    // Ambos comparten el tablero, pero los conjuntos difieren.
    expect(adminHrefs).toContain("/dashboard");
    expect(proHrefs).toContain("/dashboard");
    expect(adminHrefs).not.toEqual(proHrefs);
    expect(adminHrefs.length).toBeGreaterThan(proHrefs.length);
  });

  it("soporte ve comodato pero no la clinica ni usuarios", () => {
    const soporteHrefs = navItemsForRoles(["soporte"]).map((i) => i.href);
    expect(soporteHrefs).toContain("/comodato");
    expect(soporteHrefs).not.toContain("/pacientes");
    expect(soporteHrefs).not.toContain("/admin");
  });

  it("el consentimiento vigente es visible para todos los roles (DELTA2 C1)", () => {
    for (const role of ["admin", "direccion", "soporte", "obbia", "professional"] as const) {
      const hrefs = navItemsForRoles([role]).map((i) => i.href);
      expect(hrefs).toContain("/consentimiento");
    }
  });
});

// B14: item activo por prefijo mas largo. Regresion del bug donde cualquier /admin/* marcaba
// Usuarios (/admin) como activo por un startsWith generico.
describe("B14: item de nav activo (gana el prefijo mas largo)", () => {
  const items = navItemsForRoles(["admin"]);
  const activos = (pathname: string) =>
    items.filter((i) => isNavItemActive(i.href, pathname, items)).map((i) => i.href);

  it("en /admin/ia solo se activa /admin/ia, no /admin", () => {
    expect(activos("/admin/ia")).toEqual(["/admin/ia"]);
  });

  it("en /admin/auditoria solo se activa /admin/auditoria, no /admin", () => {
    expect(activos("/admin/auditoria")).toEqual(["/admin/auditoria"]);
  });

  it("en /admin exacto solo se activa /admin", () => {
    expect(activos("/admin")).toEqual(["/admin"]);
  });

  it("conserva el resaltado de la seccion en rutas de detalle sin item propio", () => {
    // /evaluaciones/123 no tiene item propio: se resalta la seccion /evaluaciones.
    expect(isNavItemActive("/evaluaciones", "/evaluaciones/123", items)).toBe(true);
  });
});

// GRUPOS DE LA BARRA (2026-08-28). Lo que se blinda no es el reparto en si, es el CRITERIO: los rotulos
// aparecen solo cuando la lista es lo bastante larga como para que agrupar ahorre mas de lo que cuesta.
// Sin candado, alguien "mejora" la barra rotulando siempre y le mete tres rotulos a una lista de ocho
// items, que es exactamente el caso en que estorban.
describe("grupos de la barra: los rotulos solo cuando ahorran", () => {
  it("el PROFESIONAL ve la barra agrupada pero SIN rotulos: su lista se abarca de un vistazo", () => {
    const grupos = navGroupsForRoles(["professional"]);
    const total = grupos.flatMap((g) => g.items).length;
    expect(total).toBeLessThan(UMBRAL_ROTULOS);
    expect(grupos.every((g) => g.label === null)).toBe(true);
  });

  it("el ADMIN si los ve: con su lista, la plana es la que cuesta", () => {
    const grupos = navGroupsForRoles(["admin"]);
    const total = grupos.flatMap((g) => g.items).length;
    expect(total).toBeGreaterThanOrEqual(UMBRAL_ROTULOS);
    expect(grupos.filter((g) => g.label !== null).length).toBeGreaterThan(0);
  });

  it("el primer grupo NUNCA se rotula: es el Tablero, y un rotulo ocuparia mas que el item", () => {
    for (const roles of [["admin"], ["professional"], ["direccion"], ["soporte"]] as const) {
      const [primero] = navGroupsForRoles(roles);
      expect(primero.group).toBeNull();
      expect(primero.label).toBeNull();
    }
  });

  it("no se pinta ningun grupo VACIO: un rotulo sin items anuncia una seccion que no existe para ese rol", () => {
    for (const roles of [["admin"], ["professional"], ["direccion"], ["obbia"], ["soporte"]] as const) {
      expect(navGroupsForRoles(roles).every((g) => g.items.length > 0)).toBe(true);
    }
  });

  it("agrupar NO cambia que ve cada rol: los mismos items, solo repartidos", () => {
    // El reparto es presentacion. Si un item se cae o aparece al agrupar, la barra estaria mintiendo
    // sobre los permisos, que es un defecto de otra clase.
    for (const roles of [["admin"], ["professional"], ["direccion"], ["obbia"], ["soporte"]] as const) {
      const plano = navItemsForRoles(roles).map((i) => i.href);
      const agrupado = navGroupsForRoles(roles).flatMap((g) => g.items.map((i) => i.href));
      expect(agrupado.sort()).toEqual([...plano].sort());
    }
  });

  it("TODO item declara grupo: uno sin declarar caeria en el primero por accidente", () => {
    const validos = new Set([null, "clinica", "operacion", "cuenta", "administracion"]);
    for (const item of NAV_ITEMS) expect(validos.has(item.group)).toBe(true);
  });
});
