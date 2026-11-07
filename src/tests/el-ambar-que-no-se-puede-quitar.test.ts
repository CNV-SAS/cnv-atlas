import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  EDAD_MAXIMA_EB_BIS,
  EDAD_MINIMA_EB_BIS,
  motivoDeNoReemitir,
  motivoParaNoReemitir,
} from "@/modules/clinical-pipeline/motivo-para-no-reemitir";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL AMBAR QUE PEDIA UNA ACCION QUE NO EXISTE  ·  2026-11-07
//
// ═══ EL DEFECTO, MEDIDO ═══
//
// Al terminar el recalculo quedaron 53 avisos ambar de "reemisión obligatoria": 30 de pacientes de prueba,
// 19 de medicion repetida y 4 de menores de edad. El ambar le dice a la profesional que el documento DEBE
// reemitirse; la pantalla de recalibracion no ofrece ninguna de las tres, y en los 4 de la edad no la va a
// ofrecer NUNCA: la EB-BIS v7 se calibro entre los 18 y los 100, y fuera de ese rango devuelve
// "pendiente", asi que reemitir dejaria el dominio 3 en blanco.
//
// Un freno sin salida no es un guard: detiene a una persona. Y encima entrena a ignorar el ambar, que es
// lo que lo vuelve inutil el dia que si hay algo que hacer.
//
// ═══ LO QUE SE AMARRA AQUI ═══
//
// Que los tres motivos se distingan (una sola puerta, con clase), que el de la edad salga en registro
// NEUTRO y sin pedir nada, y que los dos que SI tienen salida la nombren. El texto del de la edad lo fijo
// Santiago, asi que va literal.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const AVISO = readFileSync("src/modules/clinical-pipeline/components/aviso-ciencia-anterior.tsx", "utf8");
const PAGINA = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
const RESULTS = sinComentarios(
  readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
);

const EN_LA_TOMA = new Date("2026-06-15T00:00:00Z");

describe("la puerta distingue los tres motivos, y sigue siendo UNA", () => {
  it("la huella repetida va primero: es lo unico que hay que RESOLVER", () => {
    // Una fila puede tener las dos cosas (huella repetida Y 15 años). La que hay que mirar es la primera,
    // porque un dato posiblemente del paciente equivocado se resuelve antes que cualquier otra cosa.
    const m = motivoDeNoReemitir({ huellaRepetida: true, nacimiento: "2011-01-01", hasta: EN_LA_TOMA });
    expect(m?.clase).toBe("huella-repetida");
  });

  it("sin fecha legible es su propia clase, porque su salida es distinta", () => {
    expect(
      motivoDeNoReemitir({ huellaRepetida: false, nacimiento: null, hasta: EN_LA_TOMA })?.clase,
    ).toBe("sin-fecha");
  });

  it("fuera del rango de la v7 trae la EDAD, que es lo que el aviso tiene que poder decir", () => {
    const menor = motivoDeNoReemitir({
      huellaRepetida: false,
      nacimiento: "2011-01-01",
      hasta: EN_LA_TOMA,
    });
    expect(menor).toMatchObject({ clase: "fuera-de-calibracion", edad: 15 });
    // Y POR LOS DOS LADOS: el corte de arriba faltaba hasta el 2026-11-07, y sin el una consulta de mas
    // de 100 años se habria ofrecido para reemitir y habria vuelto con la EB-BIS en "pendiente".
    const anciano = motivoDeNoReemitir({
      huellaRepetida: false,
      nacimiento: "1920-01-01",
      hasta: EN_LA_TOMA,
    });
    expect(anciano?.clase).toBe("fuera-de-calibracion");
    // LOS BORDES SON INCLUSIVES, leidos del frozen: 18 y 100 SI entran.
    const borde = (edad: number) =>
      motivoDeNoReemitir({
        huellaRepetida: false,
        nacimiento: `${EN_LA_TOMA.getUTCFullYear() - edad}-01-01`,
        hasta: EN_LA_TOMA,
      });
    expect(borde(EDAD_MINIMA_EB_BIS)).toBeNull();
    expect(borde(EDAD_MAXIMA_EB_BIS)).toBeNull();
  });

  it("y el texto SE DERIVA de la clase: una sola redaccion para las tres lecturas", () => {
    // La pantalla de recalibracion y la simulacion siguen pidiendo la frase. Si se escribiera aparte, el
    // aviso de la consulta y el desglose del panel podrian decir cosas distintas del mismo hecho.
    const a = { huellaRepetida: false, nacimiento: "2011-01-01", hasta: EN_LA_TOMA };
    expect(motivoParaNoReemitir(a)).toBe(motivoDeNoReemitir(a)!.texto);
    expect(motivoParaNoReemitir({ ...a, nacimiento: "1990-01-01" })).toBeNull();
  });
});

