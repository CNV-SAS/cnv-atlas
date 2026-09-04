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

describe("6 · el panel LLEGA A LA PANTALLA, que es lo que faltaba", () => {
  // ESTE BLOQUE MIRA EL SITIO DE LLAMADA, NO LA FUNCION, y esa es toda su razón de ser.
  //
  // Los cinco bloques de arriba probaban que `getAsesoriaMacros` está bien construida: que es verbatim,
  // que da rangos y no prescripciones, que no valida, que respeta el campo vacío. **Todos pasaban verde
  // mientras NADIE la llamaba.** El lector existía desde el 3 de septiembre y su único consumidor eran
  // estos tests: el profesional nunca vio un rango junto al campo de proteína.
  //
  // Es la forma de defecto que ya nos pasó cuatro veces y no da error en ninguna parte: una pieza
  // terminada a la que le falta el último cable. `tsc` no la ve (el código compila), `lint` tampoco (no
  // hay import sin usar, porque no hay import), y `check:cables` solo cubre server actions.
  //
  // La señal para reconocerla: **si no sabes QUIÉN LO LEE, es que nadie lo lee.**
  const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
  const SECCION = readFileSync(
    "src/modules/treatment/components/profession-treatment-section.tsx",
    "utf8",
  );
  const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

  it("la página lo computa y lo baja como dato", () => {
    expect(PAGE).toContain("await getAsesoriaMacros(");
    expect(PAGE).toContain("asesoria={asesoriaMacros}");
  });

  it("la cadena de props no se corta en ningún eslabón", () => {
    // Cada uno de los tres saltos, por separado. Con solo el primero y el último, un eslabón roto en el
    // medio pasaría verde: la página lo manda, el panel lo pinta, y en medio se pierde.
    expect(SECCION, "página -> sección").toContain("asesoria={asesoria}");
    expect(PANEL, "sección -> panel -> cadena calórica").toContain("asesoria={asesoria}");
    expect(PANEL, "el panel lo declara como prop").toContain(
      "asesoria: { prot: AsesoriaMacro; grasa: AsesoriaMacro } | null",
    );
  });

  it("y se pinta junto a los DOS campos, no solo junto al de proteína", () => {
    expect(PANEL).toContain("asesoria={asesoria?.prot ?? null}");
    expect(PANEL).toContain("asesoria={asesoria?.grasa ?? null}");
  });

  it("el aviso de fuera de rango se calcula en el CLIENTE, contra lo que se está escribiendo", () => {
    // Si se calculara en el servidor iría un guardado por detrás: el campo diría una cifra y el aviso
    // hablaría de la anterior. Por eso la página pasa null en los dos últimos argumentos.
    const COMPONENTE = readFileSync(
      "src/modules/treatment/components/asesoria-macro-panel.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain('"use client"');
    expect(COMPONENTE).toContain("asesoriaFuera(escrito, asesoria)");
  });

  it("el aviso NO usa la capa clínica de color", () => {
    // `--clinical-*` pinta un VEREDICTO sobre una persona y sus hexadecimales salen de los clasificadores
    // de Gildardo. "Esta cifra quedó fuera del rango" es operativo, no un juicio sobre el paciente.
    const COMPONENTE = readFileSync(
      "src/modules/treatment/components/asesoria-macro-panel.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("text-attention");
    // SE MIRA EL CODIGO, NO LOS COMENTARIOS, y el primer intento de este caso salio rojo por su propia
    // prosa: el bloque que EXPLICA por que no se usa la capa clinica menciona `--clinical-*`. Una
    // asercion sobre el texto crudo del archivo confunde lo que el componente HACE con lo que dice.
    const codigo = COMPONENTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(codigo).not.toMatch(/--clinical-|text-clinical-/);
  });

  it("el conflicto se pinta distinto de 'sin rango', que es lo que hay que preservar", () => {
    // `rango` viene null CUANDO HAY CONFLICTO: dos condiciones del paciente piden rangos que no se
    // solapan. Si el componente tratara los dos casos igual, un conflicto se vería como ausencia de dato
    // y el profesional no sabría que hay una decisión que le toca a él.
    const COMPONENTE = readFileSync(
      "src/modules/treatment/components/asesoria-macro-panel.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("asesoria.conflicto ?");
    expect(COMPONENTE).toContain("Dos condiciones piden rangos que no coinciden");
  });
});

describe("7 · el panel SALE SIEMPRE, que es su palabra", () => {
  // SU INSTRUCCION ES LITERAL (3-sep, punto 5): "Junto a los campos de proteína y grasa, un panel que
  // sale **siempre** y dice, según el diagnóstico del paciente, qué rango recomienda cada condición".
  //
  // Y NUESTRO COMPONENTE TIENE UNA GUARDA QUE PODRIA INCUMPLIRLA: `if (!asesoria || items.length === 0)
  // return null`. La guarda es defensiva y esta bien tenerla, pero mientras nadie compruebe que su
  // funcion NUNCA devuelve la lista vacia, esa linea es una via silenciosa por la que el panel
  // desaparece. Un paciente sin condiciones no veria nada, y "no veo nada" se lee como "no hay
  // recomendacion", que es lo contrario de lo que este panel existe para decir.
  //
  // Lo que se afirma aqui es que la guarda es CODIGO MUERTO: su funcion siempre trae al menos un item,
  // porque los dos macros terminan con un `if (!it.length) add("Sin condiciones que lo modifiquen", ...)`.
  // Si algun dia deja de ser cierto, este caso se pone rojo ANTES de que un profesional vea el hueco.
  const sano = {
    d5_39: [],
    d5_36: "No",
  } as unknown as Record<string, unknown>;
  const bis = { peso: 70, talla: 170, edad: 40, sexo: "F" } as unknown as Record<string, unknown>;

  it("un paciente SIN ninguna condición igual recibe un item, en los dos macros", () => {
    for (const macro of ["prot", "grasa"] as const) {
      const a = asesoriaMacro(sano, bis, macro) as { items: unknown[]; rango: unknown };
      expect(a.items.length, `${macro}: la lista vacia haria desaparecer el panel`).toBeGreaterThan(0);
      expect(a.rango, `${macro}: sin conflicto tiene que haber rango`).not.toBeNull();
    }
  });

  it("y ese item es su texto de 'sin condiciones', no uno nuestro", () => {
    // CONTROL DE PROCEDENCIA: sin esto, el caso de arriba pasaria verde tambien si el item viniera de un
    // relleno nuestro. El texto y la fuente son suyos, verbatim.
    const a = asesoriaMacro(sano, bis, "prot") as {
      items: { cond: string; min: number; max: number; fuente: string }[];
    };
    const base = a.items.find((i) => i.cond === "Sin condiciones que lo modifiquen");
    expect(base, "su texto de base no aparece").toBeTruthy();
    expect([base?.min, base?.max]).toEqual([0.8, 0.8]);
    expect(base?.fuente).toBe("OMS/FAO/UNU 2007");
  });

  it("la guarda del componente solo puede dispararse por `asesoria` null, no por lista vacía", () => {
    // Se deja escrito que la guarda TIENE dos mitades y que solo una es alcanzable: `asesoria` null (sin
    // snapshot compatible, o sin composicion), que es cuando no hay diagnostico del que derivar un rango
    // y no hay panel que mostrar. La otra mitad la cubren los dos casos de arriba.
    const COMPONENTE = readFileSync(
      "src/modules/treatment/components/asesoria-macro-panel.tsx",
      "utf8",
    );
    expect(COMPONENTE).toContain("if (!asesoria || asesoria.items.length === 0) return null;");
  });
});

describe("8 · la rama de la EDAD, que estaba muerta y en silencio", () => {
  // HALLAZGO DEL BARRIDO DEL 2026-09-04, y es un defecto NUESTRO del cableado del mismo dia.
  //
  // Su `asesoriaMacro` lee `e.edad || b.edad` y con edad >= 65 agrega "65 años o más" (1,0-1,2 g/kg).
  // Pero `buildEnc` arma el `enc` SOLO con las respuestas de la encuesta más `sexo`, y el `bis` son los
  // indicadores del snapshot, que tampoco traen la edad. **La rama no se alcanzaba nunca.**
  //
  // Y lo que la vuelve grave no es que faltara un item, es CUÁL faltaba: en un paciente mayor con ERC,
  // la rama renal tira hacia abajo (0,6-0,8) y la de la edad hacia arriba (1,0-1,2). Sin la edad, el
  // panel mostraba SOLO la mitad que baja, con su rango limpio y sin conflicto. Al profesional se le
  // ocultaba justo la mitad que le habría hecho dudar.
  //
  // Nada daba error: `Number(undefined) || 0` es 0, y 0 no es >= 65. Es la familia de "un porte que lee
  // la encuesta falla en silencio por la FORMA del enc".
  const mayorConErc = {
    enc: { d5_39: ["Enfermedad renal crónica"], sexo: "M" } as Record<string, unknown>,
    bis: { sexo: "M", peso: 70, talla: 170, FFMI: 20, FMI: 5, ASMI: 8 } as Record<string, unknown>,
  };

  it("SIN edad sale un solo rango y sin conflicto: el caso que estaba pasando", () => {
    const a = asesoriaMacro(mayorConErc.enc, mayorConErc.bis, "prot") as Ases;
    expect(a.items.map((i) => i.cond)).toEqual(["ERC sin diálisis"]);
    expect(a.conflicto).toBe(false);
  });

  it("CON edad 70 salen los dos y el conflicto aparece", () => {
    const a = asesoriaMacro(mayorConErc.enc, { ...mayorConErc.bis, edad: 70 }, "prot") as Ases;
    expect(a.items.map((i) => i.cond)).toEqual(["ERC sin diálisis", "65 años o más"]);
    expect(a.conflicto).toBe(true);
    expect(a.rango).toBeNull();
  });

  it("y el CABLE existe: el lector la pide y la página se la pasa", () => {
    // EL CANDADO VA SOBRE EL SITIO DE LLAMADA, no sobre la función: los dos casos de arriba pasaban
    // verdes mientras nadie le pasaba la edad. Que su motor sepa usarla no sirve de nada si no llega.
    const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");
    const bloque = READER.slice(READER.indexOf("export async function getAsesoriaMacros"));
    expect(bloque, "el lector tiene que pedirla en su firma").toContain("edad: number | null");
    expect(bloque, "y tiene que meterla en el bis que le pasa a su motor").toContain(
      "edad != null && edad > 0 ? { ...base, edad } : base",
    );
    const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
    const llamada = PAGE.slice(PAGE.indexOf("await getAsesoriaMacros("));
    expect(llamada.slice(0, 700), "la página tiene que pasarla").toContain("hcHeader?.edad ?? null");
  });

  it("sin fecha de nacimiento NO se supone una edad, y el resto sigue saliendo", () => {
    // `null` es distinto de 0: no se inventa una edad, la rama simplemente no corre. Y lo que importa es
    // que el panel NO se cae por eso: las demás condiciones siguen mostrándose.
    const a = asesoriaMacro(mayorConErc.enc, { ...mayorConErc.bis, edad: 0 }, "prot") as Ases;
    expect(a.items.map((i) => i.cond)).toEqual(["ERC sin diálisis"]);
    expect(a.rango).toEqual([0.6, 0.8]);
  });
});
