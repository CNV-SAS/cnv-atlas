import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { HttpError } from "@/core/http/http-error";
import { ColaDelProveedorError } from "@/lib/ai/reintento-tope";
import {
  ESPERA_DEFECTO_MS,
  conReintentoAnteTope,
  esTopePorMinuto,
  segundosDeEspera,
} from "@/lib/ai/reintento-tope";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL REINTENTO ANTE EL TOPE POR MINUTO (Gildardo §7c, entrega del 2026-09-01).
//
// SU DESCRIPCIÓN, que es la que fija el comportamiento: el 429 de Groq "no es un fallo, es una cola". El
// proveedor dice cuántos segundos hay que esperar y responde bien después.
//
// LO QUE ESTE CANDADO CUIDA DE VERDAD no es que se reintente, sino QUE EL REINTENTO OCURRA ANTES DEL
// FALLBACK. Antes de esto, cualquier fallo (incluido un 429) nos cambiaba de proveedor: una cola de dos
// segundos hacía que el texto clínico saliera de otro modelo sin que nadie lo hubiera pedido. Es peor que
// esperar, y solo se ve en la trazabilidad. Por eso hay dos mitades: la política, probada corriéndola, y
// el SITIO DE LLAMADA, porque una política correcta invocada en el lugar equivocado no arregla nada.

const PROVIDER = sinComentarios(readFileSync("src/lib/ai/provider.ts", "utf8"));

const tope = (seg?: number) =>
  new HttpError("HTTP 429", 429, {
    error: {
      message:
        seg == null
          ? "Rate limit reached for model `gpt-oss-20b`. Limit 8000, used 7994."
          : `Rate limit reached for model \`gpt-oss-20b\`. Please try again in ${seg}s.`,
      code: "rate_limit_exceeded",
    },
  });

