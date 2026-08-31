import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  esMenuCambios,
  esMenuComidas,
  type MenuSuggestionJson,
} from "@/modules/treatment/data/treatment-view-types";

// CANDADO DE LAS TRES FORMAS QUE CONVIVEN en `ai_menu_suggestions.menu_json`.
//
// LA TABLA ES INMUTABLE (sin UPDATE ni DELETE por RLS), asi que las filas viejas NO SE PUEDEN MIGRAR: las
// tres formas van a seguir ahi para siempre.
//   · v4 (hoy): { cambios: [...] } - la IA ADAPTA el ciclo y devuelve solo las sustituciones.
//   · v3:       { comidas: [...] } - la IA COMPONIA un menu de un dia.
//   · v2:       null - la respuesta era prosa (y tambien null en los fallos de parseo).
//
// ES LA LECCION DEL CAMBIO DE SHAPE DE UN JSONB, aplicada ANTES de que muerda: al cambiar la forma, el que
// RELEE lo viejo revienta si solo se penso en la nueva. La vez pasada nos costo un 500 al guardar. Aqui el
// riesgo es el render: una sugerencia generada ayer tumbaria la pestaña de tratamiento entera.

describe("las tres formas se distinguen por su CLAVE, no por la versión del prompt", () => {
  // La version del prompt es TEXTO LIBRE guardado en la fila (`menu.generate@1+u3`), y una fila vieja
  // pudo escribirse con otro formato. La clave del objeto es lo unico que describe la forma de verdad.
  const v4: MenuSuggestionJson = {
    cambios: [{ dia: 0, tiempo: "desayuno", reemplazo: "Arepa", motivo: "sin gluten" }],
  };
  const v3: MenuSuggestionJson = {
    comidas: [{ tiempo: "Desayuno", alimentos: [{ nombre: "Pan" }] }],
  };

  it("reconoce la forma v4", () => {
    expect(esMenuCambios(v4)).toBe(true);
    expect(esMenuComidas(v4)).toBe(false);
  });

  it("reconoce la forma v3, que sigue viva en BD", () => {
    expect(esMenuComidas(v3)).toBe(true);
    expect(esMenuCambios(v3)).toBe(false);
  });

  it("y el null (v2 y fallos de parseo) no es ninguna de las dos", () => {
    expect(esMenuCambios(null)).toBe(false);
    expect(esMenuComidas(null)).toBe(false);
  });

  it("una forma DESCONOCIDA tampoco pasa por ninguna: no se adivina", () => {
    // Si mañana apareciera una cuarta forma, el render cae al camino de "sin contenido" en vez de tronar
    // intentando leer una propiedad que no existe.
    const raro = { otraCosa: [1, 2, 3] } as unknown as MenuSuggestionJson;
    expect(esMenuCambios(raro)).toBe(false);
    expect(esMenuComidas(raro)).toBe(false);
  });
});

describe("el render distingue las dos formas, no castea a ciegas", () => {
  const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

  it("la tarjeta ramifica por los discriminadores", () => {
    expect(PANEL).toContain("esMenuCambios(json)");
    expect(PANEL).toContain("esMenuComidas(json)");
  });

  it("las sugerencias v3 se siguen mostrando, y se dicen viejas", () => {
    // No se ocultan: son procedencia de un intento real. Lo que NO se hace es ofrecer aplicarlas, porque
    // se compusieron con otra regla.
    expect(PANEL).toContain("Generada con la versión anterior");
  });

  it("solo la forma v4 ofrece aplicar a la grilla", () => {
    // El boton de aplicar vive DENTRO de la rama de `cambios`. Si estuviera fuera, un menu v3 (que no
    // tiene dia ni tiempo) intentaria escribir una celda inexistente.
    //
    // EL MARCADOR CAMBIO, NO LA ASERCION (2026-08-31): la accion ya no se nombra inline en el JSX, porque
    // cada sustitucion es ahora su propio componente (necesita su useActionState) y hay ademas un boton
    // global. Lo que se comprueba sigue siendo lo mismo: que aplicar se ofrezca en la rama v4 y en ninguna
    // otra. Se miran los DOS botones, para que retirar uno no deje la asercion en pie por el otro.
    const ramaCambios = PANEL.slice(
      PANEL.indexOf("esMenuCambios(json)"),
      PANEL.indexOf("esMenuComidas(json)"),
    );
    expect(ramaCambios).toContain("<CambioMenu");
    expect(ramaCambios).toContain("<AplicarTodasMenu");
    const ramaComidas = PANEL.slice(
      PANEL.indexOf("esMenuComidas(json)"),
      PANEL.indexOf("m.generatedText ?"),
    );
    expect(ramaComidas).not.toContain("<CambioMenu");
    expect(ramaComidas).not.toContain("<AplicarTodasMenu");
  });
});

describe("aplicar un cambio escribe en la forma que YA existe", () => {
  const SERVICE = readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8");

  // EL ANCLA SE MOVIO, NO LO QUE SE AFIRMA (2026-08-31). Al agregar el atajo de aplicar todas, la escritura
  // paso a `aplicarCambiosMenu` (en plural) y `aplicarCambioMenu` quedo como delegado de una linea. Estas
  // dos aserciones son las mismas; lo unico que cambia es de que funcion se recorta el bloque. La conducta
  // (una sola escritura, la firma leida, el override que se borra si coincide con el ciclo) la prueba
  // EJECUTANDO aplicar-cambios-menu.test.ts, que es la cobertura de verdad; esto solo fija la forma.
  const bloqueEscritura = () =>
    SERVICE.slice(
      SERVICE.indexOf("export async function aplicarCambiosMenu"),
      SERVICE.indexOf("// Checkpoint 2.4: guias dietarias"),
    );

  it("reusa saveMenuSemanal: no hay writer nuevo ni forma nueva", () => {
    // El hallazgo que hizo esto barato: la grilla ya guarda `{diaInicio, celdas}` con SOLO los overrides
    // contra el ciclo, y una adaptación de la IA ES un override. Sin migración y sin tocar la firma.
    expect(bloqueEscritura()).toContain("return saveMenuSemanal(");
    expect(bloqueEscritura()).toContain("menuSemanalSignature");
  });

  it("y NO guarda el reemplazo si coincide con el ciclo: lo congelaría", () => {
    // Misma regla que la grilla. Guardar un texto igual al del ciclo fija la celda: dejaría de seguir al
    // ciclo el día que se proponga otra semana base.
    expect(bloqueEscritura()).toContain("if (cambio.reemplazo === delCiclo)");
    expect(bloqueEscritura()).toContain("delete celdas[");
  });

  it("el de a uno NO tiene regla propia: delega en el de a varios", () => {
    // Sin esto quedarian dos caminos de escritura que pueden divergir en silencio, que es como empezaron
    // varios de los defectos de este proyecto.
    const delegado = SERVICE.slice(
      SERVICE.indexOf("export async function aplicarCambioMenu("),
      SERVICE.indexOf("// Checkpoint 2.4: guias dietarias"),
    );
    expect(delegado).toContain("aplicarCambiosMenu(");
    expect(delegado, "el de a uno volvió a tener su propia regla de escritura").not.toContain(
      "saveMenuSemanal(",
    );
  });
});
