import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// UN ACTO CLINICO SE DISPARA AL ENTRAR A LA PANTALLA, NO AL CUMPLIRSE LA CONDICION (Santiago, 2026-09-10).
//
// EL DEFECTO: Santiago entro a Diagnostico SIN el BIS importado y vio el bloqueo correcto. Se fue a
// Antrop. & BIS, importo el xlsx, y **el diagnostico se genero solo**, sin volver a esa pestaña y sin que
// hubiera puesto el peso meta ni la fuerza prensil. Es justo el caso que el disparo automatico existe para
// no hacer: diagnosticar sobre datos que el profesional todavia va a tocar.
//
// FUERON DOS COSAS A LA VEZ, y ninguna bastaba sola:
//   1. EL EFECTO QUEDO ARMADO. Hasta el 2026-09-09, cambiar de pestaña DESMONTABA la anterior, asi que el
//      efecto solo podia correr estando en Diagnostico. Al hacer que una etapa visitada no se desmonte
//      (para no perder el borrador del tratamiento), el panel siguio vivo en segundo plano.
//   2. Y EL REFRESCO reevaluo la condicion: al importar, `bisImported` volteo a true y con el `ready`.
//
// LA REGLA, QUE ES MAS GRANDE QUE ESTE PANEL: desde que una etapa visitada no se desmonta, **estar montado
// dejo de significar estar a la vista**. Todo lo que dependia de esa equivalencia hay que decirlo
// explicito, y lo que dispara un ACTO CLINICO es lo primero. Por eso el candado no mira solo este archivo:
// barre los efectos que invocan una accion y exige que cuelguen de la visibilidad.

const PANEL = readFileSync(
  "src/modules/clinical-pipeline/components/generate-diagnosis-panel.tsx",
  "utf8",
);
const TABS = readFileSync("src/modules/diagnoses/components/evaluation-tabs.tsx", "utf8");
const CONTEXTO = readFileSync("src/modules/diagnoses/components/etapa-activa.tsx", "utf8");

describe("el disparo del diagnostico cuelga de ENTRAR, no de la condicion", () => {
  it("el efecto mira si la etapa esta ACTIVA", () => {
    const codigo = sinComentarios(PANEL);
    expect(codigo, "el panel dejó de mirar si su etapa está a la vista").toContain(
      "const activa = useEtapaActiva()",
    );
    // La guarda Y la dependencia: sin la dependencia, entrar a la pestaña no volvería a evaluarlo y el
    // diagnóstico no se generaría nunca. Son las dos mitades del mismo arreglo.
    expect(codigo).toContain("if (!activa || !ready || disparado.current) return;");
    expect(codigo).toContain("[activa, ready, action, evaluationId]");
  });

  it("y sigue disparándose UNA sola vez", () => {
    // El ref es lo que impide que entrar, salir y volver lo relance. Con el montaje persistente sobrevive
    // a los cambios de pestaña, que es justo lo que hace falta.
    const codigo = sinComentarios(PANEL);
    expect(codigo).toContain("const disparado = useRef(false)");
    expect(codigo).toContain("disparado.current = true");
  });

  it("las pestañas dicen cuál está a la vista", () => {
    // Es el sitio de llamada: el hook puede estar perfecto y no servir de nada si nadie provee el valor.
    // Sin esto, el contexto cae a su default `true` y el defecto vuelve entero.
    expect(TABS).toContain("<EtapaActiva activa={id === active}>");
    expect(CONTEXTO).toContain("export function useEtapaActiva()");
  });

  it("y el default del contexto es `true`: fuera de las pestañas, nada cambia", () => {
    // CONTROL de la aserción de arriba, y decisión declarada: un panel renderizado fuera de las pestañas
    // se comporta como siempre. Si el default fuera `false`, un componente movido de sitio dejaría de
    // dispararse en silencio, que es el modo de fallo opuesto y peor.
    expect(CONTEXTO).toContain("createContext(true)");
  });
});

describe("la regla, en todos los sitios donde puede volver a aparecer", () => {
  // ESTAR MONTADO YA NO ES ESTAR A LA VISTA. El barrido busca la FORMA del defecto: un efecto que invoca
  // una server action y NO mira la visibilidad. Hoy solo hay uno; el candado existe para el segundo.
  const RAIZ = "src/modules";

  function tsx(dir: string, salida: string[] = []): string[] {
    for (const entrada of readdirSync(dir)) {
      const ruta = join(dir, entrada);
      if (statSync(ruta).isDirectory()) tsx(ruta, salida);
      else if (/\.tsx$/.test(entrada)) salida.push(ruta.split(sep).join("/"));
    }
    return salida;
  }

  /** Efectos que invocan la accion de un `useActionState` sin que medie un clic. */
  function disparadoresAutomaticos(): string[] {
    const fuera: string[] = [];
    for (const archivo of tsx(RAIZ)) {
      const src = sinComentarios(readFileSync(archivo, "utf8"));
      if (!src.includes("useActionState(")) continue;
      // La forma: dentro de un `useEffect`, se llama a la accion con un FormData recien armado.
      for (const efecto of src.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/g) ?? []) {
        if (!/new FormData\(\)/.test(efecto)) continue;
        if (!/\baction\(|\bguardar\(|\bregistrar\(/.test(efecto)) continue;
        if (!/\bactiva\b/.test(efecto)) fuera.push(archivo);
      }
    }
    return fuera;
  }

  it("ningún efecto dispara una acción sin mirar si su pantalla está a la vista", () => {
    expect(
      disparadoresAutomaticos(),
      "un efecto invoca una server action sin comprobar que su etapa esté activa. Desde que una etapa " +
        "visitada no se desmonta, estar montado NO es estar a la vista: ese efecto va a correr desde otra " +
        "pestaña en cuanto se cumpla su condición.",
    ).toEqual([]);
  });

  it("y el barrido está mirando de verdad (control)", () => {
    // Sin esto, un regex roto devolvería cero y el caso de arriba pasaría verde sin haber leído nada.
    const conAccion = tsx(RAIZ).filter((f) => readFileSync(f, "utf8").includes("useActionState("));
    expect(conAccion.length, "el barrido no encontró pantallas con acciones").toBeGreaterThan(10);
    expect(
      conAccion.some((f) => f.includes("generate-diagnosis-panel")),
      "el panel que tuvo el defecto se salió del barrido",
    ).toBe(true);
  });
});
