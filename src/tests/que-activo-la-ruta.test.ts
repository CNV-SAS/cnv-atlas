import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { activadorDeLaRuta } from "@/clinical-engine/activador-de-la-ruta";
import type { DfiDomain } from "@/clinical-engine/types";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUE ACTIVO LA RUTA, Y POR QUE ESTA FRASE NECESITA CANDADO  ·  2026-11-07
//
// El smoke de `ed83ff97` mostro la tarjeta de la R1 diciendo *"Activación: IFC bajo + IRC alto + IAE
// acelerado"* con un IRC de 2,71, que es NORMAL. Las dos cosas son de Gildardo y las dos estan portadas
// verbatim: el rotulo acompaña a su predicado `condicion` (un Y de tres) y la activacion de verdad es su
// DFI (`dom1.sev>=2`, con la matriz D1 donde "Normal|Normal" vale 2). Su propio archivo declara el DFI
// como UNICA fuente de rutas, asi que su predicado esta muerto en los dos lados.
//
// LO QUE SE ARREGLO NO ES NINGUNA DE LAS DOS (Regla 0: las dos son suyas y la pregunta se le devuelve):
// la tarjeta AÑADE el dato sellado que dice que la activo de verdad. Y eso es una frase sobre una
// decision clinica, asi que lo que puede fallar en ella se amarra aqui.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const dom = (id: string, sev: number | null, clasif: string, veto = false): DfiDomain => ({
  id,
  nombre:
    id === "d1" ? "Celular-Eléctrico"
    : id === "d2" ? "Cardiometabólico"
    : id === "d3" ? "Envejecimiento"
    : id === "d4" ? "Conductual-Emocional"
    : "Contextual",
  sev,
  clasif,
  lectura: "",
  items: [],
  veto,
});

const CINCO = [
  dom("d1", 2, "IFC Normal · IRC Normal"),
  dom("d2", 0, "Sin exceso"),
  dom("d3", 1, "IAE +2,0"),
  dom("d4", 0, "Sin conductas de riesgo"),
  dom("d5", 3, "4 factores"),
];

describe("la frase dice el dominio que empujo la ruta, leido del DFI sellado", () => {
  it("la R1 sale del dominio 1, con su severidad y su clasificacion", () => {
    expect(activadorDeLaRuta("R1", CINCO)).toBe(
      "En esta consulta la activó el dominio 1 (Celular-Eléctrico), severidad 2 de 3: IFC Normal · IRC Normal.",
    );
  });

  // ═══ EL CRUCE QUE UN "OBVIO" SE LLEVA POR DELANTE ═══
  //
  // En su `computeDFI`, la R3 la empuja el dominio CUATRO (el conductual, por veto o severidad 3) y la R4
  // el dominio TRES (el envejecimiento). El numero de la ruta NO es el del dominio. Escribirlo de la
  // forma que parece evidente (R3->d3, R4->d4) pondria una explicacion equivocada en una tarjeta clinica,
  // y encima coherente: habria citado un dominio que existe, con una severidad de verdad.
  it("la R3 sale del dominio 4 y la R4 del dominio 3, que es el cruce de su archivo", () => {
    expect(activadorDeLaRuta("R3", CINCO)).toContain("dominio 4 (Conductual-Emocional)");
    expect(activadorDeLaRuta("R4", CINCO)).toContain("dominio 3 (Envejecimiento)");
  });

  it("y el VETO conductual se nombra antes que la severidad, porque es lo que la empuja", () => {
    const conVeto = CINCO.map((d) => (d.id === "d4" ? dom("d4", 1, "Riesgo conductual", true) : d));
    expect(activadorDeLaRuta("R3", conVeto)).toBe(
      "En esta consulta la activó el veto conductual del dominio 4 (Conductual-Emocional).",
    );
  });

  it("la R6 NO cita ningun dominio: la activa la ausencia de las otras cinco", () => {
    expect(activadorDeLaRuta("R6", CINCO)).toBe(
      "La activa que ninguna de las otras cinco rutas esté activa en esta consulta.",
    );
    // Y lo dice IGUAL sin dominios: no depende de ellos.
    expect(activadorDeLaRuta("R6", null)).toBe(activadorDeLaRuta("R6", CINCO));
  });

  it("CALLA en vez de inventar: sin dominios sellados, y con severidad nula", () => {
    // Un snapshot viejo no trae los dominios. Decir algo ahi seria afirmar un motivo que no se leyo.
    expect(activadorDeLaRuta("R1", null)).toBeNull();
    expect(activadorDeLaRuta("R1", [])).toBeNull();
    // SEV NULL ES "NO SE MIDIO" Y NO CERO, que es la leccion de las tarjetas de dominio: un vacio no se
    // puede presentar como una lectura. Sin esta guarda la frase diria "severidad null de 3".
    const sinMedir = CINCO.map((d) => (d.id === "d1" ? dom("d1", null, "IFC — · IRC —") : d));
    expect(activadorDeLaRuta("R1", sinMedir)).toBeNull();
  });
});

describe("y no se corrige lo que es de Gildardo", () => {
  const CONTENIDO = sinComentarios(readFileSync("src/clinical-engine/rutas-content.ts", "utf8"));
  const SECCION = sinComentarios(
    readFileSync("src/modules/diagnoses/components/rutas-section.tsx", "utf8"),
  );

  it("el rotulo de activacion de la R1 sigue siendo el suyo, y EL lo cambio (v17 §10)", () => {
    // ═══ ESTE CANDADO SE REAPUNTA, Y LA HISTORIA ES LA QUE IMPORTA (2026-11-12) ═══
    //
    // Decia: *"si alguien lo arregla para que cuadre con lo que activa, deja de ser su archivo"*, y
    // exigia el rotulo viejo (*"IFC bajo + IRC alto + IAE acelerado"*) palabra por palabra. Era
    // correcto: el rotulo describia su predicado `condicion`, que no activa nada, y nosotros no
    // podiamos corregirle un texto clinico. Fue la pregunta 38 de PENDIENTES.
    //
    // LA RESPONDIO EN SU v17 §10: retira la funcion `activar`, deja de evaluar `condicion` y reescribe
    // los seis rotulos para que describan el criterio del DFI. Asi que el rotulo sigue siendo SUYO; lo
    // que cambio es que ahora el suyo dice lo que de verdad pasa. Lo que NO se hizo, ni antes ni ahora,
    // es inventarlo.
    expect(CONTENIDO).toContain('activacion: "Dominio Celular-Eléctrico con gravedad 2 o 3"');
    // Y el viejo no puede volver: si reapareciera, la tarjeta volveria a describir un criterio retirado.
    expect(CONTENIDO).not.toContain("IFC bajo + IRC alto + IAE acelerado");
    expect(SECCION).toContain("Activación: {ruta.activacion}");
  });

  it("y la tarjeta muestra las DOS cosas: su rotulo y el dominio que la activo", () => {
    expect(SECCION).toContain("activadorDeLaRuta(ruta.id, domains)");
    expect(SECCION).toContain("{activador ?");
  });
});
