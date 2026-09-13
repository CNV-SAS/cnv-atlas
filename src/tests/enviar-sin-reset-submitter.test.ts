import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ═══ EL BOTON QUE SE PULSO VIAJA CON EL FORMULARIO ═══
//
// EL DEFECTO (smoke del Bloque 3, 2026-09-13): `enviarSinReset` armaba `new FormData(form)`, que NO incluye el
// `name`/`value` del boton de envio. "Generar de todos modos" (checkout duplicado) y "Confirmar el cargo" /
// "Rechazar" (faltante) llevan su dato en el boton, y no llegaba. El aviso de duplicado se volvio un bloqueo.
//
// Sin jsdom en el proyecto, se prueba lo que el helper le PIDE al navegador: con que argumentos construye el
// FormData. Que el navegador incluya el boton cuando se le pasa es su estandar (FormData(form, submitter));
// la verificacion en navegador real va en el smoke.

vi.mock("@/components/shared/preservar-scroll", () => ({ preservarScroll: vi.fn() }));

const construidos: unknown[][] = [];
class FormDataEspia {
  constructor(...args: unknown[]) {
    construidos.push(args);
  }
}

describe("enviarSinReset pasa el boton pulsado", () => {
  const original = globalThis.FormData;
  beforeEach(() => {
    construidos.length = 0;
    globalThis.FormData = FormDataEspia as unknown as typeof FormData;
  });
  afterEach(() => {
    globalThis.FormData = original;
  });

  const evento = (form: object, submitter: object | null) =>
    ({ preventDefault: vi.fn(), currentTarget: form, nativeEvent: { submitter } }) as never;

  it("con un boton DE ESTE formulario, el FormData se arma con el boton", async () => {
    const { enviarSinReset } = await import("@/components/shared/enviar-sin-reset");
    const form = {};
    const boton = { form, name: "confirmDuplicate", value: "true" };
    const action = vi.fn();
    enviarSinReset(action)(evento(form, boton));

    expect(construidos).toEqual([[form, boton]]);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("sin boton (un requestSubmit sin submitter), se arma solo con el formulario", async () => {
    const { enviarSinReset } = await import("@/components/shared/enviar-sin-reset");
    const form = {};
    enviarSinReset(vi.fn())(evento(form, null));
    expect(construidos).toEqual([[form]]);
  });

  it("un boton de OTRO formulario no se pasa: FormData(form, submitter) lanzaria", async () => {
    const { enviarSinReset } = await import("@/components/shared/enviar-sin-reset");
    const form = {};
    enviarSinReset(vi.fn())(evento(form, { form: {}, name: "x", value: "y" }));
    expect(construidos).toEqual([[form]]);
  });
});

describe("los formularios que llevan su dato en el boton pasan por el helper", () => {
  // Si alguno se escribiera su propio envio con `new FormData(e.currentTarget)`, volveria el defecto ahi.
  it.each([
    ["checkout duplicado", "src/modules/payments/components/create-checkout-form.tsx", 'name="confirmDuplicate"'],
    ["confirmar faltante", "src/modules/nutraceuticals/components/confirmar-faltante-form.tsx", 'name="decision"'],
  ])("%s", (_nombre, archivo, boton) => {
    const src = readFileSync(archivo, "utf8");
    expect(src).toContain(boton);
    expect(src).toContain("onSubmit={enviarSinReset(");
  });
});
