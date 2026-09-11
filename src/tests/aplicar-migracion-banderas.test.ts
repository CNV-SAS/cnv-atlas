import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ UNA BANDERA QUE NO SE ENTIENDE ABORTA, NO SE IGNORA ═══
//
// EL INCIDENTE (2026-09-11). La carga de inventario inicial se corrio con `--confirmar`, una bandera que
// NO existe: la real es `--commit`. La herramienta la ignoro en silencio, corrio en modo ensayo, revirtio
// limpiamente... y quien la ejecuto creyo que habia aplicado la carga. Las cinco cifras cuadraban, la
// salida decia "corrio SIN ERRORES", y no habia quedado nada en la base.
//
// LA SALIDA SI DECIA "Modo: ENSAYO". No basta: cuando uno cree haber pedido lo contrario, esa linea se
// lee como ruido. El estado correcto no se anuncia, se IMPONE, y un argumento que el programa no entiende
// significa que no sabe lo que le estan pidiendo.
//
// LA REGLA, y vale para cualquier herramienta donde la diferencia entre dos modos sea "los datos quedan"
// contra "los datos no quedan": ignorar un argumento no es tolerancia, es dejar que el usuario se
// equivoque sin enterarse. Aborta ANTES de tocar la base.
//
// SE PRUEBA EJECUTANDO EL SCRIPT DE VERDAD, no leyendolo: lo que fallaba era el comportamiento del
// proceso, y un candado que buscara la cadena "--commit" en el fuente habria pasado verde con el defecto
// intacto, porque la cadena siempre estuvo ahi.

const SCRIPT = "scripts/aplicar-migracion.mjs";

function correr(args: string[]): { code: number; salida: string } {
  try {
    const out = execFileSync("node", [SCRIPT, ...args], {
      encoding: "utf8",
      // Sin DATABASE_URL a proposito: asi se verifica que el rechazo de la bandera ocurre ANTES de
      // cualquier intento de conexion. Si abortara por la conexion y no por la bandera, el codigo de
      // salida seria el mismo y el candado no probaria nada; por eso tambien se mira el MENSAJE.
      env: { ...process.env, DATABASE_URL: "" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, salida: out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, salida: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("banderas desconocidas", () => {
  it("`--confirmar` (la que NO existe) aborta y dice cuál es la buena", () => {
    // Es literalmente la que se uso el 11 de septiembre. Se nombra en el test para que quien lea el rojo
    // sepa que no es un caso inventado.
    const { code, salida } = correr(["scripts/carga-inventario-inicial.sql", "--confirmar"]);
    expect(code).not.toBe(0);
    expect(salida).toContain("--confirmar");
    expect(salida, "el error no nombra la bandera correcta, así que no ayuda a corregir").toContain(
      "--commit",
    );
  });

  it("y el rechazo ocurre ANTES de mirar la conexión", () => {
    // Sin DATABASE_URL, el fallo por bandera tiene que ganarle al fallo por conexion. Si se invirtiera, el
    // usuario arreglaria la conexion, volveria a correr con la bandera mala y volveria a quedarse en
    // ensayo sin saberlo.
    const { salida } = correr(["scripts/carga-inventario-inicial.sql", "--confirmar"]);
    expect(salida).not.toContain("Falta DATABASE_URL");
  });

  it("cualquier otra inventada también aborta", () => {
    for (const mala of ["--aplicar", "--force", "-c"]) {
      const { code } = correr(["scripts/carga-inventario-inicial.sql", mala]);
      expect(code, `${mala} no abortó`).not.toBe(0);
    }
  });

  it("y `--commit`, que sí existe, pasa del filtro", () => {
    // Llega hasta la comprobacion de DATABASE_URL, que es la siguiente. Eso prueba que la bandera buena
    // NO cae en el filtro nuevo.
    const { salida } = correr(["scripts/carga-inventario-inicial.sql", "--commit"]);
    expect(salida).toContain("Falta DATABASE_URL");
  });
});

describe("el consejo del final se deriva del archivo, no es una frase fija", () => {
  // Decia SIEMPRE "para aplicarla de verdad: pnpm db:migrate". Cierto de una migracion y FALSO de un
  // script de operacion: `db:migrate` solo corre lo que esta en el journal de drizzle, y una purga o una
  // carga no estan ahi. Un consejo equivocado en el momento de aplicar es peor que ningun consejo.
  const src = readFileSync(SCRIPT, "utf8");

  it("distingue una migración de un script de operación por su ruta", () => {
    expect(src).toMatch(/drizzle\[\\\\\/\]\\d\{4\}_/);
  });

  it("y a un script de operación le dice --commit, no db:migrate", () => {
    const bloque = src.slice(src.indexOf("Revirtiendo:"), src.indexOf("__ensayo__"));
    expect(bloque).toContain("db:migrate");
    expect(bloque).toContain("--commit");
  });
});
