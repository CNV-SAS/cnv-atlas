import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  computeProtocoloEfectivo,
  type ProtocoloAjustes,
  type ProtocoloSnapshot,
} from "@/clinical-engine/protocolo";

// EL PACIENTE RECIBE LA PROTEINA QUE SU PROFESIONAL FIJO, no la que prescribe el modelo.
//
// EL DEFECTO (smoke de Santiago, 2026-09-03). Escribio 3 g/kg en la calculadora, su pantalla decia 3, y el
// plan del paciente decia 1: la del motor. Las cifras del plan salian enteras de `getPrescripcionNutricional`
// y el ajuste del profesional no llegaba a ninguna.
//
// POR LOS CUATRO CAMINOS A LA VEZ, porque los cuatro salen del mismo lector: el plan impreso, el PDF de la
// ruta `/reportes/[id]/pdf`, y las DOS llamadas de `send-report`. O sea que tambien iba mal en el correo
// que se le manda al paciente.
//
// Y NO LO ARREGLO EL PARCHE DEL DIA ANTERIOR, que es lo que este candado tiene que impedir que se repita:
// aquel cableo `protKgVigente` a `computeProtocoloEfectivo`, que alimenta el objetivo calorico y el peso.
// La proteina IMPRESA nunca miraba esa cadena. El arreglo estaba en el archivo correcto y sobre el valor
// equivocado, y por eso un caso que solo probara "el reader pasa protKgVigente" habria seguido verde.
//
// POR ESO EL CANDADO MIRA EL SITIO DE LLAMADA y no la funcion: lo que hay que garantizar es que la cifra
// que se IMPRIME salga de la cadena efectiva.

const LECTOR = readFileSync("src/modules/reports/data/plan-paciente-reader.ts", "utf8");

const SIN_AJUSTES: ProtocoloAjustes = {
  geb: null, pal: null, kcalObj: null, protGkg: null, fatPct: null, deficit: null, pesoMeta: null,
};

function snap(): ProtocoloSnapshot {
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
    mtn: { protKg: 1 },
    calorico: {} as ProtocoloSnapshot["calorico"],
  };
}

describe("la proteína del plan del paciente sale de la cadena EFECTIVA", () => {
  it("el ajuste del profesional gana sobre lo que prescribe el motor", () => {
    // El caso exacto del smoke: el motor prescribe 1 y el profesional escribe 3.
    const ef = computeProtocoloEfectivo(snap(), { ...SIN_AJUSTES, protGkg: 3 });
    expect(ef.protFuente).toBe("profesional");
    expect(ef.calorico.protGKg).toBe(3);
    // CONTROL: sin el ajuste, la misma cadena da la del motor. Sin esto, el caso de arriba pasaria verde
    // aunque la cascada devolviera siempre 3.
    expect(computeProtocoloEfectivo(snap(), SIN_AJUSTES).calorico.protGKg).toBe(1);
  });

  it("EL LECTOR imprime la efectiva, no la del motor", () => {
    // CANDADO SOBRE EL SITIO DE LLAMADA. La funcion pura ya estaba bien el dia que fallo: lo que estaba
    // mal era de donde tomaba la cifra el documento.
    expect(LECTOR).toContain("const protGKgEfectiva = efectivo.calorico.protGKg;");
    expect(LECTOR).toContain("const protGEfectiva = Math.round(efectivo.calorico.protG);");
    // La fila de la prescripcion se reescribe con la efectiva.
    expect(LECTOR).toContain('f.nombre === "Proteína"');
    expect(LECTOR).toContain("${String(protGKgEfectiva).replace");
    // Y las recomendaciones tambien: el texto habla de la proteina que este paciente tiene prescrita.
    expect(LECTOR).toContain("protKg: protGKgEfectiva");
    expect(LECTOR).toContain("protG: protGEfectiva");
  });

  it("y NO quedan las del motor alimentando lo que se imprime", () => {
    // El defecto exacto que se cierra: si estas dos vuelven, el ajuste del profesional deja de llegarle
    // al paciente y nada truena. Es la forma que ya se nos escapo una vez.
    expect(LECTOR).not.toContain("protKg: prescripcion?.protKg");
    expect(LECTOR).not.toContain("protG: prescripcion?.protG");
  });

  it("y los cuatro documentos salen de este lector, que es por lo que el defecto iba a los cuatro", () => {
    // CONTROL DE ALCANCE: sin esto, alguien podria arreglar el lector y dejar otro camino leyendo el motor.
    // Si aparece un quinto consumidor, este caso obliga a mirarlo.
    const consumidores = [
      "src/app/(app)/evaluaciones/[id]/page.tsx",
      "src/app/(app)/reportes/[id]/pdf/route.ts",
      "src/modules/reports/services/send-report.ts",
    ];
    for (const f of consumidores) {
      expect(readFileSync(f, "utf8"), `${f} deberia leer el plan de getPlanPaciente`).toContain(
        "getPlanPaciente",
      );
    }
  });
});
