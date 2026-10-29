import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

import {
  huellaDeLosHallazgos,
  identidadesVioladas,
  type InsumosQcBiologico,
} from "@/clinical-engine/qc-biologico";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DEL CONTROL DE CALIDAD BIOLOGICO
//
// SU PROPIA LISTA DE PRUEBAS (v12, tabla de verificacion): *"14 comprobaciones sobre el motor real:
// paciente sano sin hallazgos, cada identidad violada una por una, cada rango, y que el cero no cuente
// como hallazgo."* Los rangos no se prueban porque no se construyeron: estan esperando que los firme.
//
// CADA IDENTIDAD SE VIOLA UNA POR UNA, Y SOBRE UN CUERPO POR LO DEMAS SANO. Es lo que distingue un
// candado de un humo: si se violaran dos a la vez, un hallazgo podria estar tapando al otro y la prueba
// pasaria igual.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// UN CUERPO QUE CUADRA, con las cifras de una medicion real (no inventadas a ojo): las sumas cierran, el
// centro del circulo cae en el punto medio y la impedancia baja con la frecuencia.
const SANO: InsumosQcBiologico = {
  peso: 70,
  Re: 600,
  Ri: 1500,
  Rinf: 340,
  C: 1.8,
  Fo: 35,
  Rc: 470, // (600 + 340) / 2
  Xc: -120,
  Z5: 580,
  Z200: 400,
  FM: 18,
  FM_pct: 25.7,
  FFM: 52, // 18 + 52 = 70
  TBW: 38,
  ECW: 16,
  ICW: 22, // 16 + 22 = 38
  SMM: 28,
  MCA: 24,
};

const codigos = (d: InsumosQcBiologico) => identidadesVioladas(d).map((x) => x.codigo);

describe("un cuerpo que cuadra no tiene hallazgos", () => {
  it("el caso sano sale limpio", () => {
    expect(identidadesVioladas(SANO)).toEqual([]);
  });

  it("y los hallazgos traen texto para leer, no solo un codigo", () => {
    // El profesional lee el panel. Un codigo suelto ("rc_fuera_del_arco") no le dice que mirar.
    for (const hallazgo of identidadesVioladas({ ...SANO, FM: 80 })) {
      expect(hallazgo.texto.length, `${hallazgo.codigo} no trae texto`).toBeGreaterThan(20);
      expect(hallazgo.texto, `${hallazgo.codigo} no termina en punto`).toMatch(/\.$/);
    }
  });
});