describe("y el aviso deja de pedir lo imposible", () => {
  it("el de la edad lleva el texto que fijo Santiago, palabra por palabra", () => {
    expect(AVISO).toContain(
      "Fuera del rango de calibración de la EB-BIS (18 a 100 años): no se recalcula",
    );
  });

  it("en registro NEUTRO y VA ANTES del ambar, aunque la clasificacion haya cambiado", () => {
    const i = AVISO.indexOf('motivoDeNoRecalcular?.clase === "fuera-de-calibracion"');
    const j = AVISO.indexOf('veredicto?.kind === "reemision-obligatoria"');
    expect(i, "la rama de la edad no esta").toBeGreaterThan(-1);
    expect(i, "el ambar gana y vuelve a pedir una reemision imposible").toBeLessThan(j);
    // El bloque de la edad usa el fondo tenue y el icono de historia, no el de atencion: no hay nada mal.
    const bloque = AVISO.slice(i, j);
    expect(bloque).toContain("bg-muted/40");
    expect(bloque).not.toContain("border-attention");
    expect(bloque).not.toContain("RefreshCw");
  });

  it("y NO pide ninguna accion: lo dice explicito", () => {
    expect(AVISO).toContain("No hay nada que hacer con esta nota.");
  });

  it("la huella repetida SI mantiene el ambar, y nombra su salida con enlace a la pestaña", () => {
    expect(AVISO).toContain('motivoDeNoRecalcular?.clase === "huella-repetida"');
    expect(AVISO).toContain('href="?etapa=antro"');
    // EL ROTULO DE LA PESTAÑA SE DERIVA del mapa de etapas: un aviso que nombra una pestaña a mano
    // sobrevive a que se renombre o se parta, y eso ya paso una vez ("la pestaña Evaluación").
    expect(AVISO).toContain('etiquetaDeEtapa("antro")');
    expect(AVISO).not.toContain("la pestaña Antrop");
  });

  it("y la de sin fecha nombra la suya, que es otra", () => {
    expect(AVISO).toContain('motivoDeNoRecalcular?.clase === "sin-fecha"');
    expect(AVISO).toContain("Regístrala en la ficha del paciente");
  });
});

describe("y el motivo LLEGA hasta el aviso: un dato que nadie pasa no cambia ninguna pantalla", () => {
  it("la pagina lo lee con la huella que ya habia leido, y solo si hay desfase", () => {
    // Sin el `!results.vigencia.alDia` se pagaria la lectura en cada apertura de cada consulta; sin
    // reusar `medicionRepetida` se leerian DOS veces todas las huellas vigentes en la pantalla mas
    // visitada del sistema.
    expect(PAGINA).toContain("motivoDeNoRecalcularLaConsulta({");
    expect(PAGINA).toContain("huellaRepetida: medicionRepetida != null");
    expect(PAGINA).toContain("results && !results.vigencia.alDia");
    // Y con catch, como los otros tres avisos de esa pagina.
    expect(PAGINA).toContain('reportServerError("evaluacion.motivo-de-no-recalcular", e)');
  });

  it("y la vista lo pasa al aviso", () => {
    expect(PAGINA).toContain("motivoDeNoRecalcular={motivoDeNoRecalcular}");
    expect(RESULTS).toContain("motivoDeNoRecalcular={motivoDeNoRecalcular}");
  });
});
