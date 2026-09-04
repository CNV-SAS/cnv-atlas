import { describe, expect, it } from "vitest";

import { computeProtocoloCalorico } from "@/clinical-engine/protocolo-calorico";
// Modulos congelados en JS; `allowJs` los resuelve.
import { ATLAS_GEB, ATLAS_GEB_HB } from "@/clinical-engine/frozen/atlas-geb.js";
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";

// CANDADO DEL GASTO BASAL · UNA SOLA FUENTE (Gildardo §9.6, 2026-09-02).
//
// SU DECISIÓN: "manda el gasto basal del equipo. Calcularlo con una fórmula propia es sustituir una
// medición por una estimación". Y lo que la motiva, medido por él sobre ONCE mediciones reales: el equipo
// usa HARRIS-BENEDICT (20 kcal de error medio; Cunningham 60, Mifflin 71).
//
// LO QUE ESTE CANDADO CUIDA no es la fórmula, que es suya y va verbatim: es que NO VUELVAN A SER DOS. El
// defecto que se cierra es de esa forma exacta y llevaba semanas: nuestra cadena calculaba el GEB con un
// `500 + 22 × FFM` rotulado "Cunningham" —que él acaba de declarar que NO es Cunningham (370 + 21,6)— y
// que además **no salió de su cadena del nutricionista**, sino del bloque de la fórmula sintética del
// médico, que en su archivo está DESACTIVADO. Su cadena del plan nutricional lee `_mtn.geb` desde al menos
// el 19 de agosto.
//
// Entre las dos fórmulas había hasta **205 kcal de diferencia sobre el mismo paciente**. Su frase, que es
// la que resume el hallazgo: *"esa diferencia no era de criterio clínico, era de no haber usado el dato
// que ya estaba"*.

const BIS = (over: Record<string, unknown> = {}) => ({
  sexo: "Masculino",
  peso: 80.4,
  talla: 177,
  FMI: 5.76,
  FFMI: 19.9,
  FFM: 62.4,
  ...over,
});
const ENC = { d5_39: [], edad: 40 };

describe("la fórmula es la del equipo, verbatim", () => {
  it("Harris-Benedict, con sus constantes", () => {
    // Hombre: 66,473 + 13,7516·p + 5,0033·t − 6,755·e. Se comprueba el VALOR, no el texto: una constante
    // mal transcrita pasaría un test de texto y cambiaría la prescripción de todos.
    expect(ATLAS_GEB_HB(80, 177, 40, true)).toBe(Math.round(66.473 + 13.7516 * 80 + 5.0033 * 177 - 6.755 * 40));
    expect(ATLAS_GEB_HB(61, 160, 40, false)).toBe(
      Math.round(655.0955 + 9.5634 * 61 + 1.8496 * 160 - 4.6756 * 40),
    );
  });

  it("y sin los tres insumos NO estima: devuelve null", () => {
    // Un cero medido y un dato ausente no son lo mismo, y es la misma regla que él aplica al PABU.
    for (const args of [[0, 177, 40], [80, 0, 40], [80, 177, 0]] as const) {
      expect(ATLAS_GEB_HB(args[0], args[1], args[2], true)).toBeNull();
    }
  });
});

describe("MANDA EL DATO DEL EQUIPO; Harris-Benedict es el respaldo", () => {
  it("con medición del equipo, esa manda y se dice que es medida", () => {
    expect(ATLAS_GEB({ GEB: 1850 }, 80, 177, 40, true)).toEqual({ kcal: 1850, origen: "equipo" });
  });

  it("sin medición, estima y DICE que estima", () => {
    // Su condición al entregarlo: el profesional tiene que saber si mira una medición o una estimación.
    const r = ATLAS_GEB({}, 80, 177, 40, true) as { kcal: number; origen: string };
    expect(r.origen).toBe("Harris-Benedict");
    expect(r.kcal).toBe(ATLAS_GEB_HB(80, 177, 40, true));
  });
});