describe("cada identidad, violada una por una", () => {
  it("1 · la resistencia extracelular no es mayor que la infinita", () => {
    expect(codigos({ ...SANO, Re: 340, Rc: 340 })).toContain("re_no_mayor_que_rinf");
    // El borde: iguales tambien viola, porque la resistencia BAJA, no se queda.
    expect(codigos({ ...SANO, Re: 340, Rinf: 340, Rc: 340 })).toContain("re_no_mayor_que_rinf");
  });

  it("2 · la reactancia del centro es positiva", () => {
    expect(codigos({ ...SANO, Xc: 120 })).toContain("xc_positiva");
    // Negativa es lo normal, y el CERO no viola: no es positivo.
    expect(codigos({ ...SANO, Xc: -120 })).not.toContain("xc_positiva");
    expect(codigos({ ...SANO, Xc: 0 })).not.toContain("xc_positiva");
  });

  it("3 · el centro del círculo no es el punto medio", () => {
    expect(codigos({ ...SANO, Rc: 700 })).toContain("rc_fuera_del_arco");
  });

  it("3 bis · y la tolerancia deja pasar el redondeo del equipo, que es para lo que existe", () => {
    // Residuo maximo medido en 400 mediciones reales: 0,0820 Ω. La tolerancia es 1 Ω, doce veces el
    // maximo. Si alguien la apretara a 0,05 Ω, empezaria a frenar mediciones que estan bien.
    expect(codigos({ ...SANO, Rc: 470.08 })).not.toContain("rc_fuera_del_arco");
    expect(codigos({ ...SANO, Rc: 470.9 })).not.toContain("rc_fuera_del_arco");
    expect(codigos({ ...SANO, Rc: 472 })).toContain("rc_fuera_del_arco");
  });

  it("4 · la impedancia sube con la frecuencia", () => {
    expect(codigos({ ...SANO, Z200: 700 })).toContain("impedancia_sube_con_la_frecuencia");
  });

  it("5 · un parámetro de Cole en negativo", () => {
    for (const campo of ["Re", "Ri", "Rinf", "C", "Fo", "Rc"] as const) {
      expect(codigos({ ...SANO, [campo]: -1 }), `${campo} negativo no se atrapo`).toContain(
        "cole_negativo",
      );
    }
  });

  it("5 bis · y la reactancia NO entra ahí: negativa es lo normal", () => {
    // Meterla convertiria el caso sano en un hallazgo permanente, y su regla 2 ya dice que lo imposible
    // en la reactancia es lo CONTRARIO.
    expect(codigos({ ...SANO, Xc: -120 })).not.toContain("cole_negativo");
  });

  it("6 · la masa grasa iguala o supera el peso", () => {
    expect(codigos({ ...SANO, FM: 70 })).toContain("grasa_mayor_o_igual_al_peso");
    expect(codigos({ ...SANO, FM: 90 })).toContain("grasa_mayor_o_igual_al_peso");
  });

  it("6 bis · la masa sin grasa supera el peso", () => {
    // Es la que atrapa las DOS mediciones reales de grasa negativa: si la grasa es negativa, la masa sin
    // grasa sale mayor que el peso. Un unico defecto fisico que asoma por dos identidades.
    expect(codigos({ ...SANO, FFM: 85 })).toContain("sin_grasa_mayor_que_el_peso");
  });

  it("7 · grasa y sin grasa no suman el peso", () => {
    expect(codigos({ ...SANO, FFM: 45 })).toContain("grasa_mas_sin_grasa_no_suma_el_peso");
  });

  it("7 bis · y medio kilo de holgura, porque el equipo exporta redondeado", () => {
    // Residuo maximo medido: 0,0000 kg. La tolerancia es 0,5 kg.
    expect(codigos({ ...SANO, FFM: 52.4 })).not.toContain("grasa_mas_sin_grasa_no_suma_el_peso");
    expect(codigos({ ...SANO, FFM: 53 })).toContain("grasa_mas_sin_grasa_no_suma_el_peso");
  });

  it("8 · el agua total iguala o supera la masa sin grasa", () => {
    expect(codigos({ ...SANO, TBW: 52 })).toContain("agua_total_mayor_o_igual_que_sin_grasa");
    expect(codigos({ ...SANO, TBW: 60 })).toContain("agua_total_mayor_o_igual_que_sin_grasa");
  });

  it("9 · extracelular y intracelular no suman el agua total", () => {
    expect(codigos({ ...SANO, ICW: 10 })).toContain("aec_mas_aic_no_suma_el_agua_total");
  });

  it("10 · el músculo o la masa celular activa iguala o supera la masa sin grasa", () => {
    expect(codigos({ ...SANO, SMM: 52 })).toContain("musculo_mayor_o_igual_que_sin_grasa");
    expect(codigos({ ...SANO, MCA: 55 })).toContain("mca_mayor_o_igual_que_sin_grasa");
  });

  it("12 · (la nuestra) la masa grasa o el porcentaje de grasa es negativo", () => {
    // Los dos casos reales: una grasa de -15,6 %. Su lista no lo atrapaba, y no es un rango ancho o
    // estrecho: es un valor que no puede existir.
    expect(codigos({ ...SANO, FM: -2 })).toContain("grasa_negativa");
    expect(codigos({ ...SANO, FM_pct: -15.6 })).toContain("grasa_negativa");
  });
});

