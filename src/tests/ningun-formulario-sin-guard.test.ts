import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ NINGUN FORMULARIO DE ACCION SE QUEDA SIN EL GUARD DEL SCROLL ═══
//
// CUARTA RONDA DEL MISMO SINTOMA (Santiago, 2026-09-10), y las tres anteriores arreglaron CUANTO vigila el
// guard: el doble ciclo del revalidate, el encogimiento pasajero del remonte, la ventana de silencio.
// Ninguna cerro el sintoma. Que tres arreglos de la duracion no lo cerraran ya decia que el problema no
// era la duracion.
//
// LO QUE APARECIO AL CONTAR EN VEZ DE RAZONAR: de los 59 archivos con formularios de accion, TREINTA no
// llamaban a `preservarScroll` por ningun camino. El comentario de `use-form-toast` decia "el mecanismo
// unico por donde pasan los 78 formularios", y era FALSO: describia a los hooks del toast, que usan 29
// archivos. Los otros 30 invocan la accion con `useActionState` a pelo.
//
// Y UNO DE ELLOS ERA EL BOTON QUE SANTIAGO REPORTABA: `resumen-diagnostico.tsx`, el de generar el
// borrador de IA. Su estado ni siquiera tiene la forma de los hooks (`{error, text}` contra
// `{error, success, warning}`), asi que no habia manera de que pasara por ahi.
//
// POR ESO ESTE CANDADO CUENTA ARCHIVOS EN VEZ DE MIRAR UNO. Un candado que verifica que los tres hooks
// llaman al guard (el que habia) puede estar perfecto y no ver que la mitad de la app no usa esos hooks.
// Es la leccion de siempre en su forma mas cara: verificamos el SITIO DE LLAMADA de la funcion, no la
// COBERTURA de los sitios que la necesitan.

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.next/.test(p)) archivos(p, acc);
    } else if (/\.tsx?$/.test(e.name)) acc.push(p.split("\\").join("/"));
  }
  return acc;
}

// ═══ LA UNICA AUSENCIA DELIBERADA, y lleva su razon escrita ═══
//
// El instrumento del PACIENTE es otra clase de superficie y sus reglas son las contrarias: es un
// formulario por fases, y al pasar de una a la siguiente la pagina DEBE irse arriba, porque lo que hay
// que leer empieza ahi. El guard esta hecho para deshacer un salto que nadie pidio; en las fases el salto
// SI se pide.
//
// Si algun dia esta lista crece, cada entrada lleva su razon o no entra: una exclusion sin motivo escrito
// es como un formulario se queda sin guard "porque alguien lo puso ahi".
const FUERA_A_PROPOSITO: Record<string, string> = {
  "src/modules/evaluations/components/survey-phase-form.tsx":
    "instrumento del paciente: al cambiar de fase la pagina DEBE subir",
};

const CON_FORMULARIO = archivos("src").filter(
  (f) => !f.includes("/tests/") && readFileSync(f, "utf8").includes("useActionState("),
);

/** Por donde puede llegarle el guard a un formulario. Cualquiera de las tres vale. */
function tieneGuard(src: string): boolean {
  return (
    /useFormToast(AndRefresh|RefreshOnSuccess)?\(/.test(src) ||
    src.includes("enviarSinReset") ||
    src.includes("ejecutarAccion") ||
    src.includes("preservarScroll")
  );
}

describe("todo formulario que invoca una acción arma el guard del scroll", () => {
  it("no queda ninguno huérfano", () => {
    const huerfanos = CON_FORMULARIO.filter(
      (f) => FUERA_A_PROPOSITO[f] == null && !tieneGuard(readFileSync(f, "utf8")),
    );
    expect(
      huerfanos,
      "Estos archivos invocan una server action y nadie arma `preservarScroll`: al invocarla, Next " +
        "navega con ScrollBehavior.Default y la página salta al inicio. Envía por `enviarSinReset` si " +
        "hay <form>, o por `ejecutarAccion` si la acción sale de un onClick. Si de verdad debe quedar " +
        "fuera, va a FUERA_A_PROPOSITO con su razón escrita.",
    ).toEqual([]);
  });

  it("y hay bastantes: si este número se desploma, el detector dejó de ver", () => {
    // CONTROL. Sin esto, un cambio que rompiera la deteccion (p. ej. que `useActionState` se envolviera en
    // otro helper) dejaria la lista vacia y el candado pasaria verde sin mirar nada.
    expect(CON_FORMULARIO.length).toBeGreaterThan(40);
  });

  it("la exclusión del instrumento del paciente sigue siendo UNA y con su razón", () => {
    // Una lista de exclusiones que crece en silencio es como vuelve el defecto por la puerta de atras.
    expect(Object.keys(FUERA_A_PROPOSITO)).toHaveLength(1);
    for (const [f, razon] of Object.entries(FUERA_A_PROPOSITO)) {
      expect(CON_FORMULARIO, `${f} ya no existe o dejó de tener formularios`).toContain(f);
      expect(razon.length).toBeGreaterThan(20);
    }
  });
});

describe("el guard se arma en el ENVÍO, no al llegar el resultado", () => {
  const ENVIO = readFileSync("src/components/shared/enviar-sin-reset.ts", "utf8");
  const GUARD = readFileSync("src/components/shared/preservar-scroll.ts", "utf8");

  it("`enviarSinReset` lo arma antes de invocar la acción", () => {
    // EN EL CLIC LA PAGINA ESTA DONDE EL PROFESIONAL LA DEJO. Al llegar el resultado puede estar ya
    // saltada, y entonces el guard captura `desde` = 0 y no tiene nada que deshacer.
    const i = ENVIO.indexOf("preservarScroll()");
    const j = ENVIO.indexOf("startTransition(() => action(new FormData");
    expect(i, "`enviarSinReset` dejó de armar el guard").toBeGreaterThan(-1);
    expect(i, "el guard se arma DESPUÉS de invocar la acción").toBeLessThan(j);
  });

  it("y hay puerta para los botones SIN formulario", () => {
    expect(ENVIO).toContain("export function ejecutarAccion(");
  });

  it("dos llamadas sobre la misma página no se pisan", () => {
    // El primero se armó en el clic y tiene el `desde` bueno; el segundo (el del hook del toast, que llega
    // después) capturaría una posición que puede estar ya saltada y "restauraría" al sitio equivocado.
    expect(GUARD).toContain("vivo.ruta === window.location.pathname");
    expect(GUARD).toContain("vivo.extender()");
  });

  it("y la primera espera llega hasta el tope, porque entre el clic y el salto está el servidor", () => {
    // Con la ventana de silencio de tres segundos como PRIMERA espera, el guard se retiraba antes de que
    // la respuesta volviera en las pantallas pesadas, que son justo donde se nota.
    expect(GUARD).toContain("primera ? restante :");
  });
});
