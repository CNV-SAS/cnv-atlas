import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: NINGUN SCRIPT DE `scripts/` IMPORTA LA APP
//
// ═══ EL DEFECTO, Y FALLO TRES VECES EN LAS MANOS DE SANTIAGO (2026-10-29) ═══
//
// Le pase un script que importaba `@/db` y nuestro servicio de reemision. No podia funcionar, y la razon
// no es de configuracion:
//
//   · `server-only` NO ES UN PAQUETE INSTALADO: lo resuelve el bundler de Next. Importar cualquier modulo
//     nuestro que lo lleve (todos los `data/` y los `services/`) revienta en node con
//     ERR_MODULE_NOT_FOUND. Solo vitest lo salva, con `vi.mock("server-only")`.
//   · El alias `@/` es de `tsconfig`, y node no lee `tsconfig`. Tampoco tsx sin configurarlo, y al
//     configurarlo aparece el siguiente muro (top-level await en salida cjs).
//
// O SEA QUE NO ES "ARREGLABLE" CON LA INVOCACION CORRECTA: un script de node no puede importar la app.
// Los que SI corren (todos los `.mjs` de esta carpeta) usan supabase-js y rutas relativas.
//
// ═══ Y LA LECCION DE FONDO, QUE ES POR LO QUE ESTE CANDADO VALE ═══
//
// Lo que necesitaba un actor autenticado, una policy y una IP no era un script: era una pantalla. El muro
// tecnico estaba señalando un error de diseño. Si alguien vuelve a escribir un script que importa un
// servicio, esto falla ANTES de que se lo pasemos a nadie.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const CARPETA = "scripts";

describe("los scripts no pueden importar la app", () => {
  const archivos = readdirSync(CARPETA).filter((f) => /\.(mjs|ts|js)$/.test(f));

  it("CONTROL: hay scripts que revisar", () => {
    // Sin esto, un cambio de carpeta dejaria el candado verde sobre una lista vacia.
    expect(archivos.length).toBeGreaterThan(5);
  });

  it.each(archivos)("%s no importa con el alias @/ ni server-only", (archivo) => {
    const fuente = readFileSync(`${CARPETA}/${archivo}`, "utf8");
    // Se miran los IMPORT, no cualquier mencion: un comentario que explique este candado nombra las dos
    // cosas a proposito.
    const imports = [...fuente.matchAll(/^\s*(?:import|export)[^;\n]*from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1],
    );
    imports.push(
      ...[...fuente.matchAll(/^\s*import\s+["']([^"']+)["']/gm)].map((m) => m[1]),
    );
    for (const mod of imports) {
      expect(mod.startsWith("@/"), `${archivo} importa ${mod} con el alias @/, que node no resuelve`).toBe(
        false,
      );
      expect(mod, `${archivo} importa server-only, que no es un paquete instalado`).not.toBe(
        "server-only",
      );
    }
  });
});
