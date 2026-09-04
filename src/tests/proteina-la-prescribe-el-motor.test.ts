import { describe, expect, it } from "vitest";

import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import {
  computeProtocoloEfectivo,
  type ProtocoloAjustes,
  type ProtocoloSnapshot,
} from "@/clinical-engine/protocolo";

// LA PROTEINA LA PRESCRIBE EL MOTOR (Gildardo, §9.6 punto 4 del 2026-09-02):
//
//   "La proteína la prescribe el motor -1 g/kg, no el mínimo poblacional de 0,8- sobre el peso meta que
//    fije el nutricionista."
//
// Es su respuesta a una divergencia que le reportamos, y hasta ese dia se veia en pantalla: el bloque de
// la prescripcion decia 1 g/kg (lo que prescribe `motorTratNutri`) y la cadena calorica calculaba con 0,8
// (el `protMin` de `motorProtocolo`). Dos gramajes del mismo concepto, para el mismo paciente, a la vez.
//
// LA DIFERENCIA NO ES DE CIFRA, ES DE NATURALEZA: `protMin` es un MINIMO poblacional; `protKg` es una
// PRESCRIPCION. Por eso la respuesta no es "subir 0,8 a 1,0" sino cambiar de donde sale.

const SIN_AJUSTES: ProtocoloAjustes = {
  geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null,
};

/** Snapshot minimo con lo que la cadena efectiva necesita. `mtn` se pone o no segun el caso. */
function snap(over: Partial<ProtocoloSnapshot> = {}): ProtocoloSnapshot {
  return {
    protocolEngineVersion: "anibise-protocolo-2026-09-03",
    _nota: "",
    fenotipo: { id: "F5", nombre: "" } as ProtocoloSnapshot["fenotipo"],
    obesidadSarcopenica: false,
    pesoCalculo: 80,
    pesoCalculoLabel: "",
    PI: 70,
    estrategia: { tipo: "", deficit: 0, label: "", color: "", ref: "", perfil: "" },
    protMin: 0.8,
    protMax: 1.2,
    protRef: "",
    restricciones: [],
    examenes: [],
    suplementacion: [],
    resumenClinico: "",
    alertaSindRealim: false,
    flags: { tieneIRC: false, tieneCancer: false, tieneDM: false, tieneHTA: false },
    caloricoInputs: { ffm: 60, talla: 175, edad: 40, sexoM: true },
    calorico: {} as ProtocoloSnapshot["calorico"],
    ...over,
  };
}

describe("la cascada de la proteína: cuatro fuentes, y cada una se declara", () => {
  // LOS TRES CASOS SON EL PUNTO, no un caso con variantes. Con uno solo, el verde no distingue "la
  // cascada funciona" de "todo cae al mismo sitio": son exactamente los dos mundos que hay que separar.

  it("1 · SELLADO: si el snapshot trae la del motor, manda esa", () => {
    const ef = computeProtocoloEfectivo(snap({ mtn: { protKg: 1.3 } }), SIN_AJUSTES);
    expect(ef.protFuente).toBe("sellado");
    expect(ef.calorico.protGKg).toBe(1.3);
    expect(ef.calorico.protG).toBe(Math.round(1.3 * 80));
  });

  it("2 · MOTOR: si el snapshot es anterior al sellado, la aporta el caller", () => {
    // Este es el caso de los 60 tratamientos que ya existen: `protocol_suggested` es write-once (trigger
    // 0026) incluso en borrador, asi que no se pueden rellenar. Sin esta rama, el defecto seguiria vivo
    // justo en los pacientes que hoy ven las dos cifras.
    const ef = computeProtocoloEfectivo(snap(), SIN_AJUSTES, { protKgVigente: 1.3 });
    expect(ef.protFuente).toBe("motor");
    expect(ef.calorico.protGKg).toBe(1.3);
  });

  it("3 · PROFESIONAL: su ajuste gana sobre las dos", () => {
    const ef = computeProtocoloEfectivo(
      snap({ mtn: { protKg: 1.3 } }),
      { ...SIN_AJUSTES, protGkg: 1.8 },
      { protKgVigente: 1.0 },
    );
    expect(ef.protFuente).toBe("profesional");
    expect(ef.calorico.protGKg).toBe(1.8);
  });

  it("4 · protMin, el último recurso: sin sellado y sin motor, y se DICE", () => {
    // No se elimina porque dejar la pantalla sin proteina seria peor. Lo que no puede es ser mudo: una
    // fuente que se degrada sin decirlo se lee como decision.
    const ef = computeProtocoloEfectivo(snap(), SIN_AJUSTES);
    expect(ef.protFuente).toBe("protMin");
    expect(ef.calorico.protGKg).toBe(0.8);
  });

  it("y el sellado le gana al del caller, que es lo que hace reproducible un tratamiento viejo", () => {
    // CONTROL del orden. Si el caller pudiera pisar lo sellado, la cifra de un tratamiento dependeria de
    // cuando se abre la pantalla y no de cuando se diagnostico.
    const ef = computeProtocoloEfectivo(snap({ mtn: { protKg: 1.3 } }), SIN_AJUSTES, {
      protKgVigente: 0.9,
    });
    expect(ef.calorico.protGKg).toBe(1.3);
  });
});

