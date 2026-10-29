import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  laMarcaSeQuitaDesdeLaVenta,
  porQueCuentaComoDePrueba,
} from "@/modules/payments/por-que-cuenta-como-de-prueba";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: /pagos DICE POR QUE UNA VENTA NO CUENTA, Y NO SOLO QUE NO CUENTA
//
// ── DE DONDE SALE (Santiago, 2026-10-28) ────────────────────────────────────────────────────────
//
// Reporto *"ventas duplicadas de Maria Camila: una ya estaba registrada como prueba y otra me aparece
// normal"*. Medido contra produccion: NO estaban duplicadas. Eran tres ventas de tres dias distintos, y
// cada una cuenta de prueba por una razon distinta (`scripts/LAS_VENTAS_DUPLICADAS_2026-10-28.mjs`).
//
// LO QUE DE VERDAD FALLABA ES QUE LA LISTA NO LO DECIA: con el interruptor de "ver las de prueba"
// encendido, una venta de prueba y una real se ven IGUAL. Dos ventas parecidas de la misma profesional se
// leen entonces como una duplicada, y el reporte apunta al sitio equivocado.
//
// ES LA CAPA 3 DE `patients/de-prueba.ts` ("marcadas, no escondidas"), que la lista de pacientes, la del
// integrante y el inventario ya aplicaban. /pagos era el unico sitio donde la marca no se veia, y es la
// leccion de que una regla tambien vive en varios sitios.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PAGINA = sinComentarios(readFileSync("src/app/(app)/pagos/page.tsx", "utf8"));
const REPO = sinComentarios(readFileSync("src/modules/payments/data/payments-repository.ts", "utf8"));
const BOTON = sinComentarios(
  readFileSync("src/modules/payments/components/marcar-venta-de-prueba.tsx", "utf8"),
);

const hechos = (p: Partial<Parameters<typeof porQueCuentaComoDePrueba>[0]>) => ({
  cuentaComoDePrueba: true,
  marcadaAMano: false,
  profesionalDePrueba: false,
  pacienteDePrueba: false,
  productoDePrueba: false,
  ...p,
});

describe("la razon, no solo la marca", () => {
  it("una venta que cuenta normalmente no dice nada", () => {
    expect(porQueCuentaComoDePrueba(hechos({ cuentaComoDePrueba: false }))).toBeNull();
  });

  it("nombra cada una de las cuatro entradas", () => {
    expect(porQueCuentaComoDePrueba(hechos({ marcadaAMano: true }))).toContain("mano");
    expect(porQueCuentaComoDePrueba(hechos({ profesionalDePrueba: true }))).toContain("profesional");
    expect(porQueCuentaComoDePrueba(hechos({ pacienteDePrueba: true }))).toContain("paciente");
    expect(porQueCuentaComoDePrueba(hechos({ productoDePrueba: true }))).toContain("producto");
  });

  it("el orden es el de LA DECISION: la marca a mano gana sobre lo derivado", () => {
    // Al reves, una venta marcada a mano sobre un paciente de prueba diria "porque el paciente es de
    // prueba" y mandaria a quitar la marca del paciente, que no es lo que pasa ahi.
    const ambas = hechos({ marcadaAMano: true, pacienteDePrueba: true, profesionalDePrueba: true });
    expect(porQueCuentaComoDePrueba(ambas)).toContain("mano");
  });

  it("y si la derivada esta en true sin ninguna entrada conocida, NO se inventa una razon", () => {
    // La columna puede quedar en true por una entrada que todavia no se lee aqui. Decir una de las cuatro
    // al azar seria mandar a mirar donde no es.
    expect(porQueCuentaComoDePrueba(hechos({}))).toBe("No cuenta en las cifras");
  });
});

describe("el boton que se ofrece es el que hace algo", () => {
  it("solo se quita desde la venta la marca que una persona puso a mano", () => {
    expect(laMarcaSeQuitaDesdeLaVenta(hechos({ marcadaAMano: true }))).toBe(true);
    for (const derivada of ["profesionalDePrueba", "pacienteDePrueba", "productoDePrueba"] as const) {
      expect(
        laMarcaSeQuitaDesdeLaVenta(hechos({ [derivada]: true })),
        `se ofrece desmarcar una venta derivada por ${derivada}`,
      ).toBe(false);
    }
  });

  it("y el componente se calla en vez de ofrecer un boton que no hace lo que dice", () => {
    expect(BOTON).toContain("yaNoCuentaPorDerivacion");
    expect(BOTON).toContain("return null");
  });
});

describe("y los datos de la razon llegan a la pantalla", () => {
  it("el lector pide las tres entradas derivadas, con el HINT del embed ambiguo", () => {
    // `professional_profiles` tiene TRES relaciones hacia `profiles`: sin `profiles!profile_id` PostgREST
    // falla en runtime y tsc no lo ve.
    expect(REPO).toContain("profiles!profile_id(full_name)");
    expect(REPO).toContain("cuenta_como_de_prueba");
    expect(REPO).toContain("nutraceuticals(name, is_test)");
  });

  it("la pagina pinta la razon, y no la escribe por su cuenta", () => {
    // Dos redacciones del mismo hecho acaban diciendo cosas distintas (hazard 4: dos partes que leen
    // fuentes distintas).
    expect(PAGINA).toContain("porQueCuentaComoDePrueba(");
    expect(PAGINA, "la página redacta la razón a mano").not.toContain("De prueba porque su");
  });

  it("y NO las esconde: una lista que las oculta no sirve para probar", () => {
    expect(PAGINA, "/pagos volvió a filtrar las de prueba en vez de marcarlas").not.toContain(
      '.eq("cuenta_como_de_prueba", false)',
    );
  });
});
