import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  type EstadoConsulta,
  imposiblesDeLaConsulta,
  pendientesDeLaConsulta,
} from "@/modules/reports/data/cierre-pendientes";

// CANDADO DEL CIERRE DE LA CONSULTA (2026-08-24). Lo que se blinda son las TRES categorias, porque una
// lista que mezcla lo accionable con lo que no se puede hacer todavia obliga al profesional a averiguar
// cual es cual, y entonces no la lee. Y el TONO: la lista informa, no reprocha.

const completa: EstadoConsulta = {
  encuestaCompleta: true,
  protocoloComputado: true,
  protocoloEmitido: true,
  reporteEstado: "sent",
  // EL "SI" YA NO SE DECLARA (rediseño del 2026-09-26): la pregunta de tres opciones se retiro. Y desde el
  // 2026-11-16 lo que cierra el pendiente tampoco es la VENTA: es la PRESCRIPCION. Se dejan la decision y
  // la via del "no" vacias a proposito, para que el fixture "completa" pruebe que la prescripcion sola lo
  // cierra.
  nutraceuticosDecision: null,
  sinPrescripcion: false,
  // CON PRESCRIPCION, que es el caso de la consulta completa: hay dos, y con eso basta.
  nutraceuticosPrescritos: 2,
  // Sin productos externos en el caso base: su efecto se prueba en su propio caso (LUVIA).
  productosDeTerceroPrescritos: 0,
  proximaCita: "2026-11-22",
  remisionesSinRetorno: 0,
};
const con = (o: Partial<EstadoConsulta>) => pendientesDeLaConsulta({ ...completa, ...o });
const ids = (o: Partial<EstadoConsulta>) => con(o).map((p) => p.id);