describe("el cero y el vacío son SIN DATO, que es su primera regla de diseño", () => {
  it("una consulta sin espectroscopía no tiene ni un hallazgo", () => {
    // ES LA PRUEBA MAS IMPORTANTE DEL ARCHIVO. *"Un parametro sin capturar llega como 0; si se tratara
    // como valor, toda consulta sin espectroscopia saldria en rojo."* Con las antropometricas puestas y
    // las electricas en cero, el panel tiene que quedarse callado.
    expect(
      identidadesVioladas({
        peso: 70,
        Re: 0,
        Ri: 0,
        Rinf: 0,
        C: 0,
        Fo: 0,
        Rc: 0,
        Xc: 0,
        Z5: 0,
        Z200: 0,
      }),
    ).toEqual([]);
  });

  it("y una medicion vacia del todo tampoco", () => {
    expect(identidadesVioladas({})).toEqual([]);
    expect(identidadesVioladas({ peso: null, FM: undefined, FFM: null })).toEqual([]);
  });

  it("un cero NO dispara las sumas, que es donde mas facil se colaria", () => {
    // Con FFM en cero, "grasa + sin grasa no suma el peso" daria 18 + 0 != 70 y saldria en rojo: ese es
    // el camino por el que el cero se cuela como valor.
    expect(codigos({ ...SANO, FFM: 0 })).not.toContain("grasa_mas_sin_grasa_no_suma_el_peso");
    expect(codigos({ ...SANO, ICW: 0 })).not.toContain("aec_mas_aic_no_suma_el_agua_total");
    expect(codigos({ ...SANO, Rc: 0 })).not.toContain("rc_fuera_del_arco");
  });

  it("pero un NEGATIVO no se esconde tras la regla del cero", () => {
    // La regla del cero no puede volverse un agujero: `-2` no es cero ni falta, es imposible.
    expect(codigos({ ...SANO, FM: -2 })).toContain("grasa_negativa");
    expect(codigos({ ...SANO, C: -1 })).toContain("cole_negativo");
  });

  it("y un NaN se trata como falta, no como valor", () => {
    expect(codigos({ ...SANO, FFM: Number.NaN })).not.toContain(
      "grasa_mas_sin_grasa_no_suma_el_peso",
    );
  });
});

describe("la huella de los hallazgos decide si se vuelve a preguntar", () => {
  it("el mismo conjunto da la misma huella, en cualquier orden", () => {
    // Si la huella dependiera del orden, el mismo hallazgo pediria el visto bueno otra vez al reabrir.
    const a = huellaDeLosHallazgos([
      { codigo: "b", texto: "." },
      { codigo: "a", texto: "." },
    ]);
    const b = huellaDeLosHallazgos([
      { codigo: "a", texto: "." },
      { codigo: "b", texto: "." },
    ]);
    expect(a).toBe(b);
  });

  it("y un hallazgo DISTINTO da otra huella: se pide de nuevo", () => {
    // Su regla, literal: *"si despues cambia un dato y aparece un hallazgo distinto, se pide de nuevo"*.
    // Con una bandera de "ya lo vi" a secas, cambiar el Excel por otro igual de imposible pasaria sin
    // preguntar, y el visto bueno cubriria algo que nadie vio.
    const antes = huellaDeLosHallazgos(identidadesVioladas({ ...SANO, FM: -2 }));
    const despues = huellaDeLosHallazgos(identidadesVioladas({ ...SANO, Z200: 700 }));
    expect(antes).not.toBe(despues);
  });

  it("sin hallazgos la huella es vacía", () => {
    expect(huellaDeLosHallazgos([])).toBe("");
  });
});

describe("los rangos NO estan construidos, y es deliberado", () => {
  it("no existe ninguna tabla de limites en el modulo", () => {
    // *"Los numeros de QC_BIO_LIMITES no estan aprobados... Las identidades de la lista «imposible» SI
    // son definitivas."* Escribirlos ahora seria poner nueve cifras nuestras a decidir sobre mediciones
    // reales, que es exactamente el defecto del SANITY que dejo sin diagnostico a una paciente con una
    // capacitancia de 16,22 nF.
    //
    // ESTE CANDADO SE QUITA EL DIA QUE LOS FIRME, y no antes.
    // SIN COMENTARIOS: el bloque que explica POR QUE los rangos no estan tiene que poder nombrarlos,
    // y si el candado lee el archivo crudo se caza a si mismo. Es la sexta vez, y para eso existe el helper.
    const fuente = sinComentarios(readFileSync("src/clinical-engine/qc-biologico.ts", "utf8"));
    for (const prohibido of ["QC_BIO_LIMITES", "LIMITES", "rangoDe", "fueraDeRango"]) {
      expect(fuente, `aparecio ${prohibido}: los rangos esperan a Gildardo`).not.toContain(prohibido);
    }
  });
});