describe("el tope se espera y se reintenta UNA vez", () => {
  it("tras el 429 espera lo que el proveedor pide y vuelve a intentar", async () => {
    const pedir = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(tope(0.02))
      .mockResolvedValueOnce("texto");

    await expect(conReintentoAnteTope(pedir)).resolves.toBe("texto");
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("y si tras esperar SIGUE tocado, el error sube: ahí es donde corresponde el fallback", async () => {
    // Un solo reintento, no una cadena: si el tope sigue tocado después de esperar lo que el propio
    // proveedor pidió, el problema ya no es la cola.
    //
    // EL ANCLA CAMBIA DE CLASE, NO LA ASERCIÓN (2026-09-10): el error que sube ya no es el HttpError crudo
    // sino `ColaDelProveedorError`, que dice QUÉ es. Lo que este caso afirma sigue siendo lo mismo: que
    // hay un solo reintento y que el error sube.
    const pedir = vi.fn<() => Promise<string>>().mockRejectedValue(tope(0.02));

    await expect(conReintentoAnteTope(pedir)).rejects.toBeInstanceOf(ColaDelProveedorError);
    expect(pedir).toHaveBeenCalledTimes(2);
  });

  it("un fallo que NO es el tope no se reintenta", async () => {
    // Un 500, un timeout o una clave mala no mejoran esperando: esperar solo retrasaría el fallback.
    const pedir = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(
        new HttpError("HTTP 500", 500, { error: { message: "internal" } }),
      );

    await expect(conReintentoAnteTope(pedir)).rejects.toBeInstanceOf(HttpError);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it("y el camino feliz no paga nada: una sola llamada, sin espera", async () => {
    const pedir = vi.fn<() => Promise<string>>().mockResolvedValue("texto");
    const t0 = Date.now();

    await expect(conReintentoAnteTope(pedir)).resolves.toBe("texto");
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(Date.now() - t0).toBeLessThan(ESPERA_DEFECTO_MS);
  });

  it.each([
    ["429", 429, true],
    ["500", 500, false],
    ["401", 401, false],
  ])("solo el 429 cuenta como tope: %s", (_n, status, esperado) => {
    expect(esTopePorMinuto(new HttpError("x", status, null))).toBe(esperado);
  });
});

describe("los segundos salen de la prosa, y el defecto cubre cuando no salen", () => {
  it.each([
    ["decimales", "Please try again in 2.5s", 2.5],
    ["enteros", "Please try again in 12s", 12],
    ["con espacio", "Please try again in 3 s", 3],
  ])("los lee: %s", (_n, msg, esperado) => {
    expect(segundosDeEspera({ error: { message: msg } })).toBe(esperado);
  });

  it.each([
    ["otra redacción", { error: { message: "Rate limit exceeded. Slow down." } }],
    ["sin mensaje", { error: {} }],
    ["cuerpo que no es JSON", "429 Too Many Requests"],
    ["cuerpo nulo", null],
    ["valor absurdo", { error: { message: "try again in 0s" } }],
  ])("devuelve null cuando no los dice: %s", (_n, body) => {
    // Y ahí manda el defecto. Esto es lo que hace aceptable leer prosa de un proveedor: si mañana cambian
    // la redacción, se espera el valor por defecto, no se rompe ni se espera un tiempo absurdo.
    expect(segundosDeEspera(body)).toBeNull();
  });

  it("si pide MÁS que el techo, no se gasta el reintento: se dice que es una cola", async () => {
    // ═══ EL CASO DE SANTIAGO (2026-09-10) ═══
    //
    // Al regenerar el borrador salió "El proveedor configurado (groq) falló", y a la segunda funcionó. En
    // producción quedó registrado el 429, y su reintento a mano llegó VEINTIÚN segundos después: Groq
    // pedía más que nuestro techo de diez.
    //
    // LO QUE HACÍAMOS: esperar diez, reintentar, volver a chocar, y dejar subir el 429 como si fuera un
    // fallo del proveedor. Gastar el único reintento en una espera que ya sabemos insuficiente no ayuda a
    // nadie, y el mensaje mandaba a mirar una configuración que estaba bien.
    //
    // AHORA: se dice que es una cola y cuánto pide, sin gastar el intento. El caso anterior (que sí
    // reintenta cuando la espera cabe) es el control de este.
    const pedir = vi.fn<() => Promise<string>>().mockRejectedValue(tope(600));
    const t0 = Date.now();

    await expect(conReintentoAnteTope(pedir)).rejects.toBeInstanceOf(ColaDelProveedorError);
    expect(pedir, "se gastó el reintento en una espera que no alcanzaba").toHaveBeenCalledTimes(1);
    expect(Date.now() - t0, "esperó igual").toBeLessThan(1_000);
  });

  it("y el error dice CUÁNTOS segundos pide, que es lo que el profesional necesita saber", async () => {
    // Sin el número, "está en cola" no dice si son dos segundos o dos minutos, y entonces no se puede
    // decidir si esperar o escribir el criterio a mano.
    const pedir = vi.fn<() => Promise<string>>().mockRejectedValue(tope(21.5));
    await expect(conReintentoAnteTope(pedir)).rejects.toMatchObject({ segundos: 21.5 });
  });
});

describe("el SITIO DE LLAMADA: el reintento va antes del fallback", () => {
  it("se envuelve la petición a Groq, no la elección de proveedor", () => {
    // EL HUECO QUE ESTO CIERRA: si el reintento se pusiera alrededor de `callProvider` o dentro de
    // `generateText`, reintentaría con el proveedor que ya eligió el fallback, y el 429 del primario
    // seguiría mandándonos al secundario. Tiene que estar DENTRO de `callGroq`.
    const i = PROVIDER.indexOf("async function callGroq(");
    const j = PROVIDER.indexOf("async function callGemini(");
    expect(i).toBeGreaterThan(-1);
    expect(PROVIDER.slice(i, j)).toContain("conReintentoAnteTope(pedir)");
  });

  it("y `generateText` sigue cayendo al fallback solo con lo que SUBE del proveedor", () => {
    // El fallback no se toca: lo que cambia es qué llega hasta él.
    const k = PROVIDER.indexOf("export async function generateText(");
    expect(PROVIDER.slice(k)).not.toContain("conReintentoAnteTope");
    expect(PROVIDER.slice(k)).toContain("config.fallback");
  });
});