describe("pendientes del cierre", () => {
  it("una consulta completa no deja nada pendiente", () => {
    expect(pendientesDeLaConsulta(completa)).toEqual([]);
  });

  it("ACCIONABLE: va en la lista con su etapa para ir a resolverlo", () => {
    // EL EJEMPLO CAMBIO, NO LA CATEGORIA (2026-09-10). Era "el diagnóstico no se confirmó", y ese
    // pendiente se retiro con el acto de confirmar: apuntaba a un boton que ya no existe. La categoria que
    // este caso protege (accionable = va en la lista, con su etapa, sin nada que lo bloquee) se afirma
    // ahora sobre el pendiente de la encuesta, que es accionable por la misma razon.
    const p = con({ encuestaCompleta: false }).find((x) => x.id === "encuesta");
    expect(p?.etapa).toBe("evaluacion");
    expect(p?.bloqueadoPor).toBeNull();
  });

  // ═══ EL PENDIENTE DEL PLAN SE RETIRO (Santiago, smoke del 2026-10-04) ═══
  //
  // SU RAZON: muchos profesionales entregan su PROPIO plan, con su plantilla. Que Atlas no conste la entrega
  // del suyo no significa que el paciente se fuera sin plan, asi que listarlo era afirmar un hueco que la
  // mayoria de las veces no existe.
  //
  // Y UNA LISTA DE PENDIENTES VIVE DE QUE TODO LO QUE TRAE SEA CIERTO: una linea que sale casi siempre y casi
  // siempre no es nada entrena a cerrar sin leerla, y entonces el dia que aparezca una de verdad (la venta sin
  // despachar, la nota credito) se cierra igual. El costo de un pendiente falso no es el ruido: es que desarma
  // a los demas.
  it("no aparece nunca, ni con el plan sin emitir", () => {
    expect(ids({ protocoloEmitido: false })).not.toContain("protocolo");
    expect(ids({ protocoloEmitido: true })).not.toContain("protocolo");
  });

  it("y los demas pendientes siguen saliendo: el control de que no se borro la lista entera", () => {
    // Sin esto, vaciar  tambien pasaria el caso de arriba.
    expect(ids({ protocoloEmitido: false, proximaCita: null }).length).toBeGreaterThan(0);
  });

  it("NO ACCIONABLE NUNCA: un protocolo que jamás se computó NO aparece", () => {
    // Misma condicion con la que el sistema ya rechaza el acto ("No se puede emitir una prescripción que
    // nunca se computó"). Listarlo seria pedir algo que el propio sistema prohibe, para siempre.
    expect(ids({ protocoloComputado: false, protocoloEmitido: false })).not.toContain("protocolo");
    expect(imposiblesDeLaConsulta({ ...completa, protocoloComputado: false })).toContain("protocolo");
  });

  it("NO ACCIONABLE NUNCA: una evaluación sin reporte tampoco lo pide", () => {
    expect(ids({ reporteEstado: null })).not.toContain("reporte");
  });

  it("la remisión sin retorno se marca como ajena a esta consulta", () => {
    const p = con({ remisionesSinRetorno: 2 }).find((x) => x.id === "remisiones");
    expect(p?.titulo).toContain("2 remisiones");
    expect(p?.bloqueadoPor).toBe("que el paciente vuelva de la remisión");
  });

  it("'pendiente' de nutracéuticos se lee como decisión válida, no como olvido", () => {
    const p = con({ nutraceuticosDecision: "pendiente", nutraceuticosPrescritos: 0 }).find(
      (x) => x.id === "nutraceuticos",
    );
    expect(p?.detalle).toContain("Es una respuesta válida");
  });

  // ═══ LO QUE CIERRA ES LA PRESCRIPCION, NO LA ENTREGA  ·  Santiago, 2026-11-16 ═══
  //
  // SU REGLA, textual: *"el ítem se CIERRA cuando el profesional guardó una prescripción de nutracéuticos
  // (los del modelo u otros distintos), o marcó «No prescribo» con su motivo; queda ABIERTO solo si no hay
  // ninguna de las dos cosas; si el paciente se los lleva o no, es comercial: no frena el cierre"*.
  //
  // POR QUE ES LA CORRECTA: esta lista es de pendientes CLINICOS, y el acto clinico es PRESCRIBIR. Que el
  // paciente compre hoy, la semana que viene o nunca tiene su propio sitio (la venta) y su propia medicion
  // clinica (el S1 de la CNV-S, que pregunta si los tomo). Mientras la entrega fuera la condicion, una
  // consulta bien hecha se quedaba con un pendiente que el profesional no podia resolver desde la consulta,
  // y los pendientes que no se pueden resolver son los que enseñan a no leer la lista.
  it("la PRESCRIPCION sola cierra el pendiente, sin venta y sin declarar nada", () => {
    expect(ids({ nutraceuticosDecision: null, nutraceuticosPrescritos: 2 })).not.toContain("nutraceuticos");
    expect(ids({ nutraceuticosDecision: null, nutraceuticosPrescritos: 1 })).not.toContain("nutraceuticos");
  });

  it("y el 'no' con su motivo tambien lo cierra, sin ninguna prescripcion", () => {
    expect(ids({ nutraceuticosDecision: "no", nutraceuticosPrescritos: 0 })).not.toContain("nutraceuticos");
    expect(ids({ sinPrescripcion: true, nutraceuticosPrescritos: 0 })).not.toContain("nutraceuticos");
  });

  it("sin prescripcion y sin 'no', sigue pendiente, y el texto dice las DOS salidas", () => {
    const p = con({
      nutraceuticosDecision: null,
      sinPrescripcion: false,
      nutraceuticosPrescritos: 0,
      productosDeTerceroPrescritos: 0,
    }).find((x) => x.id === "nutraceuticos");
    expect(p).toBeDefined();
    expect(p?.titulo).toBe("No se registró la decisión sobre los nutracéuticos");
    // Un pendiente que no dice como resolverse obliga a adivinar. Nombra las dos salidas reales.
    expect(p?.detalle).toContain("prescripción");
    expect(p?.detalle).toContain("No prescribo nutracéuticos");
    // El rotulo viejo no puede quedar: nombra un boton retirado.
    expect(p?.detalle).not.toContain("debajo de los recomendados");
  });

  it("LA ENTREGA YA NO APARECE: ni en el título ni como condición", () => {
    // Es el defecto que se retira. Con dos prescritos el aviso decia "Prescribiste 2: falta registrar si
    // se los llevó", y la entrega es un hecho comercial que esta lista no mide.
    expect(ids({ nutraceuticosPrescritos: 2 })).not.toContain("nutraceuticos");
    const sinNada = con({ nutraceuticosPrescritos: 0, nutraceuticosDecision: null }).find(
      (x) => x.id === "nutraceuticos",
    );
    const texto = `${sinNada?.titulo} ${sinNada?.detalle}`;
    for (const frase of ["se los llevó", "se lo llevó", "Prescribiste"]) {
      expect(texto, `todavía mide la entrega: "${frase}"`).not.toContain(frase);
    }
  });

  it("un nutracéutico que NO es de los que sugiere el modelo cuenta igual", () => {
    // Su parentesis: *"los del modelo u otros distintos: hoy uno distinto tampoco cuenta, y eso es un
    // defecto"*. La cuenta sale de `treatment_nutraceuticals`, que es lo que el profesional AGREGA, y no
    // mira si el modelo lo habia sugerido. Aqui se fija que la regla no tenga esa distincion.
    expect(
      ids({ nutraceuticosPrescritos: 1, nutraceuticosDecision: null, sinPrescripcion: false }),
    ).not.toContain("nutraceuticos");
  });

  // ═══ EL CASO DE SANTIAGO: SE QUITA EL NUTRACEUTICO Y QUEDA SOLO LUVIA (2026-11-16) ═══
  //
  // Textual suyo: *"se prescribe un nutraceutico, se quita, queda solo un producto Luvia, y el item del
  // cierre desaparece"*. La cuenta siempre fue la VIGENTE (el writer reemplaza el set entero), asi que
  // quitar el nutraceutico ya borraba su fila; lo que faltaba era no contar los productos de TERCERO.
  it("quitar el nutracéutico y dejar solo LUVIA deja el pendiente ABIERTO", () => {
    const soloLuvia = { nutraceuticosPrescritos: 0, productosDeTerceroPrescritos: 1 };
    expect(ids(soloLuvia)).toContain("nutraceuticos");
  });

  it("y el aviso de ese caso NO le pide guardar una prescripción que ya guardó", () => {
    const p = con({ nutraceuticosPrescritos: 0, productosDeTerceroPrescritos: 1 }).find(
      (x) => x.id === "nutraceuticos",
    );
    expect(p?.titulo).toContain("producto externo");
    // Lo que SI tiene que ofrecerle: completar con nutracéuticos de CNV, o el botón del criterio.
    expect(p?.detalle).toContain("No prescribo nutracéuticos");
    expect(p?.detalle, "le manda a pulsar Guardar prescripción, que ya pulsó").not.toContain(
      "Guarda la prescripción",
    );
  });

  it("un nutracéutico de CNV cierra el ítem aunque además haya un producto externo", () => {
    // La mezcla es el caso normal: LUVIA mas un VITACELLEBIS. El externo no resta.
    expect(ids({ nutraceuticosPrescritos: 1, productosDeTerceroPrescritos: 1 })).not.toContain(
      "nutraceuticos",
    );
  });

  // ═══ Y LA REGLA VIVE EN UN SOLO SITIO, QUE ES LO QUE DEJO NACER EL DEFECTO ═══
  //
  // La pantalla de prescribir partia el catalogo con `ownership !== "tercero"` desde el 2026-09-26 y la
  // lista de pendientes no miraba el ownership: dos copias de la misma regla, y una envejecio sola.
  it("la pantalla de prescribir y el cierre parten el catálogo con la MISMA regla", () => {
    const pantalla = readFileSync(
      "src/modules/treatment/components/nutraceuticals-section.tsx",
      "utf8",
    );
    expect(pantalla).toContain("producto-de-tercero");
    expect(pantalla, 'la pantalla volvió a escribir su propia copia de la regla').not.toContain(
      'ownership === "tercero"',
    );
    expect(pantalla).not.toContain('ownership !== "tercero"');
    const pagina = readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8");
    expect(pagina).toContain("cuantosNutraceuticosDeCnv");
    expect(pagina, "el cierre volvió a contar filas sin mirar de quién es el producto").not.toContain(
      "nutraceuticosPrescritos: protocol?.nutraceuticals.length",
    );
  });

  // ═══ LA VENTA YA NO ES UNA VIA, Y LA FORMA LO FIJA (2026-11-16) ═══
  //
  // El campo `hayVentaDeNutraceuticos` se RETIRO de `EstadoConsulta`, no se dejo sin leer: una bandera que
  // nadie mira deja creer que se esta aplicando. Esta asercion es sobre la forma porque el tipo ya no
  // permite pasarla, asi que el unico sitio donde podria reaparecer es el codigo.
  it("la venta no vuelve a entrar como condición del cierre", () => {
    const src = readFileSync("src/modules/reports/data/cierre-pendientes.ts", "utf8");
    expect(src).toContain("resueltoPorLaPrescripcion");
    expect(src, "la venta volvió a decidir el pendiente clínico").not.toContain("resueltoPorLaVenta");
  });

  // ═══ "NO REPROCHA" NO ES "NO DICE QUE FALTA"  ·  precisado el 2026-11-15 ═══
  //
  // El nombre de este caso decia "sin 'falta'" y la lista de palabras prohibidas NUNCA incluyo "falta":
  // afirmaba una regla que no comprobaba. Se corrige el nombre, no la regla, porque la regla es la
  // correcta: lo que no cabe es un reproche A LA PERSONA ("debes", "olvidaste", "no hiciste"). Decir que
  // falta un REGISTRO describe lo que el sistema no tiene, y es justo lo que Santiago pidio que dijera
  // (*"Prescribiste 2: falta registrar si se los llevó"*): sin eso, el titulo se lee como que la
  // prescripcion tampoco esta.
  it("NINGÚN texto de la lista regaña a la persona: sin 'debes', sin 'olvidaste', sin 'no hiciste'", () => {
    // El profesional puede cerrar con pendientes a proposito; la lista es informacion, no reproche.
    const todos = pendientesDeLaConsulta({
      encuestaCompleta: false,
      protocoloComputado: true,
      protocoloEmitido: false,
      reporteEstado: "draft",
      nutraceuticosDecision: null,
      sinPrescripcion: false,
      nutraceuticosPrescritos: 0,
      productosDeTerceroPrescritos: 0,
      proximaCita: null,
      remisionesSinRetorno: 1,
    });
    expect(todos.length).toBeGreaterThan(4);
    for (const p of todos) {
      const texto = `${p.titulo} ${p.detalle}`.toLowerCase();
      for (const palabra of ["debes", "deberías", "no hiciste", "olvidaste", "error"]) {
        expect(texto, `"${p.titulo}" usa "${palabra}"`).not.toContain(palabra);
      }
    }
  });
});

