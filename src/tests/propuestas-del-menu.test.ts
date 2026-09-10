import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { agruparCambiosPorCelda, verificarCita } from "@/modules/treatment/ai/prompts/menu.v4";

import { sinComentarios } from "./helpers/sin-comentarios";

// LAS PROPUESTAS DE LA IA PARA EL MENU: dos defectos del mismo smoke (Santiago, 2026-09-10).
//
// LOS DOS SE VIERON COMO "la pantalla dice algo que no es", y los dos salieron de comparar mal.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

describe("una propuesta que la grilla YA cumple no se sigue ofreciendo", () => {
  // EL DEFECTO, con el dato de produccion delante: de 14 cambios propuestos, 6 seguian diciendo "aplicar"
  // despues de aplicarse y el boton global seguia ofreciendolos. Los 6 eran todos de ALMUERZO y su celda
  // guardada estaba en `undefined`.
  //
  // LA CAUSA: `aplicarCambiosMenu` guarda SOLO lo que difiere del ciclo y BORRA la celda cuando el
  // reemplazo coincide con lo que el ciclo ya propone (guardarlo la congelaria: dejaria de seguir al ciclo
  // el dia que se proponga otra semana). En esos 6, la IA devolvio el texto del ciclo tal cual. El
  // servicio hizo lo correcto; la PANTALLA preguntaba lo que no era.
  //
  // Y NO ERA COSMETICO: volver a pulsar no cambiaba nada, asi que el boton quedaba en un bucle de no hacer
  // nada, que es la forma mas rapida de que un profesional deje de confiar en la pantalla.

  it("se compara contra el texto EFECTIVO de la celda, no contra lo guardado", () => {
    expect(PANEL, "volvió a compararse solo contra la celda guardada").toContain(
      "const textoEfectivo = (dia: number, tiempo: string): string =>",
    );
    expect(PANEL).toContain("celdasGuardadas[`${dia}_${tiempo}`] ??");
    expect(PANEL).toContain("diaDelCiclo(diaInicioGuardado, dia)");
  });

  it("y es la MISMA regla que usa el servicio para decidir si guarda", () => {
    // Si las dos reglas se separan, vuelve el desacuerdo: una guarda y la otra no lo ve.
    const SERVICIO = readFileSync("src/modules/treatment/services/treatment-service.ts", "utf8");
    expect(SERVICIO).toContain("if (cambio.reemplazo === delCiclo)");
    expect(SERVICIO).toContain("delete celdas[`${cambio.dia}_${cambio.tiempo}`]");
  });

  it("son TRES estados, porque 'ya está' tiene dos motivos distintos", () => {
    // Decir "aplicado" cuando el ciclo ya lo decía sería atribuirle al profesional un acto que no hizo.
    expect(PANEL).toContain('"aplicado" | "ya-coincide" | "pendiente"');
    expect(PANEL).toContain("La grilla ya dice esto.");
    expect(PANEL).toContain("Aplicado a la grilla.");
  });

  it("y el botón global solo cuenta las PENDIENTES", () => {
    expect(PANEL).toContain('estadoDelCambio(c) === "pendiente"');
  });

  it("aplicar NO se ofrece con el menú sin guardar: escribiría sobre lo guardado", () => {
    // El otro choque del guardado único: `aplicarCambiosMenu` parte del menú GUARDADO, así que con un
    // borrador sin guardar aplicar lo perdería en silencio. Se dice, en vez de ofrecer un botón que
    // destruye trabajo. Mismo trato que el botón de adaptar con las restricciones sin guardar.
    expect(PANEL).toContain("menuSinGuardar");
    expect(PANEL).toContain("Guarda primero los cambios del menú semanal");
    expect(PANEL).toContain('menuSinGuardar={sucias.includes("menuSemanal")}');
  });
});

