import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BANDA_IAE_ANIOS,
  ebBisParaElProfesional,
  ebBisParaTodos,
  NOTA_DFI_SIN_ENCUESTA,
  textoEbBis,
  textoIae,
} from "@/clinical-engine/presentacion-eb-bis";
import type { ResultadoEbBis } from "@/clinical-engine/types";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DE LA TABLA 3: SUS TEXTOS, Y QUIEN VE QUE
//
// Entrega de Gildardo del 2026-10-26, §5. Su pie: *"Toda salida se presenta como estimacion, nunca como
// diagnostico."* Las frases son suyas; este candado impide que se "mejoren".
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ok = (p: Partial<ResultadoEbBis> = {}): ResultadoEbBis => ({
  estado: "ok",
  motivo: null,
  zPares: 2.48,
  topado: false,
  alertaDiscordancia: false,
  versionMotor: "EB-BIS v7",
  versionParametros: "7.1.0",
  ...p,
});

describe("las frases son las suyas, con su formato", () => {
  it("la EB-BIS: su ejemplo de la tabla 3 sale igual", () => {
    // Su ejemplo literal es el del primer caso de aceptacion: "Edad biológica estimada: 76,4 años".
    expect(textoEbBis(76.4)).toBe("Edad biológica estimada: 76,4 años");
    // Un decimal SIEMPRE, incluso en un entero: "40 años" se lee como una cifra de otra precision.
    expect(textoEbBis(40)).toBe("Edad biológica estimada: 40,0 años");
  });

  it("el IAE: las TRES bandas, con el signo y el texto que el escribio", () => {
    expect(textoIae(12.4)).toBe("+12,4 años: envejecimiento acelerado estimado");
    expect(textoIae(0.5)).toBe("+0,5 años: acorde con sus pares");
    expect(textoIae(-1.4)).toBe("-1,4 años: acorde con sus pares");
    expect(textoIae(-8.2)).toBe("-8,2 años: envejecimiento desacelerado estimado");
  });

  it("y los cortes son CERRADOS en ±5,0, porque el los escribio con >= y <=", () => {
    // Un IAE de exactamente +5,0 es acelerado, no intermedio. Es la clase de detalle que se pierde al
    // reescribir una regla "como se entiende" en vez de como esta escrita.
    expect(BANDA_IAE_ANIOS).toBe(5);
    expect(textoIae(5)).toContain("acelerado");
    expect(textoIae(4.9)).toContain("acorde con sus pares");
    expect(textoIae(-5)).toContain("desacelerado");
    expect(textoIae(-4.9)).toContain("acorde con sus pares");
  });

  it("TODO va como estimacion, nunca como diagnostico", () => {
    // Su pie de la tabla 3. Si alguien escribe "tiene", "diagnostico" o "es" sobre una de estas cifras,
    // la salida deja de ser lo que el autorizo.
    const frases = [
      textoEbBis(76.4),
      textoIae(12.4),
      textoIae(0.5),
      textoIae(-8.2),
      ebBisParaElProfesional(ok({ topado: true })).tope!,
      ebBisParaElProfesional(ok({ alertaDiscordancia: true })).alerta!,
    ];
    for (const f of frases) {
      expect(f.toLowerCase(), `"${f}" afirma un diagnostico`).not.toMatch(/diagn[oó]stic|padece|tiene /);
    }
    // Y las dos cifras que ve el paciente llevan la palabra: su tabla dice "estimada" y "estimado".
    expect(textoEbBis(76.4)).toContain("estimada");
    for (const iae of [12.4, -8.2]) expect(textoIae(iae)).toContain("estimado");
  });
});