const WRITER = readFileSync("src/modules/evaluations/data/evaluations-writer.ts", "utf8");

/**
 * EL CUERPO DE UNA FUNCION DEL WRITER, no "de ahi al final del archivo".
 *
 * ── POR QUE, Y ES UNA CORRECCION DEL 2026-10-07 ──
 *
 * Estos casos cortaban con `WRITER.slice(indexOf("export async function reopenEvaluation"))`, o sea desde esa
 * funcion HASTA EL FINAL. Funcionaba porque era la ultima del archivo. Al agregar `retirarEvaluacion` debajo
 * (que si menciona `diagnoses`, a proposito: es su porton), el candado se puso rojo acusando a
 * `reopenEvaluation` de tocar un sello que no toca.
 *
 * ERA UN CANDADO ANCLADO A LA POSICION, no al hecho: cualquiera que agregue algo al final del archivo lo
 * rompe, y el mensaje señala al sitio equivocado. Ahora corta en la SIGUIENTE declaracion exportada.
 */
function cuerpoDe(nombre: string): string {
  const i = WRITER.indexOf(`export async function ${nombre}`);
  if (i < 0) throw new Error(`cierre-consulta: no existe ${nombre} en el writer`);
  const resto = WRITER.slice(i + 1);
  const j = resto.indexOf("\nexport ");
  return j < 0 ? WRITER.slice(i) : WRITER.slice(i, i + 1 + j);
}
const UI = readFileSync("src/modules/reports/components/cierre-consulta.tsx", "utf8");

