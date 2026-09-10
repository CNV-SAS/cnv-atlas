import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { invocacionesDeAccion } from "./helpers/invocaciones-de-accion";

// ═══ NINGUNA INVOCACION DE SERVER ACTION SE QUEDA SIN EL GUARD DEL SCROLL ═══
//
// QUINTA RONDA DEL MISMO SINTOMA (Santiago, 2026-09-10), y las cuatro anteriores fallaron por la misma
// forma dos veces seguidas:
//
//   · Las TRES PRIMERAS arreglaron CUANTO vigila el guard (el doble ciclo del revalidate, el encogimiento
//     pasajero del remonte, la ventana de silencio). Que tres arreglos de la duracion no cerraran nada era
//     el dato que no se leyo.
//   · La CUARTA conto ARCHIVOS: "este archivo usa `enviarSinReset`, luego esta cubierto". Y
//     `generate-diagnosis-panel.tsx` pasaba verde teniendo DOS caminos: el boton de reintentar, que va por
//     el helper, y el DISPARO AUTOMATICO, que invoca la accion a pelo desde un efecto. Justo el que
//     Santiago reportaba.
//
// ES EL MISMO DEFECTO DE DETECTOR QUE EL PRIMER CANDADO DEL REFRESCO, que tambien miraba el archivo entero
// y acusaba a quien no era. La forma correcta es emparejar cada USO con su guarda, y es lo que hace
// `invocacionesDeAccion`: captura los nombres que devuelve cada `useActionState` y busca sus LLAMADAS.
//
// EL DATO DE SANTIAGO CERRO LA OTRA EXPLICACION: vio el toast ANTES del salto. O sea que el salto llega en
// un commit POSTERIOR al efecto del toast, no en el mismo. La hipotesis del orden layout-vs-pasivo (que el
// guard capturara `desde` ya saltado, o sea cero) queda descartada: lo que fallaba era la cobertura.

const INVOCACIONES = invocacionesDeAccion();

// ═══ LAS AUSENCIAS DELIBERADAS, y cada una lleva su razon o no entra ═══
//
// El instrumento del PACIENTE es otra clase de superficie y sus reglas son las contrarias: es un
// formulario por fases, y al pasar de una a la siguiente la pagina DEBE irse arriba, porque lo que hay que
// leer empieza ahi. El guard esta hecho para deshacer un salto que nadie pidio; alli el salto SI se pide.
const FUERA_A_PROPOSITO: Record<string, string> = {
  "src/modules/evaluations/components/sign-phase-form.tsx":
    "instrumento del paciente: al avanzar de fase la pagina DEBE subir",
  "src/modules/evaluations/components/survey-phase-form.tsx":
    "instrumento del paciente: al avanzar de fase la pagina DEBE subir",
};

describe("cada invocación de una acción arma el guard del scroll", () => {
  it("no queda ninguna huérfana", () => {
    const huerfanas = INVOCACIONES.filter(
      (i) => i.via === null && FUERA_A_PROPOSITO[i.archivo] == null,
    ).map((i) => `${i.archivo}:${i.linea}  ${i.accion}(...)`);
    expect(
      huerfanas,
      "Estas LLAMADAS invocan una server action y no arman `preservarScroll`: al invocarla, Next navega " +
        "con ScrollBehavior.Default y la página salta al inicio. Usa `ejecutarAccion(accion, formData)` " +
        "en vez de `startTransition(() => accion(formData))`, o `enviarSinReset` si hay <form>. Si de " +
        "verdad debe quedar fuera, va a FUERA_A_PROPOSITO con su razón escrita.",
    ).toEqual([]);
  });

  it("y el detector sigue viendo: si el número se desploma, dejó de mirar", () => {
    // CONTROL. Sin esto, un cambio que rompiera la detección (que `useActionState` se envolviera en otro
    // helper, por ejemplo) dejaría la lista vacía y el candado pasaría verde sin mirar nada.
    expect(INVOCACIONES.length).toBeGreaterThanOrEqual(6);
  });

  it("las exclusiones son las dos del paciente, con su razón", () => {
    // Una lista de exclusiones que crece en silencio es como vuelve el defecto por la puerta de atrás.
    expect(Object.keys(FUERA_A_PROPOSITO)).toHaveLength(2);
    for (const [f, razon] of Object.entries(FUERA_A_PROPOSITO)) {
      expect(
        INVOCACIONES.some((i) => i.archivo === f),
        `${f} ya no invoca ninguna acción: la exclusión sobra`,
      ).toBe(true);
      expect(razon.length).toBeGreaterThan(20);
    }
  });

  it("el disparo AUTOMÁTICO del diagnóstico lo arma, que es el que faltaba", () => {
    // El caso concreto de la quinta ronda, con nombre y apellido para que no vuelva.
    const PANEL = readFileSync(
      "src/modules/clinical-pipeline/components/generate-diagnosis-panel.tsx",
      "utf8",
    );
    const i = PANEL.indexOf("preservarScroll()");
    const j = PANEL.indexOf("action(datos)");
    expect(i, "el disparo automático dejó de armar el guard").toBeGreaterThan(-1);
    expect(i, "el guard se arma DESPUÉS de invocar la acción").toBeLessThan(j);
  });
});

describe("el guard se arma en el ENVÍO, no al llegar el resultado", () => {
  const ENVIO = readFileSync("src/components/shared/enviar-sin-reset.ts", "utf8");
  const GUARD = readFileSync("src/components/shared/preservar-scroll.ts", "utf8");

  it("`enviarSinReset` lo arma antes de invocar la acción", () => {
    const i = ENVIO.indexOf("preservarScroll()");
    const j = ENVIO.indexOf("startTransition(() => action(new FormData");
    expect(i, "`enviarSinReset` dejó de armar el guard").toBeGreaterThan(-1);
    expect(i, "el guard se arma DESPUÉS de invocar la acción").toBeLessThan(j);
  });

  it("y `ejecutarAccion` hace lo mismo para los botones SIN formulario", () => {
    const i = ENVIO.indexOf("export function ejecutarAccion(");
    expect(i).toBeGreaterThan(-1);
    const cuerpo = ENVIO.slice(i);
    expect(cuerpo.indexOf("preservarScroll()")).toBeLessThan(cuerpo.indexOf("startTransition("));
  });

  it("dos llamadas sobre la misma página no se pisan", () => {
    // El primero se armó en el envío y tiene el `desde` bueno; el segundo (el del hook del toast, que
    // llega después) capturaría una posición que puede estar ya saltada.
    expect(GUARD).toContain("vivo.ruta === window.location.pathname");
    expect(GUARD).toContain("vivo.extender()");
  });

  it("y la primera espera llega hasta el tope, porque entre el envío y el salto está el servidor", () => {
    expect(GUARD).toContain("primera ? restante :");
  });
});