describe("el panel esta CABLEADO, y el freno vive donde no se puede saltar", () => {
  const PAGINA = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
  const ENTRADA = readFileSync("src/modules/evaluations/components/entrada-evaluacion.tsx", "utf8");
  const PIPELINE = sinComentarios(
    readFileSync("src/modules/clinical-pipeline/services/run-pipeline.ts", "utf8"),
  );

  it("la pagina lo lee y se lo pasa a la pestaña", () => {
    // La leccion de "portar: verificar que la pieza SE RENDERICE, no que exista": este proyecto ya dejo
    // tres piezas escritas y no renderizadas.
    expect(PAGINA).toContain("qcBiologicoDeLaConsulta(id)");
    expect(PAGINA).toContain("panelDeCalidadBiologica: <PanelDeCalidadBiologica");
  });

  it("y se pinta LO PRIMERO de Antrop. & BIS, antes de los dos avisos de a quien pertenece", () => {
    // El orden es el argumento: los otros dos preguntan DE QUIEN es la toma; este pregunta si la toma
    // puede existir, y si no puede, de quien sea da igual.
    const qc = ENTRADA.indexOf("{composition ? panelDeCalidadBiologica : null}");
    const correccion = ENTRADA.indexOf("{composition ? correccionDeLaMedicion : null}");
    const edad = ENTRADA.indexOf("{composition ? avisoDeEdadDelEquipo : null}");
    expect(qc, "el panel del QC no se renderiza").toBeGreaterThan(-1);
    expect(qc).toBeLessThan(correccion);
    expect(correccion).toBeLessThan(edad);
  });

  it("el freno esta en el PIPELINE, no en una pestaña", () => {
    // Su diseño dice "la navegacion no deja salir de Antropometria". En Atlas el diagnostico se genera al
    // ENTRAR a su pestaña (se quito el boton de generar), asi que un candado de navegacion seria saltable
    // escribiendo la URL. Aqui no.
    expect(PIPELINE).toContain("qcBiologicoDeLaConsulta(input.evaluationId)");
    expect(PIPELINE).toContain("qc.hallazgos.length > 0 && !qc.visto");
  });

  it("y usa el MISMO lector que pinta el panel, no una segunda comprobacion", () => {
    // Si el gate midiera por su cuenta, la pantalla podria decir que todo esta bien y el servidor negarse:
    // es el hazard 4, dos partes diciendo cosas opuestas porque leen fuentes distintas.
    const panel = readFileSync("src/modules/bis/components/panel-de-calidad-biologica.tsx", "utf8");
    expect(panel).toContain("qc.hallazgos");
    expect(panel, "el panel recalcula por su cuenta").not.toContain("identidadesVioladas");
  });

  it("el freno trae su SALIDA, porque un freno sin salida detiene a una persona", () => {
    const actions = readFileSync("src/modules/clinical-pipeline/actions.ts", "utf8");
    expect(PIPELINE).toContain('{ qcBiologico: "1" }');
    expect(actions).toContain("result.error.fields?.qcBiologico");
    expect(actions).toContain("Ir a Antropometría y BIS a revisar la medición");
  });

  it("y el visto bueno queda registrado con quien, cuando y DE QUE", () => {
    const writer = sinComentarios(readFileSync("src/modules/bis/data/visto-bueno-del-qc.ts", "utf8"));
    expect(writer).toContain("recordAudit(tx, {");
    expect(writer).toContain('event: "qc_biologico.visto"');
    // Los TEXTOS, no solo los codigos: dentro de un año `grasa_negativa` no dice que vio esa persona.
    expect(writer).toContain("hallazgos: input.textos");
    expect(writer).toContain("qcBioVistoPor: input.actorId");
  });

  it("la huella se recomputa EN EL SERVIDOR, no se recibe del formulario", () => {
    // Si la pantalla mandara la huella de lo que vio, un formulario viejo daria el visto bueno a unos
    // hallazgos que ya no son los de ahora, y quedaria registrado que alguien se hizo cargo de algo que
    // nunca estuvo delante.
    const action = sinComentarios(readFileSync("src/modules/bis/qc-biologico-actions.ts", "utf8"));
    expect(action).toContain("qcBiologicoDeLaConsulta(evaluationId)");
    expect(action).toContain("huella: qc.huella");
    expect(action, "la action recibe la huella del formulario").not.toContain('form.get("huella")');
  });
});
