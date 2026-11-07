import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  EDAD_MAXIMA_EB_BIS,
  EDAD_MINIMA_EB_BIS,
  motivoParaNoReemitir,
} from "@/modules/clinical-pipeline/motivo-para-no-reemitir";

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
const PUERTA = readFileSync("src/modules/clinical-pipeline/motivo-para-no-reemitir.ts", "utf8");
const SIMULACION = readFileSync("src/tests/simulacion-del-recalculo-db.test.ts", "utf8");

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
    expect(PUERTA).toContain("edadSiSePuede(");
  });

  it("y los DOS cortes son los del FROZEN de la v7, no numeros de la pantalla", () => {
    const motor = readFileSync("src/clinical-engine/frozen/eb-bis-v7.js", "utf8");
    expect(motor, "el frozen cambio su rango de edad").toContain("edad < 18 || edad > 100");
    expect(EDAD_MINIMA_EB_BIS).toBe(18);
    expect(EDAD_MAXIMA_EB_BIS).toBe(100);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  // LOS DOS CORTES, Y EL DE ARRIBA FALTABA  ·  2026-11-07
  //
  // Salio de la simulacion del recalculo contra la nube: cinco consultas pierden el dominio 3 al
  // recomputar, todas con "edad no valida", y NINGUNA esta entre las que el motor no puede correr (su
  // fecha si se lee). O sea que su edad al medirse cae fuera de 18 a 100.
  //
  // La puerta excluia solo a los menores, asi que una consulta de mas de 100 anos se habria OFRECIDO para
  // reemitir y habria vuelto con la EB-BIS en "pendiente" y el dominio 3 en blanco. No es un caso teorico
  // sobre una tabla: es lo que la pantalla iba a dejar hacer.
  // ══════════════════════════════════════════════════════════════════════════════════════════════════
  describe("y la puerta excluye por los DOS lados, no solo a los menores", () => {
    // Una fecha fija y una toma fija, para que la edad no dependa del dia en que corra la prueba.
    const alMedirse = (nacimiento: string) =>
      motivoParaNoReemitir({ huellaRepetida: false, nacimiento, hasta: new Date("2026-06-15") });

    it("un menor de 18 no entra, y lo dice con su edad", () => {
      expect(alMedirse("2009-01-01")).toContain("Tenía 17 años");
    });

    it("mayor de 100 TAMPOCO entra, que es lo que faltaba", () => {
      expect(alMedirse("1920-01-01")).toContain("Tenía 106 años");
    });

    it("y los dos bordes exactos SI entran: el rango de la v7 es cerrado", () => {
      expect(alMedirse("2008-01-01"), "18 cumplidos tiene que entrar").toBeNull();
      expect(alMedirse("1926-01-01"), "100 cumplidos tiene que entrar").toBeNull();
    });

    it("sin fecha legible, el motivo nombra la fecha y no la edad", () => {
      expect(alMedirse("")).toContain("Sin fecha de nacimiento legible");
      expect(
        motivoParaNoReemitir({ huellaRepetida: false, nacimiento: null, hasta: new Date() }),
      ).toContain("Sin fecha de nacimiento legible");
    });

    it("la huella repetida se nombra PRIMERO, porque es lo unico que se puede resolver", () => {
      expect(
        motivoParaNoReemitir({ huellaRepetida: true, nacimiento: "2009-01-01", hasta: new Date() }),
      ).toContain("repetida en otra consulta");
    });
  });

  it("se lee POR PAGINAS, porque PostgREST corta en mil sin decirlo y ya mordio", () => {
    // ERA `.limit(2000)`, Y PASO EN PRODUCCION EL 7 DE NOVIEMBRE. Mientras hubo una fila de diagnostico
    // por consulta cabia; el recalculo inserto 424 filas, el total paso de mil y, como el orden es
    // `created_at desc`, se cayeron por el borde las MAS VIEJAS: los 67 diagnosticos de 1.0.0 y los 3 de
    // anibise-1.4.0, que son justo los que quedan por reemitir. La pantalla dijo "Total desfasadas: 14"
    // cuando eran 71. Sin error, sin hueco visible, y con una cifra creible.
    const codigo = sinComentarios(LECTOR);
    expect(codigo).toContain(".range(desde, desde + TAMANO - 1)");
    expect(codigo, "volvio el limit que PostgREST ignora en silencio").not.toContain("limit(2000)");
    // El orden va EN la consulta y no despues: paginar sin `order by` no define que trae cada pagina.
    expect(codigo).toContain('.order("created_at", { ascending: false })');
    // Y la pagina corta es la condicion de parada: con `===` en vez de `<` un conteo exacto la colgaria.
    expect(codigo).toContain("< TAMANO) break;");
  });

  it("y la pantalla ofrece EXACTAMENTE lo que el guard de la reemision acepta", () => {
    // ERAN DOS PUERTAS, Y YA HABIAN DIVERGIDO (2026-11-07). La pantalla filtraba por MAYOR distinto y
    // `reemitirDiagnostico` decide con `vigenciaEmision` (la cadena entera del motor mas las claves de
    // emision). En la nube hay una consulta sellada con 3.1.0 teniendo 3.2.0 vigente: mismo mayor, asi que
    // la pantalla NO la ofrecia, y su aviso de "emitido con una version anterior" no se podia quitar nunca.
    const codigo = sinComentarios(LECTOR);
    expect(codigo).toContain("vigenciaEmision(");
    expect(codigo).toContain("!e.vigencia.alDia");
    expect(codigo, "la pantalla volvio a filtrar por el mayor").not.toContain("mayor(e.selladaCon)");
    // Y el guard sigue decidiendo con la misma funcion, no con una copia.
    const servicio = readFileSync(
      "src/modules/clinical-pipeline/services/reemitir-diagnostico.ts",
      "utf8",
    );
    expect(servicio).toContain("vigenciaEmision(");
    // La simulacion tambien, para que su cifra cuadre con lo que la pantalla lista.
    expect(SIMULACION).toContain("vigenciaEmision(");
  });

  it("UNA SOLA PUERTA: la pantalla y la simulacion llaman a la MISMA funcion", () => {
    // Era el defecto que ya aparecio con la guarda de "sin dominio 3" del freno: escrita dos veces, y las
    // dos copias ya discrepaban. Aqui la consecuencia seria que la simulacion midiera un conjunto y la
    // pantalla ofreciera otro, justo en la cifra que autoriza la ejecucion.
    expect(LECTOR).toContain("motivoParaNoReemitir");
    expect(SIMULACION, "la simulacion dejo de usar la puerta de la pantalla").toContain(
      "motivoParaNoReemitir",
    );
    expect(
      sinComentarios(LECTOR),
      "el lector volvio a escribir el corte de edad en vez de leerlo de la puerta",
    ).not.toContain("EDAD_MINIMA_EB_BIS =");
  });


  it("la edad se mide A LA FECHA DE LA TOMA, no a hoy", () => {
    // Un paciente que se midio con 17 y hoy tiene 19 no entra: la EB-BIS se calcula sobre la medicion.
    // Medir a hoy lo metería al recalculo y el motor lo rechazaría dentro.
    expect(LECTOR).toContain("measurement_date");
    expect(sinComentarios(LECTOR)).toContain("fechaDeLaToma");
  });
});

describe("(4) la correccion se cierra, se limpia y lleva a la version nueva", () => {
  const COMP = readFileSync("src/modules/corrections/components/reemplazar-la-medicion-bis.tsx", "utf8");
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
