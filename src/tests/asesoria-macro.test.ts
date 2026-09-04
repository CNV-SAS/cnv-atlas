import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { asesoriaFuera, asesoriaMacro } from "@/clinical-engine/frozen/atlas-asesoria-macro.js";

import { funcionDelHtml, HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DEL PANEL DE REFERENCIA POR DIAGNOSTICO (su punto 3 del 2026-09-04).
//
// POR QUE EXISTE ESTA PIEZA. Su entrega del 3 de septiembre retira la proteina por patologia de los cuatro
// modulos congelados y la deja en 0,8 editable. Atlas porto la RETIRADA y no el reemplazo, y el mismo lo
// nombro: "si portaron la retirada sin portar el panel, lo que quedo en Atlas es media instruccion, y es
// la mitad peor". Esto es la otra mitad.
//
// LO QUE EL CANDADO SOSTIENE, y son tres cosas distintas:
//   1. PROCEDENCIA: el porte es byte a byte el de su entrega vigente.
//   2. QUE NO PRESCRIBE: devuelve rangos, nunca un valor, y ante condiciones que no se solapan NO ESCOGE.
//      Es la linea que separa esto de lo que se retiro.
//   3. QUE NO ES UNA VALIDACION: `asesoriaFuera` informa y no corrige, que es lo unico compatible con su
//      §5 del 2026-08-27 ("ninguna cifra de la prescripcion lleva techo, piso, validacion ni advertencia").

const PORTADO = readFileSync("src/clinical-engine/frozen/atlas-asesoria-macro.js", "utf8");

/** Un paciente con las cuatro entradas que el panel lee, para no repetirlo en cada caso. */
const paciente = (dx: string[], extra: Record<string, unknown> = {}) => ({
  enc: { d5_39: dx, edad: 50, sexo: "M" } as Record<string, unknown>,
  bis: { sexo: "M", FFMI: 20, FMI: 5, ASMI: 8, ...extra } as Record<string, unknown>,
});

type Ases = {
  unidad: string;
  items: { cond: string; min: number; max: number; porque: string; fuente: string }[];
  conflicto: boolean;
  rango: [number, number] | null;
  nota: string;
};
const prot = (dx: string[], extra?: Record<string, unknown>): Ases => {
  const p = paciente(dx, extra);
  return asesoriaMacro(p.enc, p.bis, "prot") as Ases;
};

describe("1 · procedencia: el porte es el suyo, byte a byte", () => {
  it.each(["asesoriaMacro", "asesoriaFuera"])("%s coincide con su entrega vigente", (nombre) => {
    const suyo = funcionDelHtml(nombre, HTML_VIGENTE);
    expect(PORTADO).toContain(suyo);
  });
});

describe("2 · da rangos, NO prescribe", () => {
  it("la ERC pide 0,6-0,8 con su mecanismo y su fuente", () => {
    const a = prot(["Enfermedad renal crónica"]);
    expect(a.rango).toEqual([0.6, 0.8]);
    expect(a.items[0].fuente).toBe("KDIGO 2024");
    // EL MECANISMO, no la cita: es lo que hace el panel leible al decidir.
    expect(a.items[0].porque).toContain("urea");
  });

  it("y CON DOS CONDICIONES QUE NO SE SOLAPAN no escoge: lo dice", () => {
    // Es la diferencia entre esto y lo que se retiro. El motor antiguo elegia una cifra; este muestra las
    // dos y devuelve el rango en null, que es su forma de decir "decida usted".
    const a = prot(["Enfermedad renal crónica", "Cáncer"]);
    expect(a.conflicto).toBe(true);
    expect(a.rango).toBeNull();
    expect(a.items.map((i) => i.cond)).toEqual(["ERC sin diálisis", "Cáncer"]);
    expect(a.nota).toContain("La cifra la decide usted");
  });

  it("sin ninguna condición dice justo eso, y el rango es su base editable", () => {
    // Medido, no supuesto: devuelve un item "Sin condiciones que lo modifiquen" en 0,8-0,8, que es la
    // base de la cadena del 3 de septiembre. No deja el panel vacío ni inventa un rango: dice que no hay
    // nada que lo mueva, que es una información distinta de "no sé".
    const a = prot([]);
    expect(a.items).toHaveLength(1);
    expect(a.items[0].cond).toBe("Sin condiciones que lo modifiquen");
    expect(a.rango).toEqual([0.8, 0.8]);
    expect(a.conflicto).toBe(false);
  });

  it("NUNCA devuelve una cifra prescrita: solo rangos", () => {
    // CONTROL DE LA LINEA. Si algun dia esto devolviera un `valor` o un `protKg`, habria vuelto a
    // prescribir desde fuera del modulo del nutricionista, que es exactamente lo que su punto 3 retiro.
    const a = prot(["Enfermedad renal crónica"]) as unknown as Record<string, unknown>;
    for (const prohibido of ["valor", "protKg", "protG", "sugerido", "recomendado", "default"]) {
      expect(Object.keys(a), `devuelve "${prohibido}": eso es prescribir`).not.toContain(prohibido);
    }
    expect(Object.keys(a).sort()).toEqual(["conflicto", "items", "macro", "nota", "rango", "unidad"]);
  });
});

describe("3 · `asesoriaFuera` informa, no valida", () => {
  it("dice que la cifra quedó fuera, con el rango y la condición", () => {
    const a = prot(["Enfermedad renal crónica"]);
    expect(asesoriaFuera(1.3, a)).toContain("fuera del rango sugerido 0.6–0.8 g/kg");
    expect(asesoriaFuera(1.3, a)).toContain("ERC sin diálisis");
  });

  it("y dentro del rango calla", () => {
    expect(asesoriaFuera(0.7, prot(["Enfermedad renal crónica"]))).toBeNull();
  });

  it("con conflicto, basta con estar dentro de ALGUNO", () => {
    // Su regla, y es la coherente: si dos condiciones piden rangos incompatibles, cumplir una de las dos
    // es una decisión legítima y no se señala.
    const a = prot(["Enfermedad renal crónica", "Cáncer"]);
    expect(asesoriaFuera(0.7, a)).toBeNull();
    expect(asesoriaFuera(1.3, a)).toBeNull();
    expect(asesoriaFuera(2.5, a)).toContain("fuera de todos los rangos");
  });

  it("UN CAMPO VACIO SE LE LEE COMO CERO, y por eso la guarda es NUESTRA", () => {
    // HALLAZGO SOBRE SU FUNCION (2026-09-04), y es de la misma familia que el problema que su punto 3
    // venia a resolver: "el motor no puede distinguir un dato escrito a proposito de un campo mal
    // borrado". Su asesoria tampoco puede. `Number("")` y `Number(null)` son 0, y 0 pasa el
    // `isFinite`, asi que un campo vacio se evalua como cero y sale marcado "fuera del rango sugerido".
    // Solo `undefined` y `NaN` devuelven null.
    //
    // NO SE TOCA SU FUNCION (Regla 0). Lo que se fija es que la guarda la pone NUESTRO lector, que solo
    // la llama cuando hay cifra. Si alguien quita esa guarda, el panel empieza a decirle al profesional
    // que su campo en blanco esta fuera de rango. Va preguntado en la ronda.
    const a = prot(["Enfermedad renal crónica"]);
    for (const v of [undefined, NaN]) expect(asesoriaFuera(v as never, a)).toBeNull();
    for (const v of ["", null, 0]) {
      expect(asesoriaFuera(v as never, a), `${JSON.stringify(v)} deberia ser "sin cifra"`).toContain(
        "fuera del rango",
      );
    }
  });

  it("NO corrige ni acota el valor: solo devuelve texto o null", () => {
    // CONTROL de que esto no se convierta en una validación. Su §5 del 2026-08-27 prohíbe techo, piso y
    // validación sobre TODA la prescripción; lo único permitido es dejar constancia.
    const a = prot(["Enfermedad renal crónica"]);
    const r = asesoriaFuera(1.3, a);
    expect(typeof r === "string" || r === null).toBe(true);
    expect(PORTADO, "el panel no puede escribir en el valor").not.toMatch(
      /valor\s*=|Math\.(min|max)\(\s*valor/,
    );
  });
});

describe("4 · el lector usa el MISMO insumo que el motor, no uno nuevo", () => {
  const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");

  it("arma el `enc` con `buildEnc` y el `bis` con `conPesoYTalla`", () => {
    // Dos constructores del mismo insumo es como el motor de nutrición terminó viendo cero comorbilidades
    // en todos los pacientes (2026-09-01). El panel lee las MISMAS comorbilidades que el motor.
    const bloque = READER.slice(READER.indexOf("export async function getAsesoriaMacros"));
    expect(bloque).toContain("await buildEnc(evaluationId, sexo)");
    expect(bloque).toContain("conPesoYTalla(bis, await getCompositionForEvaluation(evaluationId))");
  });
});

describe("5 · la guarda del campo vacío es nuestra, y no se puede quitar", () => {
  const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");

  it("el lector solo llama a `asesoriaFuera` cuando hay cifra escrita", () => {
    // Es lo único que impide que un campo en blanco salga marcado como fuera de rango (ver el caso de
    // arriba). Sin esta línea, el panel le diría al profesional que su decisión de no escribir nada está
    // mal, que es exactamente lo contrario de lo que este panel es.
    const bloque = READER.slice(READER.indexOf("export async function getAsesoriaMacros"));
    expect(bloque).toContain("valor == null ? null : (asesoriaFuera(valor, a) as string | null)");
  });

  it("y el tipo del parámetro obliga a decidirlo en el sitio de llamada", () => {
    // `number | null` en vez de `number`: quien llama tiene que decir explícitamente que no hay cifra, en
    // vez de mandar un 0 que aquí se leería como una decisión del profesional.
    const bloque = READER.slice(READER.indexOf("export async function getAsesoriaMacros"));
    expect(bloque).toContain("protGKg: number | null");
    expect(bloque).toContain("fatPct: number | null");
  });
});