describe("una celda sale UNA vez, con sus motivos juntos", () => {
  // EL DEFECTO DEL SMOKE (Santiago, 2026-09-10): "cada celda sale dos veces". Con el dato de produccion
  // delante: de 24 propuestas, 16 eran celdas distintas y ocho estaban duplicadas, con el MISMO reemplazo
  // y un motivo cada una ("sin gluten" en una, "sin lactosa" en la otra).
  //
  // LO QUE SE VERIFICO ANTES DE TOCAR NADA, porque el arreglo habria sido el equivocado: `parseCambiosMenu`
  // NO separa nada, toma el arreglo tal cual. Es el MODELO el que devuelve una entrada por restriccion
  // incumplida. Asi que se agrupa al presentar, y ni el contrato ni lo guardado cambian.

  const cambio = (dia: number, tiempo: string, reemplazo: string, motivo: string) => ({
    dia,
    tiempo,
    reemplazo,
    motivo,
  });

  it("dos entradas de la misma celda con el mismo texto son UNA sugerencia", () => {
    const salida = agruparCambiosPorCelda([
      cambio(3, "desayuno", "Arepa de maíz con huevo", "sin gluten"),
      cambio(3, "desayuno", "Arepa de maíz con huevo", "sin lactosa"),
    ]);
    expect(salida).toHaveLength(1);
    expect(salida[0].motivos).toEqual(["sin gluten", "sin lactosa"]);
  });

  it("y las celdas distintas siguen siendo distintas", () => {
    // CONTROL: sin esto, "colapsarlo todo en una" también pasaría verde.
    const salida = agruparCambiosPorCelda([
      cambio(3, "desayuno", "Arepa", "sin gluten"),
      cambio(3, "almuerzo", "Arroz con pollo", "sin gluten"),
    ]);
    expect(salida).toHaveLength(2);
  });

  it("un motivo repetido no se repite en la lista", () => {
    const salida = agruparCambiosPorCelda([
      cambio(0, "cena", "Sopa de verduras", "sin lácteos"),
      cambio(0, "cena", "Sopa de verduras", "sin lácteos"),
    ]);
    expect(salida[0].motivos).toEqual(["sin lácteos"]);
  });

  it("DOS TEXTOS distintos para la misma celda NO se juntan: son alternativas", () => {
    // Juntarlos escribiría uno encima del otro. Elegir entre dos preparaciones es contenido clínico, así
    // que se marcan y el profesional decide.
    const salida = agruparCambiosPorCelda([
      cambio(1, "almuerzo", "Pollo a la plancha", "sin gluten"),
      cambio(1, "almuerzo", "Pescado al horno", "sin gluten"),
    ]);
    expect(salida).toHaveLength(2);
    expect(salida.every((c) => c.alternativas)).toBe(true);
  });

  it("y esas quedan FUERA del botón de aplicar todas", () => {
    // El daño concreto: el atajo aplicaría las dos, quedaría la última, y el profesional vería una sola
    // sin saber que hubo otra.
    expect(PANEL).toContain("!c.alternativas && estadoDelCambio(c)");
  });

  it("la key de React distingue las alternativas", () => {
    // Era `${dia}_${tiempo}`, que las dos entradas de una celda compartían.
    expect(PANEL).toContain("_${c.reemplazo}`}");
  });
});

describe("el aviso de la cita dice lo que sabe, no un veredicto", () => {
  // EL CASO DEL SMOKE: el profesional registró "sin gluten y sin lácteos" y el modelo citó "sin lactosa".
  //
  // Y EL COTEJO NO ESTÁ EQUIVOCADO: lactosa y lácteos no son la misma restricción (una intolerancia no es
  // una dieta sin lácteos). Unirlas pediría una tabla de sinónimos clínicos, que es contenido clínico y no
  // nos toca inventarlo; hacerlo por prefijo uniría "gluten" con "glutamato". Lo que estaba mal era la
  // FRASE, que convertía "no reconozco estas palabras" en "esto no corresponde a nada".

  it("el caso sigue sin verificarse, y eso es correcto", () => {
    expect(verificarCita("sin lactosa", ["sin gluten y sin lacteos"])).toBe(false);
  });

  it("pero ya no se afirma que no corresponda a nada", () => {
    expect(sinComentarios(PANEL), "volvió el veredicto que afirmaba de más").not.toContain(
      "no corresponde a ninguna restricción registrada",
    );
    expect(PANEL).toContain("de tus restricciones registradas");
  });

  it("y NO se retira: sigue marcando el motivo que nadie pidió atender", () => {
    // Es para lo que existe. Retirarlo dejaría pasar en silencio una cita inventada.
    expect(verificarCita("sin mariscos", ["sin gluten y sin lacteos"])).toBe(false);
    expect(PANEL).toContain("sinRespaldo");
  });

  it("se coteja motivo por motivo, no la celda entera", () => {
    // Una celda puede citar dos restricciones y solo una estar registrada. Cotejar la celda entera diría
    // "está bien" sobre una mitad inventada, o marcaría la mitad correcta.
    expect(PANEL).toContain("c.motivos.filter((m) => !verificarCita(m, restriccionesVigentes))");
  });
});