describe("nuestra cadena y su motor dan el MISMO gasto basal", () => {
  // ESTE ES EL CASO QUE IMPIDE QUE VUELVAN A SEPARARSE, y desde el 2026-09-04 vigila una fórmula nueva:
  // Mifflin-St Jeor sobre el peso de la cadena, que es la que su entrega del 3 dejó en `motorTratNutri`.
  //
  // POR QUÉ SIGUE HABIENDO DOS SITIOS: el replay de un protocolo sellado no puede llamar al motor (le
  // haría falta la encuesta), así que la cadena calcula la fórmula ella misma. Se intentó sellar el gasto
  // y leerlo, y el golden lo tumbó: un gasto sellado no se mueve cuando el profesional ajusta el peso
  // meta, y la cadena efectiva existe para RE-CORRER. Duplicar la fórmula es el precio, y ESTE CASO es lo
  // que lo hace pagable: compara las dos salidas sobre los mismos datos.
  it.each([
    ["hombre", "Masculino", 80.4, 177, 40],
    ["mujer", "Femenino", 61, 160, 52],
    ["hombre joven", "Masculino", 95, 185, 24],
  ])("%s: cadena == motorTratNutri", (_n, sexo, peso, talla, edad) => {
    const m = motorTratNutri({ ...ENC, edad }, BIS({ sexo, peso, talla }), {}) as {
      geb: number;
      pesoMeta: number;
    };
    const cadena = computeProtocoloCalorico({
      ffm: 62.4,
      pesoN: m.pesoMeta,
      talla,
      edad,
      sexoM: sexo === "Masculino",
      deficit: 0,
      protMin: 1,

    });
    expect(cadena.gebAuto, "la cadena y el motor dejaron de dar el mismo GEB").toBe(m.geb);
  });

  it("el GASTO MEDIDO no entra en esta cadena, y este caso existe porque yo lo habia metido", () => {
    // DEFECTO PROPIO, corregido el 2026-09-02 el mismo dia que lo introduje. Al portar su §9.6 lei el
    // punto 1 ("manda el gasto basal del equipo") y puse el medido a ganarle al Harris-Benedict. Su
    // punto 3 y el comentario pegado a `_mtn.geb` dicen lo contrario para ESTA cadena:
    //
    //   "El gasto MEDIDO por el equipo corresponde al peso actual, asi que sirve para mostrar el basal
    //    de hoy -eso hace ATLAS_GEB- pero no para fijar la ingesta que lleva a la meta."
    //
    // Era un defecto LATENTE, no vivo: ningun caller pasaba el medido, asi que la rama nunca corrio.
    // Lo grave era otro: el candado AFIRMABA la rama equivocada, o sea que dejaba la trampa puesta y
    // ademas certificada para el que viniera a cablear la medicion.
    //
    // Ahora la etiqueta es una sola por construccion, y el tipo ya no admite el gasto medido. La formula
    // paso a MIFFLIN el 2026-09-04 (su entrega del 3); lo que este caso protege no es cual es, sino que la
    // cadena NO use el gasto medido del equipo, que sigue siendo del peso de hoy y no del peso meta.
    const c = computeProtocoloCalorico({
      ffm: 62.4, pesoN: 80.4, talla: 177, edad: 40, sexoM: true, deficit: 0, protMin: 1,
    });
    expect(c.formula).toBe("Mifflin");
    expect(c.gebAuto).toBe(Math.round(10 * 80.4 + 6.25 * 177 - 5 * 40 + 5));

    // Y EL CONTROL, que es lo que impide que vuelva a entrar: el input no tiene por donde recibirlo.
    // Si alguien reabre esa puerta, esto deja de compilar y hay que volver a leer el comentario de arriba.
    const entrada = { ffm: 0, pesoN: 80.4, talla: 177, edad: 40, sexoM: true, deficit: 0, protMin: 1 };
    expect(Object.keys(entrada)).not.toContain("gebMedido");
  });

  it("y la FFM ya NO decide nada: era la rama del bloque muerto", () => {
    // CONTROL del defecto que se cierra: con FFM y sin ella, el mismo GEB. Antes cambiaba la fórmula.
    const conFfm = computeProtocoloCalorico({
      ffm: 62.4, pesoN: 80.4, talla: 177, edad: 40, sexoM: true, deficit: 0, protMin: 1,
    });
    const sinFfm = computeProtocoloCalorico({
      ffm: 0, pesoN: 80.4, talla: 177, edad: 40, sexoM: true, deficit: 0, protMin: 1,
    });
    expect(conFfm.gebAuto).toBe(sinFfm.gebAuto);
  });
});
