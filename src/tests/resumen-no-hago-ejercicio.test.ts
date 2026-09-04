import { describe, expect, it } from "vitest";

import {
  resumenEjercicioParrafo,
  resumenMedicoParrafo,
} from "@/clinical-engine/resumen-profesion";

// "NO HAGO EJERCICIO" VALE CERO, NO "SIN DATO" (porte de su punto 6 del 2026-09-03).
//
// EXISTE PORQUE ESTO NO SE PUEDE SMOKEAR, y esa es la razon de que lleve test en vez de recorrido: la
// opcion "No hago ejercicio" todavia NO esta en la encuesta. Sus opciones de P23 siguen siendo "0".."7",
// y cambiarlas es un bump de version (los ids de pregunta y opcion llevan la version dentro). Asi que
// hasta el bump, un profesional no puede elegirla en pantalla ni a mano.
//
// Y HAY UNA SEGUNDA RAZON, mas importante: HOY ESTE ARREGLO NO CAMBIA NADA VISIBLE. Con la opcion "0", el
// resumen ya dice "no realiza actividad fisica", porque `num("0")` es 0 y la rama de cero ya existia. El
// arreglo es para DESPUES del bump, cuando el texto sustituya al numero. Un cambio que no altera ninguna
// pantalla hoy es exactamente el que se pierde sin que nadie lo note, y por eso se fija aqui.
//
// EL DEFECTO QUE EVITA: con el texto y sin este arreglo, `num("No hago ejercicio")` devuelve null, la
// clausula entera se salta, y el resumen NO DICE NADA de actividad fisica justo en quien declara no hacer
// ninguna. No es un hueco cosmetico: el sedentarismo es el dato que el profesional necesita ver.

const BASE = { sexo: "M", edad: 40 } as Record<string, unknown>;

// LOS DOS GENERADORES en cada caso, que es lo que el corrigio: "se corrigieron los DOS generadores de
// prosa". Probar uno solo dejaria el otro libre de decir "sin dato", y es el mismo defecto en los dos.
function resumen(enc: Record<string, unknown>): string {
  const e = { ...BASE, ...enc } as never;
  return [resumenMedicoParrafo(e), resumenEjercicioParrafo(e)].join(" || ");
}

describe('"No hago ejercicio" se lee como cero en los dos generadores de prosa', () => {
  it("con el TEXTO nuevo, el resumen dice que no realiza actividad física", () => {
    expect(resumen({ d3_23: "No hago ejercicio" })).toContain("no realiza actividad física");
  });

  it("y con el número 0 de hoy dice lo mismo: el arreglo no cambia lo que ya funcionaba", () => {
    // CONTROL de no-regresion. El arreglo es para el futuro, asi que tiene que dejar el presente igual.
    expect(resumen({ d3_23: "0" })).toContain("no realiza actividad física");
  });

  it("un número real sigue diciendo los días, no cero", () => {
    // CONTROL en la otra direccion: sin esto, una regla demasiado ancha (por ejemplo, tratar cualquier
    // texto como cero) pasaria los dos casos de arriba y romperia a todos los demas pacientes.
    const r = resumen({ d3_23: "3" });
    expect(r).toContain("realiza actividad física 3 días por semana");
    expect(r).not.toContain("no realiza actividad física");
  });

  it("y sin respuesta NO se inventa un cero", () => {
    // La distincion que hay que conservar: "no hace ejercicio" es un DATO; "no contestó" es una ausencia.
    // Si la ausencia se leyera como cero, el resumen afirmaria sedentarismo de quien no dijo nada.
    expect(resumen({})).not.toContain("actividad física");
  });
});