describe("la cita de una propuesta se coteja por TERMINOS, no por contencion", () => {
  // EL DEFECTO, con el dato de produccion delante: el profesional registro UNA restriccion compuesta,
  // "sin gluten ni lacteos". La IA cita por celda la mitad que aplica ("sin lacteos") y la pantalla decia
  // "no corresponde a ninguna restriccion registrada" sobre una cita correcta.
  //
  // NO ERA EL ACENTO (la normalizacion los quita bien) NI QUE LAS RESTRICCIONES NO LLEGARAN (llegaban):
  // era la DIRECCION de la contencion, que suponia que el motivo repite la restriccion entera.

  it("EL CASO DEL SMOKE: la mitad de una restricción compuesta cuenta como citada", () => {
    expect(verificarCita("sin lacteos", ["sin gluten ni lacteos"])).toBe(true);
    expect(verificarCita("sin gluten", ["sin gluten ni lacteos"])).toBe(true);
  });

  it("y sigue marcando lo que NO se registró, que es para lo que existe el aviso", () => {
    // CONTROL: sin esto, "devuelve true siempre" también pasaría verde, y entonces el aviso no serviría
    // para nada, que es el otro modo de romperlo.
    expect(verificarCita("sin mariscos", ["sin gluten ni lacteos"])).toBe(false);
    expect(verificarCita("sin gluten", ["sin lacteos"])).toBe(false);
    expect(verificarCita("sin lacteos", [])).toBe(false);
  });

  it("los acentos y el plural no cambian el resultado", () => {
    expect(verificarCita("sin lácteos", ["sin gluten ni lacteos"])).toBe(true);
    expect(verificarCita("sin lacteo", ["sin gluten ni lacteos"])).toBe(true);
  });

  it("y las palabras vacías no verifican nada por sí solas", () => {
    // Sin quitarlas, "sin gluten" y "sin lacteos" compartirían `sin` y todo quedaría verificado siempre.
    expect(verificarCita("sin", ["sin gluten"])).toBe(false);
    expect(verificarCita("dieta", ["dieta sin gluten"])).toBe(false);
  });

  it("y el aviso de la pantalla se recomputa al LEER, no se lee del jsonb", () => {
    // `citaVerificada` se calcula al generar y se guarda dentro de `menu_json`, que es inmutable: eso lo
    // vuelve una foto. Si el cotejo tenía un defecto (lo tenía) o si las restricciones cambiaron después,
    // la pantalla seguiría mostrando el veredicto viejo. El aviso habla en presente, así que se recalcula
    // en presente. Lo guardado se conserva como procedencia.
    expect(PANEL).toContain("verificarCita(m, restriccionesVigentes)");
    expect(sinComentarios(PANEL), "volvió a leerse el veredicto guardado").not.toContain(
      "c.citaVerificada",
    );
  });

  it("y se coteja contra las MISMAS tres listas que usó la generación", () => {
    // Si aquí se mirara un subconjunto, una cita legítima saldría marcada: el defecto de vuelta por otra
    // puerta.
    const GENERA = readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8");
    for (const fuente of ["restriccionesModelo", "protocol.restricciones", "patron"]) {
      expect(GENERA, `la generación dejó de cotejar contra ${fuente}`).toContain(fuente);
    }
    expect(PANEL).toContain("...protocol.restricciones,");
    expect(PANEL).toContain("...patronAlimentario,");
  });
});
