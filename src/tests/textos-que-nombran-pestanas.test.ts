import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { ETAPAS, etiquetaDeEtapa } from "@/modules/diagnoses/etapas";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LOS TEXTOS QUE NOMBRAN UNA PESTAÑA, O PROMETEN QUE ALGO SE CONSTRUIRA (2026-09-09).
//
// DOS DEFECTOS DE LA MISMA FAMILIA, encontrados en el mismo smoke, y el segundo llevaba MESES:
//   · La pestaña Diagnóstico mandaba a "la pestaña Evaluación" para importar el BIS. Esa pestaña dejó de
//     existir el día que se partió en Encuesta + Antrop. & BIS.
//   · Tratamiento, Seguimiento y Reporte/HC decían "Esta etapa se construye en un bloque posterior".
//     Están construidas desde hace semanas: lo que pasa es que sin diagnóstico no hay nada que mostrar,
//     que es otra cosa y además se resuelve.
//
// LO QUE TIENEN EN COMÚN: una cadena escrita a mano no sabe que su premisa cambió. Y no dan error, no
// salen en un diff, y nadie las relee. Solo aparecen cuando alguien mira la pantalla.
//
// POR ESO SE ATACA LA FORMA Y NO LOS DOS CASOS. Un texto que nombra una pestaña se DERIVA del mapa de
// etapas (`etapas.ts`), y ninguna cadena de pantalla promete construcción futura.

function tsxDelRepo(dir: string, salida: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) tsxDelRepo(ruta, salida);
    else if (/\.tsx$/.test(entrada)) salida.push(ruta.split(sep).join("/"));
  }
  return salida;
}

/** Los `.tsx` de pantalla, SIN comentarios: lo que se prohíbe es lo que el profesional LEE. */
function pantallas(): { archivo: string; codigo: string }[] {
  return tsxDelRepo("src")
    .filter((f) => !f.includes("/pdf/")) // los PDF son documentos, con su propia revisión
    .map((f) => ({ archivo: f, codigo: sinComentarios(readFileSync(f, "utf8")) }));
}

describe("ningún texto de pantalla promete que algo se construirá", () => {
  it("nada dice 'se construye', 'próximamente' ni 'en un bloque posterior'", () => {
    // Las tres formas que ya nos costaron. El texto de Tratamiento/Seguimiento/Reporte vivió MESES
    // diciendo que las etapas faltaban por construir cuando llevaban semanas construidas.
    const PROMESAS = [
      /se construye en un bloque/i,
      /pr[oó]ximamente/i,
      /se construir[aá]/i,
      /pendiente de construir/i,
    ];
    const culpables: string[] = [];
    for (const { archivo, codigo } of pantallas()) {
      for (const p of PROMESAS) if (p.test(codigo)) culpables.push(`${archivo} · ${p}`);
    }
    expect(culpables, "hay pantallas prometiendo construcción futura").toEqual([]);
  });

  it("el control: el barrido está mirando pantallas de verdad", () => {
    // Sin esto, un glob roto devolvería cero archivos y el caso de arriba pasaría verde sin mirar nada.
    const p = pantallas();
    expect(p.length, "no se leyó ninguna pantalla").toBeGreaterThan(50);
    expect(p.some((x) => x.codigo.includes("className")), "no parecen componentes").toBe(true);
  });
});

describe("los textos que nombran una pestaña salen del mapa, no de una cadena", () => {
  it("ninguna pantalla escribe a mano el nombre de una etapa como destino", () => {
    // La FORMA del defecto: "la pestaña <NOMBRE>" escrito a mano. Se prohíbe la construcción entera, no
    // el nombre suelto (que aparece legítimamente como título de la propia pestaña).
    const culpables: string[] = [];
    for (const { archivo, codigo } of pantallas()) {
      for (const etapa of ETAPAS) {
        // Con y sin las comillas tipográficas de JSX, y tolerando el salto de línea del formateador.
        const patron = new RegExp(`pesta[nñ]a\s*(<[^>]*>)?\s*${etapa.label.replace(/[.&]/g, "\$&")}`, "i");
        if (patron.test(codigo)) culpables.push(`${archivo} · "pestaña ${etapa.label}"`);
      }
    }
    expect(
      culpables,
      "una pantalla nombra una pestaña a mano: usa `etiquetaDeEtapa(...)` para que se renombre sola",
    ).toEqual([]);
  });

  it("y el helper existe y devuelve el rótulo de la barra", () => {
    // CONTROL de la aserción negativa: sin esto, borrar el helper también pasaría verde.
    expect(etiquetaDeEtapa("antro")).toBe("Antrop. & BIS");
    expect(etiquetaDeEtapa("diagnostico")).toBe("Diagnóstico");
  });

  it("el aviso de espera distingue GENERANDO de CARGANDO: son dos tramos, no uno", () => {
    // TERCER DEFECTO DE LA MISMA FAMILIA (Santiago, 2026-09-09): "es necesario esperar segundos para que
    // se genere el diagnóstico?".
    //
    // LO MEDIDO: el pipeline entero contra base de datos son ~600-830 ms. Los segundos son el
    // `router.refresh()` posterior, que vuelve a rendir la página entera contra la nube. O sea que el
    // tramo largo NO es generar, es cargar.
    //
    // Y EL TEXTO MENTÍA JUSTO AHÍ: con `pending ? "Generando..." : "Preparando..."`, en cuanto la acción
    // devolvía, `pending` volvía a false y la pantalla decía "Preparando el diagnóstico..." durante todo
    // el refresco, o sea que anunciaba estar preparando algo que ya había terminado. Un texto que afirma
    // un estado sin derivarlo, que es la forma que este archivo persigue.
    const PANEL = sinComentarios(
      readFileSync("src/modules/clinical-pipeline/components/generate-diagnosis-panel.tsx", "utf8"),
    );
    expect(
      PANEL,
      "el aviso de espera volvió a depender solo de `pending`: durante el refresco dirá que está " +
        "preparando algo que ya se generó",
    ).toContain("state.done");
    // Y el texto del tercer tramo existe. Sin esto, un `state.done` usado para otra cosa pasaría verde.
    expect(PANEL).toContain("Cargando los resultados");
  });

  it("y los dos avisos que lo destaparon lo usan", () => {
    // Los dos casos concretos, para que un rojo futuro diga cuál se rompió.
    const PANEL = sinComentarios(
      readFileSync("src/modules/clinical-pipeline/components/generate-diagnosis-panel.tsx", "utf8"),
    );
    const PAGINA = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
    expect(PANEL, "el aviso de qué falta volvió a escribir el nombre a mano").toContain(
      "etiquetaDeEtapa(",
    );
    expect(PAGINA, "el aviso de etapa sin contenido volvió a escribirlo a mano").toContain(
      'etiquetaDeEtapa("diagnostico")',
    );
  });
});
