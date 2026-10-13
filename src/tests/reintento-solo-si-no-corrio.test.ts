import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { esFalloDeConexion, leerConReintento } from "@/db/reintento";

// ═══ UN REINTENTO SOLO DONDE NO PUEDE REPETIR NADA (segundo smoke, 2026-10-12) ═══
//
// EL INCIDENTE: /mi-inventario cayo con "Failed to connect to database: timeout" (el pooler de Supabase
// ocupado un instante). Reintentar ahi es seguro, y la razon es precisa: un fallo al CONECTAR significa que
// la consulta no llego a correr, asi que no hay nada que pueda ocurrir dos veces.
//
// ── LO QUE ESTE CANDADO PROTEGE, Y ES LA MITAD PELIGROSA ──
//
// Que el reintento NO se extienda. Un reintento que se dispare con cualquier fallo de base es un cobro
// doble esperando a pasar: la clase 08 de Postgres cubre tanto "no pude conectarme" como "se cayo la
// conexion en medio", y la segunda deja un desenlace DESCONOCIDO. Por eso aqui se prueban las dos
// direcciones: que reintente lo que debe y que NO reintente lo demas.
//
// Y que siga siendo UNA vez: encadenar reintentos contra una base caida solo alarga la espera antes de dar
// la mala noticia, y con `connect_timeout: 10` ya son diez segundos por intento.

const conCodigo = (code: string) => Object.assign(new Error(`write ${code} host:6543`), { code });

describe("reconocer un fallo de conexion", () => {
  it("reconoce el timeout de postgres.js, que es el del incidente", () => {
    expect(esFalloDeConexion(conCodigo("CONNECT_TIMEOUT"))).toBe(true);
  });

  it("y los de red y la clase 08 de Postgres", () => {
    for (const c of ["ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "08006", "08001", "08P01"]) {
      expect(esFalloDeConexion(conCodigo(c)), c).toBe(true);
    }
  });

  // DRIZZLE ENVUELVE EL ERROR DE POSTGRES: el de arriba dice "Failed query" y el codigo queda en la causa.
  // Sin recorrerla, este reintento no se dispararia nunca en la app real, que es donde corre.
  it("lo encuentra en la CAUSA, que es donde lo deja Drizzle", () => {
    const envuelto = Object.assign(new Error("Failed query: select ..."), {
      cause: conCodigo("CONNECT_TIMEOUT"),
    });
    expect(esFalloDeConexion(envuelto)).toBe(true);
  });

  it("NO reconoce un error de la consulta: ahi la base si corrio algo", () => {
    // 23505 = unique_violation, el duplicate key del smoke. 40001 = serialization_failure. Ninguno es un
    // fallo de conexion, y reintentarlos repetiria un acto que ya ocurrio.
    for (const c of ["23505", "23503", "40001", "P0001", "42703"]) {
      expect(esFalloDeConexion(conCodigo(c)), c).toBe(false);
    }
  });

  it("ni un error cualquiera sin codigo", () => {
    expect(esFalloDeConexion(new Error("algo"))).toBe(false);
    expect(esFalloDeConexion(null)).toBe(false);
    expect(esFalloDeConexion("texto")).toBe(false);
  });

  // Un error que se apunta a si mismo como causa colgaria el recorrido. Pasa con objetos reenvueltos.
  it("no se cuelga con una cadena de causas circular", () => {
    const e: { code?: string; cause?: unknown } = {};
    e.cause = e;
    expect(esFalloDeConexion(e)).toBe(false);
  });
});

describe("leer con reintento", () => {
  it("devuelve el resultado al primer intento, sin reintentar nada", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await leerConReintento(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reintenta UNA vez un fallo de conexion, y la segunda pasa", async () => {
    const fn = vi.fn().mockRejectedValueOnce(conCodigo("CONNECT_TIMEOUT")).mockResolvedValue("ok");
    expect(await leerConReintento(fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("y si el segundo intento tambien falla, el error SALE: no se esconde", async () => {
    const fn = vi.fn().mockRejectedValue(conCodigo("CONNECT_TIMEOUT"));
    await expect(leerConReintento(fn)).rejects.toThrow(/CONNECT_TIMEOUT/);
    expect(fn, "una sola vez mas, no tres").toHaveBeenCalledTimes(2);
  });

  it("NO reintenta un error de la consulta: lo deja pasar tal cual", async () => {
    const fn = vi.fn().mockRejectedValue(conCodigo("23505"));
    await expect(leerConReintento(fn)).rejects.toThrow(/23505/);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