describe("los dos perfiles donde una proteína equivocada duele más", () => {
  // ESTE BLOQUE SE DIO VUELTA EL 2026-09-04, y el motivo es que Gildardo revirtió la decisión que
  // vigilaba. Su entrega del 3 de septiembre, confirmada en su respuesta del 4, RETIRA del motor toda la
  // prescripción de proteína: `protKg` sale siempre 0,8 y el profesional la mueve en su campo editable.
  //
  // Su motivo, textual: "el motor no puede distinguir un dato escrito a propósito de un campo mal
  // borrado, y la cadena por patología convertía esa ambigüedad en gramos prescritos. La solución no fue
  // ponerle un piso al campo: fue quitarle al motor la pretensión de saber".
  //
  // LAS ASERCIONES NO SE RELAJAN, SE INVIERTEN: los mismos dos pacientes, y lo que se afirma ahora es que
  // el motor NO les impone cifra. Y el criterio clínico que imponía no se pierde: pasó al panel de
  // referencia (`asesoria-macro.test.ts`), que muestra el rango de cada condición al profesional en el
  // momento de decidir, sin escoger por él.
  const bis = (over: Record<string, unknown> = {}) => ({
    sexo: "F", edad: 62, peso: 43.7, talla: 155, FMI: 2.997, FFMI: 15.19, ASMI: 5.2, ...over,
  });

  it("DESNUTRICIÓN (F10, IMC 18,2): el motor ya NO impone 1,5", () => {
    // Antes esta rama fijaba 1,5. Ahora sale 0,8 como todos, y el 1,2-1,5 de la desnutrición se le
    // MUESTRA al profesional en el panel, con su mecanismo (ESPEN 2015 / GLIM 2019).
    const m = motorTratNutri({ sexo: "F", d5_39: ["Ninguna"] }, bis(), {}) as { protKg: number };
    expect(m.protKg).toBe(0.8);
  });

  it("ERC (F10 + insuficiencia renal): tampoco impone 0,7, y conserva la NOTA", () => {
    // La distinción que él marcó al retirarla: la nota se queda porque ADVIERTE DE UN DAÑO; la cifra y el
    // atributo "Proteína controlada 0,6-0,8" salen, como el resto de las recomendaciones proteicas.
    const m = motorTratNutri(
      { sexo: "F", d5_39: ["Insuficiencia renal", "HTA"] },
      bis(),
      {},
    ) as { protKg: number; attrs: string[]; notas: string[] };
    expect(m.protKg).toBe(0.8);
    expect(m.attrs).toContain("Nefroprotectora");
    expect(m.attrs, "el atributo con la cifra tenía que salir").not.toContain(
      "Proteína controlada 0,6-0,8 g/kg",
    );
    expect(m.notas.join(" ")).toContain("bajo guía de nefrología");
  });

  it("y con las dos condiciones tampoco hay precedencia que resolver: no hay cifras que compitan", () => {
    // Antes esto era un control de precedencia (la rama renal tenía que ir ÚLTIMA o un desnutrido con ERC
    // recibía 1,5). Ya no hay ramas que impongan cifra, así que el conflicto se trasladó al panel, que lo
    // DECLARA en vez de resolverlo: ahí ERC (0,6-0,8) y desnutrición (1,2-1,5) salen como conflicto.
    const m = motorTratNutri(
      { sexo: "F", d5_39: ["Insuficiencia renal"] },
      bis(),
      {},
    ) as { protKg: number };
    expect(m.protKg).toBe(0.8);
  });

  it("CONTROL NEGATIVO: sin peso ni talla el motor NO da error, contesta con sus defaults", () => {
    // Esto NO es un caso de uso: es la trampa en la que cai al medir el impacto contra la base. Mi script
    // le paso un `bis` sin peso ni talla (el snapshot del reporte no los trae) y el motor uso sus propios
    // defaults (70 kg / 170 cm), o sea IMC 24,2: ni desnutricion ni obesidad, y devolvio 1,0 para TODOS.
    // Con eso "medi" que al paciente de cancer le bajaba la proteina de 1,5 a 1,0, y era falso.
    // Queda escrito porque el defecto no fue de calculo sino de INSUMO, y no da error: contesta.
    const m = motorTratNutri({ sexo: "F", d5_39: ["Ninguna"] }, { sexo: "F" }, {}) as {
      protKg: number;
      geb: number;
    };
    // La cifra ya no distingue (todos salen en 0,8 desde su entrega del 3), pero LA TRAMPA SIGUE VIVA y
    // por eso el caso se queda: sin peso ni talla el motor usa 70 kg / 170 cm y contesta igual, sin dar
    // error. Lo que hoy se falsearia no es la proteina sino el GASTO BASAL y con el todo el objetivo
    // calorico, que es peor. El defecto no es de calculo, es de INSUMO.
    expect(m.protKg).toBe(0.8);
    expect(m.geb, "con defaults contesta un gasto basal que no es de este paciente").toBeGreaterThan(0);
  });
});
