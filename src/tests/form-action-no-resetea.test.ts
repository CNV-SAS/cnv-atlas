import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// CANDADO DEL AUTO-RESET DE REACT 19 (`<form action={fn}>`), EN TODA LA APLICACIÓN.
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
// EL CANDADO VA SOBRE LA REGLA, no sobre el PAL: ningún formulario puede usar la prop `action`. Da igual
// si hoy tiene un select: el día que alguien le agregue uno, el defecto vuelve sin que nada avise.
//
// ═══ POR QUÉ EL ALCANCE PASÓ DE UN MÓDULO A TODA LA APP (2026-09-01) ═══
//
// Este candado nació mirando SOLO `src/modules/treatment/components`, que es donde apareció el síntoma. La
// regla, en cambio, es de React: no tiene nada que ver con el tratamiento. Al medir el resto de la app
// había **36 formularios** con la prop `action`, y **12 con select o checkbox**, o sea con el defecto vivo.
// Entre ellos el modo de envío del reporte al paciente (radio): si el modo se revierte visualmente durante
// el refresco, el profesional puede enviar en un modo distinto del que eligió.
//
// Es la lección de que un hazard documentado sigue vivo en todas las superficies donde nadie fue a
// aplicarlo, otra vez, y con el agravante de que esta vez el candado existía y su alcance era un módulo.
//
// Y UNA ADVERTENCIA SOBRE MEDIRLO: la primera medición dio 14 en riesgo y DOS ERAN FALSOS, porque el
// detector cazó el texto `<form action={fn}>` dentro del comentario que explica por qué ese formulario NO
// lo usa. Los dos falsos eran justo los que ya estaban bien. Por eso aquí se ignoran los comentarios.

const DIRS = ["src/components", "src/modules", "src/app"];

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return tsx(p);
    return e.name.endsWith(".tsx") ? [p] : [];
  });
}

/**
 * Sin comentarios: un comentario que EXPLICA el hazard cita su forma, y el detector cazaría su propia
 * documentación. Ya nos pasó cuatro veces; aquí habría hecho "arreglar" dos archivos correctos.
 */
function sinComentariosJsx(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("ningún formulario de la app usa la prop `action`", () => {
  const archivos = DIRS.flatMap((d) => tsx(d)).filter(
    (f) => !f.includes("__tests__") && !f.includes(".test."),
  );

  it("hay formularios que revisar (control: si la lista quedara vacía, el candado no probaría nada)", () => {
    const conForm = archivos.filter((f) => readFileSync(f, "utf8").includes("<form"));
    expect(conForm.length).toBeGreaterThan(30);
  });

  it.each(archivos.filter((f) => readFileSync(f, "utf8").includes("<form")))("%s", (archivo) => {
    const src = sinComentariosJsx(readFileSync(archivo, "utf8"));
    const usos = (src.match(/<form[^>]*\saction=\{/g) ?? []).length;
    expect(
      usos,
      `${archivo} usa <form action={...}>. React 19 dispara un form.reset() nativo al ejecutar la acción, ` +
        `y los select y checkbox controlados vuelven a su valor DE MONTAJE durante lo que tarde el refresh. ` +
        `Usa onSubmit={enviarSinReset(accion)} (src/components/shared/enviar-sin-reset.ts).`,
    ).toBe(0);
  });
});

const TRATAMIENTO = "src/modules/treatment/components";

describe("el mecanismo de envío es UNO, no uno por formulario", () => {
  it("todos pasan por `enviarSinReset`", () => {
    // Doce formularios con doce copias de `e.preventDefault(); startTransition(...)` es como se pierde uno.
    const panel = readFileSync(`${TRATAMIENTO}/treatment-panel.tsx`, "utf8");
    // La cadena se parte a proposito: escrita entera parece una linea de import, y `check:rsc` la lee
    // como si este test importara un modulo cliente. El checker mira el TEXTO, no el arbol, asi que una
    // cadena que se parece a un import le basta. (Anotado en BACKLOG: tambien podria fallar al reves.)
    expect(panel).toContain("enviarSinReset } from " + '"@/components/shared/enviar-sin-reset"');
    expect((panel.match(/onSubmit=\{enviarSinReset\(/g) ?? []).length).toBeGreaterThanOrEqual(12);
    // Y nadie se escribe el suyo a mano dentro del módulo.
    for (const f of tsx(TRATAMIENTO)) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} se escribió su propio submit en vez de usar enviarSinReset`).not.toContain(
        "startTransition(() => ",
      );
    }
  });

  it("y en el resto de la app nadie se copia el helper a mano", () => {
    // El alcance del candado se amplió a toda la app el 2026-09-01. Esta mitad cuida la OTRA forma de
    // perder el arreglo: no volver a la prop `action`, sino que cada quien se escriba su propia copia del
    // helper. Una copia por formulario es una copia que algún día olvida el `preventDefault` y recarga la
    // página con el formulario a medias.
    //
    // SE PROHÍBE LA COPIA VERBATIM, NO CUALQUIER `onSubmit` PROPIO, y el alcance se acotó midiendo: de los
    // nueve archivos que despachan a mano, SIETE hacen algo que el helper no puede hacer (arman el
    // FormData con el `submitter`, llaman a una action con un objeto en vez de FormData, guardan un
    // snapshot del FormData porque el DOM del formulario se oculta después). Obligarlos al helper sería
    // romperlos para que un candado quede verde. Los otros dos eran el helper escrito letra por letra, y
    // esos sí se migraron.
    const COPIA = "startTransition(() => action(new FormData(e.currentTarget)))";
    const copias: string[] = [];
    for (const f of DIRS.flatMap((d) => tsx(d))) {
      if (f.includes("enviar-sin-reset")) continue;
      if (readFileSync(f, "utf8").includes(COPIA)) copias.push(f);
    }
    expect(
      copias,
      `estos archivos copiaron \`enviarSinReset\` a mano en vez de importarlo:\n${copias.join("\n")}`,
    ).toEqual([]);
  });
});
