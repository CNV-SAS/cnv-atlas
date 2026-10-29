import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DE LA PANTALLA DE RECALIBRACION Y DEL CIERRE DE LA CORRECCION (Santiago, 2026-10-29)
//
//   (3) la pantalla decia "392 desfasadas" y el reporte "entran 360": las dos cifras eran correctas y
//       contestaban preguntas distintas, pero la pantalla no decia cual. Ahora se parte en tres grupos
//       que SUMAN, y las que no se pueden reemitir llevan su motivo y no se pueden seleccionar.
//   (4) la correccion de "la medicion no es de este paciente" funcionaba y dejaba el formulario abierto,
//       el motivo escrito y la pantalla en la version vieja.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PANEL = readFileSync("src/app/(app)/admin/recalibracion/panel-de-recalibracion.tsx", "utf8");
const LECTOR = readFileSync("src/modules/clinical-pipeline/data/desfasadas-reader.ts", "utf8");

describe("(3) la pantalla de recalibracion separa lo que no se puede reemitir", () => {
  it("los tres grupos salen del MISMO total, asi que la suma cuadra", () => {
    const codigo = sinComentarios(PANEL);
    expect(codigo).toContain("d.motivoSinReemitir == null");
    expect(codigo).toContain("d.motivoSinReemitir != null");
    expect(codigo).toContain("d.esDePrueba");
    // Y el total se enseña: es lo que permite cotejar contra el reporte previo sin contar filas a mano.
    expect(PANEL).toContain("Total desfasadas:");
  });

  it("y solo se puede SELECCIONAR lo que entra", () => {
    // EL DEFECTO QUE EVITA: si el boton de "elegir las primeras" tomara de `reales` en vez de `entran`,
    // la tanda incluiria filas que la action va a rechazar, y el informe saldria lleno de fallos que
    // nadie pidio.
    const codigo = sinComentarios(PANEL);
    expect(codigo).toContain("entran.slice(0, TOPE_POR_TANDA)");
    expect(codigo, "el panel volvio a ofrecer todas las reales").not.toContain(
      "reales.slice(0, TOPE_POR_TANDA)",
    );
  });

  it("las excluidas se ven con su motivo y SIN casilla, no con una casilla gris", () => {
    // Una casilla deshabilitada invita a buscar como habilitarla, y aqui no hay nada que habilitar. El
    // motivo va en la fila, no en una leyenda al pie.
    expect(PANEL).toContain("{d.motivoSinReemitir}");
    expect(PANEL).toContain("no se pueden reemitir");
  });

  it("y las de prueba quedan plegadas, contadas, no escondidas", () => {
    // Capa 3 de la regla del paciente de prueba: esconderlas descuadraria la cuenta contra la base.
    expect(PANEL).toContain("de pacientes de prueba (no se reemiten)");
    expect(PANEL).toContain("dePrueba.map");
  });
});

describe("(3 bis) los motivos salen de donde ya viven, no de una copia", () => {
  it("la huella repetida, del MISMO conjunto que el aviso del profesional", () => {
    // Es el conjunto que cuadra pieza por pieza con el anexo A de Gildardo. Una segunda definicion de
    // "huella repetida" acabaria excluyendo de la recalibracion filas que el aviso no marca, o al revés.
    expect(LECTOR).toContain("huellasRepetidasEnVigentes");
  });

  it("la edad, de la MISMA lectura de la fecha que el motor y el consentimiento", () => {
    // `edadSiSePuede` devuelve null ante una fecha ausente, ilegible o imposible, que es justo la
    // distincion que hace falta aqui. Una lectura propia volveria a convertir una fecha mala en edad cero.
    expect(LECTOR).toContain("edadSiSePuede(");
  });

  it("y el corte de 18 anos es el del FROZEN de la v7, no un numero de la pantalla", () => {
    const motor = readFileSync("src/clinical-engine/frozen/eb-bis-v7.js", "utf8");
    expect(motor, "el frozen cambio su rango de edad").toContain("edad < 18 || edad > 100");
    expect(LECTOR).toContain("EDAD_MINIMA_EB_BIS = 18");
  });

  it("la edad se mide A LA FECHA DE LA TOMA, no a hoy", () => {
    // Un paciente que se midio con 17 y hoy tiene 19 no entra: la EB-BIS se calcula sobre la medicion.
    // Medir a hoy lo metería al recalculo y el motor lo rechazaría dentro.
    expect(LECTOR).toContain("measurement_date");
    expect(sinComentarios(LECTOR)).toContain("fechaDeLaToma");
  });
});

describe("(4) la correccion se cierra, se limpia y lleva a la version nueva", () => {
  const COMP = readFileSync("src/modules/corrections/components/medicion-de-otro-paciente.tsx", "utf8");
  const ACTION = readFileSync("src/modules/corrections/actions.ts", "utf8");

  it("la action DEVUELVE el id de la version nueva, que el servicio ya daba", () => {
    // ERA LA CAUSA DE LAS TRES COSAS: sin el id, la pantalla no tenia a donde ir, asi que refrescaba, y
    // refrescar muestra la version REEMPLAZADA. No era que el refresco fallara: refrescar no podia
    // llevar a donde habia que llegar.
    expect(ACTION).toContain("nuevaEvaluacionId: result.value.newEvaluationId");
  });

  it("y lo que se ve se DERIVA de que la correccion ocurrio, no se apaga a mano", () => {
    // Derivarlo es lo que hace imposible el desfase, y ademas es lo que deja el cierre y el vaciado en
    // pie aunque la navegacion no ocurra (un fallo de red no llega al catch del servidor).
    const codigo = sinComentarios(COMP);
    expect(codigo).toContain("const yaSeCorrigio = state.nuevaEvaluacionId != null");
    expect(codigo).toContain("abiertoPorElUsuario && !yaSeCorrigio");
    expect(codigo).toContain('yaSeCorrigio ? "" : motivoEscrito');
    expect(codigo).toContain("yaSeCorrigio ? false : confirmadoPorElUsuario");
  });

  it("y navega a la version nueva, que es lo unico que no se puede derivar", () => {
    const codigo = sinComentarios(COMP);
    expect(codigo).toContain("router.replace(");
    // Depende SOLO del id: si dependiera del estado entero, volveria a navegar en cada cambio.
    expect(codigo).toContain("[state.nuevaEvaluacionId, router]");
  });

  it("y NO refresca ademas de navegar: dos montajes son dos saltos al inicio", () => {
    // `useFormToastAndRefresh` haria `router.refresh()` sobre una ruta que estamos abandonando.
    expect(COMP, "volvio el refresco junto a la navegacion").not.toContain("useFormToastAndRefresh");
    expect(COMP).toContain("useFormToast(state)");
  });

  it("CONTROL: la action sigue sin revalidar, para no montar los segmentos dos veces", () => {
    // Es el candado de `refresco-una-sola-vez`, repetido aqui porque este cambio toca justo ese par.
    // SIN COMENTARIOS, que es la leccion de siempre: el comentario que explica por que NO se revalida
    // tiene que poder nombrar `revalidatePath`, y si el candado lee el archivo crudo se caza a si mismo.
    const sinComs = sinComentarios(ACTION);
    const trozo = sinComs.slice(sinComs.indexOf("medicionDeOtroPacienteAction"));
    expect(trozo, "la action volvio a revalidar").not.toContain("revalidatePath");
  });
});