describe("el acto de cerrar", () => {
  it("registra QUIEN y CUANDO, como cualquier acto clínico", () => {
    const fn = WRITER.slice(WRITER.indexOf("export async function closeEvaluation"));
    expect(fn).toContain("closedAt");
    expect(fn).toContain("closedBy: input.actorId");
    expect(fn).toContain('event: "evaluation.closed"');
  });

  it("es REVERSIBLE: cerrar no puede ser una puerta que se traba", () => {
    // in_progress es lo que habilita importar un BIS, correr el pipeline y editar la encuesta.
    const fn = cuerpoDe("reopenEvaluation");
    expect(fn).toContain('status: "in_progress"');
    expect(fn).toContain('event: "evaluation.reopened"');
  });

  it("reabrir NO deshace ningún sello clínico", () => {
    const fn = cuerpoDe("reopenEvaluation");
    for (const sello of ["diagnos", "protocol", "report"]) {
      expect(fn.toLowerCase(), `reopenEvaluation no debe tocar ${sello}`).not.toContain(sello);
    }
  });

  it("el botón de cerrar NO se deshabilita por tener pendientes", () => {
    // Cerrar con pendientes es una decision legitima del profesional.
    expect(UI).toContain("disabled={closing}");
    expect(UI).not.toMatch(/disabled=\{[^}]*pendientes[^}]*\}/);
  });
});
