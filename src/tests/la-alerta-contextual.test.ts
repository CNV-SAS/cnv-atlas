import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  alertaContextual,
  BANDA_IAE_ANIOS,
  CORTE_ICEC_ALERTA_CONTEXTUAL,
} from "@/clinical-engine/presentacion-eb-bis";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA ALERTA CONTEXTUAL  ·  v15, su decision 4 del 30 de octubre
//
// Textual suyo: *"Se activa con ICEC < 50 e IAE v7 ≥ +5 años y la ve solo el profesional. Es la pareja de
// la alerta de discordancia: aquella avisa cuando el deterioro celular no concuerda con hábitos buenos;
// esta, cuando hábitos y contexto desfavorables coinciden con envejecimiento acelerado."*
//
// ═══ POR QUE ESTA ALERTA NECESITA CANDADO MAS QUE OTRAS ═══
//
// Afirma algo sobre un paciente y pide mirarlo, asi que los dos errores posibles son caros: que no salte
// cuando debe (el profesional no se enteraría) y que salte cuando no debe (un aviso que exagera se aprende
// a ignorar, y entonces no avisa de nada el dia que importa). Los dos cortes son suyos y van exactos.
//
// Y LO QUE NO SE PUEDE PERDER DE VISTA: la alerta se dispara con ICEC < 50, y hasta el 2026-09-06 el
// componente de Alimentacion del ICEC estaba clavado. Construirla entonces la habria hecho saltar sobre un
// ICEC que no medía lo que decía. Por eso el plan la puso DESPUES de v16 §7, y por eso entra hoy.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("los dos cortes son los suyos, y van exactos", () => {
  it("salta con ICEC por debajo de 50 e IAE en +5 o mas", () => {
    expect(alertaContextual(49, 5)).toContain("Alerta contextual");
    expect(alertaContextual(10, 12.4)).toContain("Alerta contextual");
  });

  it("el ICEC es ESTRICTO (< 50) y el IAE es INCLUSIVO (>= 5), como en su archivo", () => {
    // Su linea: `le8Total < 50 && iae_d >= 5`. Los dos bordes son distintos a proposito y escribir los dos
    // igual es el error facil: con `<= 50` saltaria sobre un ICEC de 50, que su condicion deja fuera.
    expect(alertaContextual(50, 9), "un ICEC de 50 no entra: su corte es estricto").toBeNull();
    expect(alertaContextual(49.9, 9)).not.toBeNull();
    expect(alertaContextual(40, BANDA_IAE_ANIOS), "el IAE de +5 SI entra").not.toBeNull();
    expect(alertaContextual(40, 4.9)).toBeNull();
  });

  it("y el corte del IAE se LEE de la banda del motor, no se escribe otra vez", () => {
    // El dia que Gildardo mueva su banda del IAE, esta alerta se mueve con ella. Un 5 escrito aqui se
    // quedaria quieto y nada fallaria. (Su propio documento ya movio este umbral una vez: reemplaza el
    // `IAE > 3` de la Guia del Desarrollador v2, definido sobre la escala anterior de la EB-BIS.)
    const FUENTE = sinComentarios(readFileSync("src/clinical-engine/presentacion-eb-bis.ts", "utf8"));
    expect(FUENTE).toContain("iae >= BANDA_IAE_ANIOS");
    expect(FUENTE).toContain("export const CORTE_ICEC_ALERTA_CONTEXTUAL = 50;");
    expect(CORTE_ICEC_ALERTA_CONTEXTUAL).toBe(50);
  });

  it("CALLA con cualquiera de las dos cifras ausente: no se emite con un vacío leído como cero", () => {
    // Es la regla del resto del motor, y aqui importa doble: un ICEC ausente leido como 0 cumpliria "< 50"
    // y la alerta saltaria sobre un paciente del que no se sabe nada de su contexto.
    expect(alertaContextual(null, 9)).toBeNull();
    expect(alertaContextual(20, null)).toBeNull();
    expect(alertaContextual(null, null)).toBeNull();
  });

  it("su texto lleva las DOS cifras, para que el profesional pueda cotejarlo", () => {
    expect(alertaContextual(37.4, 8)).toBe(
      "Alerta contextual: envejecimiento bioeléctrico acelerado con carga epigenética alta " +
        "(ICEC 37 < 50 e IAE ≥ +5 años)",
    );
  });
});

describe("y es la PAREJA de la de discordancia, no su duplicado", () => {
  it("nunca pueden salir las dos en la misma consulta", () => {
    // La de discordancia exige habitos reportados FAVORABLES y esta exige un ICEC bajo, asi que sus
    // condiciones son incompatibles por construccion. Se comprueba leyendo la condicion de la otra: la
    // alerta de discordancia la calcula el frozen y llega en el resultado, asi que aqui se afirma lo que
    // SI se puede afirmar desde este lado, que es que esta no mira la misma cosa.
    const FUENTE = sinComentarios(readFileSync("src/clinical-engine/presentacion-eb-bis.ts", "utf8"));
    expect(FUENTE).toContain("r.alertaDiscordancia");
    // Y la contextual NO lee `alertaDiscordancia`: si lo hiciera, serian la misma alerta con dos nombres.
    const fn = FUENTE.slice(FUENTE.indexOf("export function alertaContextual"));
    expect(fn).not.toContain("alertaDiscordancia");
  });
});

describe("y la ve SOLO el profesional", () => {
  const PANTALLA = readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8");

  it("la pantalla del profesional la calcula del snapshot sellado y la pinta", () => {
    expect(PANTALLA).toContain("alertaContextual(dfi.le8Total ?? null, indicators.iae ?? null)");
    expect(PANTALLA).toContain("{avisoContextual ?");
    // EN EL COLOR DE ATENCION, como la de discordancia: las dos piden mirar algo.
    expect(PANTALLA).toContain('{avisoContextual ? <p className="text-clinical-warning">');
  });

  it("y NINGUNA superficie del paciente la lleva", () => {
    // Su decision dice "solo profesional". El informe, la hoja del plan y la historia clinica del paciente
    // no la nombran, y este caso existe para que no se cuele por copiar un bloque.
    for (const f of [
      "src/modules/reports/pdf/report-document.tsx",
      "src/modules/reports/data/informe-paciente-reader.ts",
      "src/clinical-engine/dfi-paciente.ts",
    ]) {
      expect(readFileSync(f, "utf8"), `${f} nombra la alerta contextual`).not.toContain(
        "alertaContextual",
      );
    }
  });
});
