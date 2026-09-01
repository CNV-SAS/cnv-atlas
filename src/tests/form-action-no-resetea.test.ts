import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// CANDADO DEL AUTO-RESET DE REACT 19 (`<form action={fn}>`), en el módulo de tratamiento.
//
// EL MECANISMO, verificado en el react-dom instalado (19.2.4) y no razonado. Cuando un `<form>` lleva la
// prop `action`, React programa un `form.reset()` NATIVO dentro de la transición de la acción:
//
//     null === action ? noop : function () { requestFormReset$1(formFiber); return action(formData); }
//     5 === fiber.tag && fiber.flags & 1024 && fiber.stateNode.reset();
//
// Y EL RESET NO AFECTA A TODOS LOS CAMPOS IGUAL, que es lo que lo hace tan difícil de leer:
//
//   · input / textarea → `element.defaultValue = value` en CADA actualización. INMUNES.
//   · select           → `setDefaultSelected && (node[i].defaultSelected = true)`, y eso solo es cierto
//                        AL MONTAR. Vuelve a la opción que estaba elegida cuando el componente se montó.
//   · checkbox / radio → `null == checked && null != defaultChecked && ...`: con `checked` presente React
//                        NO toca `defaultChecked`. Mismo problema que el select.
//
// EL DEFECTO REAL (smoke 2026-09-01): al pulsar "Guardar ajustes", los DOS desplegables del PAL saltaban
// a otro nivel durante uno o dos segundos (lo que tarda el `router.refresh()`). Pasaba SIN TOCAR el PAL,
// porque el reset es del FORMULARIO ENTERO. Se diagnosticó mal DOS VECES antes de ir al código de React:
// la primera explicación (una `option` sin correspondencia) y la segunda (esa misma `option` puesta
// `disabled`) eran ciertas como defectos pero no eran ESTE.
//
// NO ES COSMÉTICO: durante esa ventana el DOM y el estado de React dicen cosas distintas, y un `onChange`
// en esa ventana parte del valor reseteado.
//
// EL CANDADO VA SOBRE LA REGLA, no sobre el PAL: ningún formulario del módulo puede usar la prop `action`.
// Da igual si hoy tiene un select: el día que alguien le agregue uno, el defecto vuelve sin que nada avise.

const DIR = "src/modules/treatment/components";

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return tsx(p);
    return e.name.endsWith(".tsx") ? [p] : [];
  });
}

describe("ningún formulario de tratamiento usa la prop `action`", () => {
  const archivos = tsx(DIR);

  it("hay formularios que revisar (control: si la lista quedara vacía, el candado no probaría nada)", () => {
    const conForm = archivos.filter((f) => readFileSync(f, "utf8").includes("<form"));
    expect(conForm.length).toBeGreaterThan(3);
  });

  it.each(archivos)("%s", (archivo) => {
    const src = readFileSync(archivo, "utf8");
    const usos = (src.match(/<form[^>]*\saction=\{/g) ?? []).length;
    expect(
      usos,
      `${archivo} usa <form action={...}>. React 19 dispara un form.reset() nativo al ejecutar la acción, ` +
        `y los select y checkbox controlados vuelven a su valor DE MONTAJE durante lo que tarde el refresh. ` +
        `Usa onSubmit={enviarSinReset(accion)} (src/components/shared/enviar-sin-reset.ts).`,
    ).toBe(0);
  });
});

describe("el mecanismo de envío es UNO, no uno por formulario", () => {
  it("todos pasan por `enviarSinReset`", () => {
    // Doce formularios con doce copias de `e.preventDefault(); startTransition(...)` es como se pierde uno.
    const panel = readFileSync(`${DIR}/treatment-panel.tsx`, "utf8");
    // La cadena se parte a proposito: escrita entera parece una linea de import, y `check:rsc` la lee
    // como si este test importara un modulo cliente. El checker mira el TEXTO, no el arbol, asi que una
    // cadena que se parece a un import le basta. (Anotado en BACKLOG: tambien podria fallar al reves.)
    expect(panel).toContain("enviarSinReset } from " + '"@/components/shared/enviar-sin-reset"');
    expect((panel.match(/onSubmit=\{enviarSinReset\(/g) ?? []).length).toBeGreaterThanOrEqual(12);
    // Y nadie se escribe el suyo a mano dentro del módulo.
    for (const f of tsx(DIR)) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} se escribió su propio submit en vez de usar enviarSinReset`).not.toContain(
        "startTransition(() => ",
      );
    }
  });
});
