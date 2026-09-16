import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ EL CLIENTE DE LA BASE NO PUEDE ROMPER EL POOLER (2026-09-15) ═══
//
// Dos cosas tumbaron produccion o estuvieron a punto, y las dos son de UNA linea en `src/db/index.ts`:
//
//   1. EL TAMANO DEL POOL. Por defecto postgres.js abre hasta 10 conexiones por instancia, y Vercel tiene muchas
//      vivas a la vez. Con el pooler en modo SESION (15 cupos) la base empezo a rechazar: /pagos caido para
//      administracion y el webhook de Wompi sin poder registrar el pago, mientras la app navegaba bien porque
//      esas lecturas van por la API REST. Sentry, con la causa ya puesta: "(EMAXCONNSESSION) max clients reached
//      in session mode - max clients are limited to pool_size: 15".
//   2. LOS PARAMETROS DE ARRANQUE. El pooler en modo TRANSACCION (el de produccion) no los admite: puesto uno,
//      no falla una consulta, fallan TODAS. Se alcanzo a escribir un `statement_timeout` y se quito antes de
//      desplegar; sin este candado, vuelve.
//
// Se lee el FUENTE a proposito: importar el modulo abriria una conexion, y lo que se protege es como se
// construye el cliente, no lo que devuelve una consulta.

const FUENTE = readFileSync("src/db/index.ts", "utf8");
const OPCIONES = FUENTE.slice(FUENTE.indexOf("postgres(process.env.DATABASE_URL"));
const CIERRE = OPCIONES.indexOf("});");
const CONSTRUCTOR = OPCIONES.slice(0, CIERRE);

describe("el cliente de la base", () => {
  it("no manda parametros de arranque: el pooler en modo transaccion los rechaza y caen TODAS las consultas", () => {
    expect(CONSTRUCTOR).not.toMatch(/connection\s*:/);
    expect(CONSTRUCTOR).not.toMatch(/statement_timeout|search_path/);
  });

  it("limita el pool por instancia y no retiene conexiones ociosas", () => {
    const max = CONSTRUCTOR.match(/max\s*:\s*(\d+)/);
    expect(max, "sin `max`, postgres.js abre 10 por instancia y agota el pooler").not.toBeNull();
    expect(Number(max![1])).toBeLessThanOrEqual(8);
    expect(CONSTRUCTOR).toMatch(/idle_timeout\s*:\s*\d+/);
    expect(CONSTRUCTOR).toMatch(/connect_timeout\s*:\s*\d+/);
  });

  it("CONTROL: sigue sin usar prepared statements, que el modo transaccion tampoco admite", () => {
    expect(CONSTRUCTOR).toMatch(/prepare\s*:\s*false/);
  });
});
