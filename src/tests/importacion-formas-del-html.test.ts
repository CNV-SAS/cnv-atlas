import { describe, expect, it } from "vitest";

import {
  conElTextoDeOtra,
  sexoDeAtlas,
  tipoDeDocumentoDeAtlas,
} from "@/modules/importacion-html/services/formas-del-html";
import { valorParaAtlas } from "@/modules/importacion-html/services/mapeo-de-la-consulta";

// ═══ LAS FORMAS DISTINTAS DEL MISMO DATO (barrido del 2026-09-23) ═══
//
// Despues del patron alimentario se barrio el resto del importador, campo por campo, contra lo que el HTML
// guarda de verdad. Aparecieron mas casos de lo mismo, y este candado los fija.
//
// EL PEOR ERA EL SEXO, y no por ruidoso: el HTML guarda "Masculino"/"Femenino" y el guard solo aceptaba
// "M"/"F", asi que todo paciente importado quedaba sin sexo. Eso bloquea el diagnostico (ruidoso, se ve),
// pero ademas hay dos lectores que cuando el sexo falta caen a masculino sin avisar: una PACIENTE importada
// se clasificaba y se trataba como hombre. La forma equivocada otra vez es peor que la ausencia.

describe("el sexo", () => {
  it("traduce la palabra del HTML a la letra de Atlas", () => {
    expect(sexoDeAtlas("Masculino")).toBe("M");
    expect(sexoDeAtlas("Femenino")).toBe("F");
  });

  it("y sigue aceptando la letra, por si alguna consulta vieja la trae", () => {
    expect(sexoDeAtlas("M")).toBe("M");
    expect(sexoDeAtlas("f")).toBe("F");
  });

  it("lo que no reconoce queda NULO, no cae a un sexo por defecto", () => {
    // Inventar aqui significaria tratar a alguien como del sexo contrario, que es lo que pasaba aguas abajo.
    expect(sexoDeAtlas("")).toBeNull();
    expect(sexoDeAtlas("otro")).toBeNull();
    expect(sexoDeAtlas(null)).toBeNull();
  });
});

describe("el tipo de documento", () => {
  it("traduce la etiqueta completa del HTML", () => {
    expect(tipoDeDocumentoDeAtlas("Cédula de ciudadanía")).toBe("CC");
    expect(tipoDeDocumentoDeAtlas("Cédula de extranjería")).toBe("CE");
    expect(tipoDeDocumentoDeAtlas("Tarjeta de identidad")).toBe("TI");
    expect(tipoDeDocumentoDeAtlas("Pasaporte")).toBe("PA");
  });

  it("no fuerza un tipo cuando no lo reconoce", () => {
    // Antes todo caia en CC. En la muestra real acertaba por casualidad, pero un pasaporte habria entrado
    // como cedula con el mismo numero, y la llave del paciente es (organizacion, tipo, numero).
    expect(tipoDeDocumentoDeAtlas("Otro")).toBeNull();
    expect(tipoDeDocumentoDeAtlas("")).toBeNull();
  });
});

describe('el texto libre de "Otra"', () => {
  it("se fusiona en el valor, como lo guarda Atlas", () => {
    expect(conElTextoDeOtra("Otra", "Tiroiditis de Hashimoto")).toBe("Otra: Tiroiditis de Hashimoto");
    expect(conElTextoDeOtra("Otras", "Mariscos")).toBe("Otras: Mariscos");
  });

  it("y sin texto queda como venía, no se inventa", () => {
    expect(conElTextoDeOtra("Otra", "")).toBe("Otra");
    expect(conElTextoDeOtra("Otra", undefined)).toBe("Otra");
  });

  it("no toca una opción que no es 'Otra'", () => {
    expect(conElTextoDeOtra("Hipotiroidismo", "algo")).toBe("Hipotiroidismo");
  });

  it("viaja también dentro de una respuesta de opción múltiple", () => {
    // d5_39 (diagnosticos) es de opcion multiple y alimenta el Factor de Estres Metabolico: el texto que el
    // paciente escribio a mano desaparecia entero.
    const consulta = { d5_39: ["Hipotiroidismo", "Otra"], d5_39_otro: "Síndrome de ovario poliquístico" };
    expect(valorParaAtlas("d5_39", consulta.d5_39, consulta)).toBe(
      '["Hipotiroidismo","Otra: Síndrome de ovario poliquístico"]',
    );
  });
});