describe("quien ve que: la frontera es de TIPO, no de plantilla", () => {
  it("lo del paciente son DOS frases y nada mas", () => {
    // Si alguien añade la z de pares, el tope o la alerta a esta salida, la frontera de su §5 se rompe
    // sin que ninguna pantalla cambie. Por eso se cuenta la forma del objeto, no el texto.
    const paraTodos = ebBisParaTodos(76.4, 12.4);
    expect(Object.keys(paraTodos ?? {}).sort()).toEqual(["eb", "iae"]);
  });

  it("y sin cifras no se devuelve un objeto a medias", () => {
    // Una EB sin IAE (o al reves) no deberia pasar, y si pasa no se pinta media frase: el profesional ve
    // el estado con su motivo, que es la salida que su §5 preve para eso.
    expect(ebBisParaTodos(null, 12.4)).toBeNull();
    expect(ebBisParaTodos(76.4, null)).toBeNull();
    expect(ebBisParaTodos(null, null)).toBeNull();
  });

  it("lo del profesional trae la z, el tope y la alerta, cada uno solo cuando aplica", () => {
    const limpio = ebBisParaElProfesional(ok());
    expect(limpio.pendiente).toBeNull();
    expect(limpio.zPares).toBe("z de pares: 2,48");
    expect(limpio.tope, "se pinta el tope sin haberse topado").toBeNull();
    expect(limpio.alerta, "se pinta la alerta sin haberse activado").toBeNull();

    expect(ebBisParaElProfesional(ok({ topado: true })).tope).toBe(
      "Valor limitado al máximo del indicador",
    );
    expect(ebBisParaElProfesional(ok({ alertaDiscordancia: true })).alerta).toContain(
      "verificar hábitos o cambio reciente",
    );
  });

  it("el estado no calculable usa SU formula de texto, con el motivo de la funcion", () => {
    // Su tabla 3: "'EB-BIS pendiente: ' mas el motivo devuelto por la funcion". El motivo no se reescribe
    // porque es lo que dice QUE capturar: "edad no válida" y "dato faltante: ACT" llevan a sitios
    // distintos.
    const r = ebBisParaElProfesional(ok({ estado: "pendiente", motivo: "edad no válida", zPares: null }));
    expect(r.pendiente).toBe("EB-BIS pendiente: edad no válida");
    expect(r.zPares, "se pinta la z de un resultado que no se calculo").toBeNull();
    expect(r.tope).toBeNull();
    expect(r.alerta).toBeNull();
  });

  it("y 'revisar' tambien llega al profesional, no se traga como si no hubiera pasado nada", () => {
    const r = ebBisParaElProfesional(
      ok({ estado: "revisar", motivo: "masa seca sin grasa fuera de rango fisiológico" }),
    );
    expect(r.pendiente).toContain("masa seca sin grasa");
  });
});

describe("la nota del DFI reemplaza a la leyenda vieja", () => {
  it("es su texto, literal", () => {
    expect(NOTA_DFI_SIN_ENCUESTA).toBe("Diagnóstico integrado pendiente de la encuesta");
  });

  it("y la leyenda vieja NO sobrevive en el codigo", () => {
    // Su §2: *"Desaparece la leyenda 'EB-BIS pendiente: requiere encuesta'"*. Afirmaba que faltaba la
    // EDAD BIOLOGICA; ahora lo que falta es el DIAGNOSTICO INTEGRADO, y son dos cosas distintas. Si la
    // frase vieja sigue en alguna pantalla, le dice al profesional que espere algo que ya tiene.
    // SE MIRA EL CODIGO SIN COMENTARIOS: la frase aparece a proposito en los comentarios que explican su
    // retirada, y un candado que no distingue las dos cosas obliga a borrar la explicacion para pasar.
    const fuentes = [
      "src/clinical-engine/presentacion-eb-bis.ts",
      "src/modules/diagnoses/components/evaluation-results.tsx",
    ];
    for (const f of fuentes) {
      expect(sinComentarios(readFileSync(f, "utf8")), `${f} todavia usa la leyenda vieja`).not.toContain(
        "requiere encuesta",
      );
    }
  });
});
