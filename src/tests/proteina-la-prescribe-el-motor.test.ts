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
  // Los dos existen HOY en la base (F10 con IMC 18,2 y F10 con insuficiencia renal, ambos 43,7 kg / 155
  // cm), y son los que Santiago pidio verificar antes de aplicar el cambio. Se corre el motor CONGELADO
  // con sus datos, que es lo unico que decide: la cascada no calcula, solo elige la fuente.
  const bis = (over: Record<string, unknown> = {}) => ({
    sexo: "F", edad: 62, peso: 43.7, talla: 155, FMI: 2.997, FFMI: 15.19, ASMI: 5.2, ...over,
  });

  it("DESNUTRICIÓN (F10, IMC 18,2): el motor prescribe 1,5, igual que el mínimo. NO se mueve", () => {
    // 43,7 / 1,55² = 18,19, por debajo de 18,5. La rama de desnutricion de su motor toma el extremo
    // inferior del rango que `motorProtocolo` ya asigna a F7/F10 (1,5-2,0), que es exactamente el 1,5 que
    // este paciente tiene sellado. Las dos fuentes coinciden y la prescripcion no cambia.
    const m = motorTratNutri({ sexo: "F", d5_39: ["Ninguna"] }, bis(), {}) as { protKg: number };
    expect(m.protKg).toBe(1.5);
  });

  it("ERC (F10 + insuficiencia renal): pasa de 0,6 a 0,7, y el 0,7 es de SU motor", () => {
    // ESTE SI SE MUEVE, y hay que decirlo con su numero: `motorProtocolo` devuelve 0,6 para cualquier IRC
    // (el extremo INFERIOR del rango), y la rama renal de `motorTratNutri` fija 0,7 declarando el rango
    // "Proteína controlada 0,6-0,8 g/kg", o sea su punto medio. En 43,7 kg son 4 gramos al dia.
    // No es una eleccion nuestra: las dos cifras son suyas, y su §9.6 dice cual manda.
    const m = motorTratNutri(
      { sexo: "F", d5_39: ["Insuficiencia renal", "HTA"] },
      bis(),
      {},
    ) as { protKg: number; attrs: string[] };
    expect(m.protKg).toBe(0.7);
    expect(m.attrs).toContain("Proteína controlada 0,6-0,8 g/kg");
  });

  it("y la ERC manda sobre la desnutrición: el mismo paciente con las dos da 0,7", () => {
    // CONTROL de precedencia, que es donde una proteina equivocada haria dano de verdad: si la rama
    // renal no se aplicara ULTIMA, un desnutrido con ERC recibiria 1,5 g/kg.
    const m = motorTratNutri(
      { sexo: "F", d5_39: ["Insuficiencia renal"] },
      bis(),
      {},
    ) as { protKg: number };
    expect(m.protKg).toBe(0.7);
  });

  it("CONTROL NEGATIVO: sin peso ni talla el motor cae a sus defaults y contesta 1,0", () => {
    // Esto NO es un caso de uso: es la trampa en la que cai al medir el impacto contra la base. Mi script
    // le paso un `bis` sin peso ni talla (el snapshot del reporte no los trae) y el motor uso sus propios
    // defaults (70 kg / 170 cm), o sea IMC 24,2: ni desnutricion ni obesidad, y devolvio 1,0 para TODOS.
    // Con eso "medi" que al paciente de cancer le bajaba la proteina de 1,5 a 1,0, y era falso.
    // Queda escrito porque el defecto no fue de calculo sino de INSUMO, y no da error: contesta.
    const m = motorTratNutri({ sexo: "F", d5_39: ["Ninguna"] }, { sexo: "F" }, {}) as {
      protKg: number;
    };
    expect(m.protKg).toBe(1);
  });
});
