import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Modulo congelado en JS. `allowJs` lo resuelve, asi que NO lleva ts-expect-error: ponerlo hacia que
// tsc fallara por directiva inutil, que es un rojo que no dice nada.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";

// CANDADO DE motorTratNutri. Dos niveles, como con CAP_REF:
//   1. TRANSCRIPCION: el archivo portado es byte a byte el rango de su archivo. Se coteja, no se cree.
//   2. COMPORTAMIENTO: los casos que fijan las tres correcciones de su Parte 1 (2026-08-26), para que
//      una regresion futura no las deshaga en silencio.

const RUTA = "docs/entregas/Gildardo responses/html actualizado 28 agosto/ATLAS_v8.html";

const enc = (extra: Record<string, unknown> = {}) => ({
  sexo: "F",
  edad: 60,
  d5_39: [] as string[],
  d5_38: [] as string[],
  d2_21: [] as string[],
  ...extra,
});
const bis = (extra: Record<string, unknown> = {}) => ({ sexo: "F", talla: 150, peso: 60, edad: 60, ...extra });

describe("motorTratNutri: transcripción verbatim del archivo de Gildardo", () => {
  it("el módulo portado contiene el rango L15630-15744 sin una sola diferencia", () => {
    const fuente = readFileSync(RUTA, "utf8").split(/\r?\n/).slice(15629, 15744).join("\n");
    const portado = readFileSync("src/clinical-engine/frozen/atlas-tratamiento-nutri.js", "utf8");
    // El portado lleva cabecera propia y el module.exports final; el CUERPO tiene que ser identico.
    expect(portado).toContain(fuente);
    expect(fuente.startsWith("function motorTratNutri")).toBe(true);
  });
});

describe("motorTratNutri: las tres correcciones de su Parte 1 (2026-08-26)", () => {
  it("1 · el déficit por defecto es CERO, no 500", () => {
    // El gasto sobre el peso meta YA ES la ingesta que lleva a ese peso; restarle 500 encima aplicaba un
    // segundo descuento sobre el primero (hasta 926 kcal por debajo del mantenimiento, en su propio caso).
    expect(motorTratNutri(enc(), bis(), {}).deficit).toBe(0);
  });

  it("2 · el GEB se calcula sobre el PESO META, no sobre el peso actual", () => {
    // Mujer 150 cm, 60 kg: peso ideal 50, IMC 26,7 -> peso meta = 50. Mifflin sobre 50 kg da 977.
    // Sobre los 60 kg reales daria 1.077: la diferencia es la prueba de que usa el meta.
    expect(motorTratNutri(enc(), bis(), {}).geb).toBe(977);
  });

  it("3 · la proteína se SEPARA: desnutrición 1,5 y cáncer 1,25", () => {
    // Antes compartian rama con protKg = 1.25 para los dos. Desnutricion recupera el rango alto que sus
    // fenotipos F7 y F10 siempre tuvieron.
    const desnutrida = motorTratNutri(enc(), bis({ peso: 38 }), {}); // IMC 16,9
    expect(desnutrida.protKg).toBe(1.5);
    const conCancer = motorTratNutri(enc({ d5_39: ["Cáncer"] }), bis(), {});
    expect(conCancer.protKg).toBe(1.25);
  });

  it("3b · la nota de realimentación viaja SOLO con desnutrición, no con cáncer", () => {
    // Es lo que protege al paciente mas fragil de los dos, y el pidio expresamente vigilar que no se
    // perdiera al separar la rama.
    const desnutrida = motorTratNutri(enc(), bis({ peso: 38 }), {});
    const conCancer = motorTratNutri(enc({ d5_39: ["Cáncer"] }), bis(), {});
    const tieneNota = (r: { notas: string[] }) => r.notas.some((n) => /realimentaci/i.test(n));
    expect(tieneNota(desnutrida)).toBe(true);
    expect(tieneNota(conCancer)).toBe(false);
  });
});

describe("motorTratNutri: el piso de 1.500/1.200 (PREGUNTA ABIERTA, no se toca)", () => {
  // ESTE BLOQUE FIJA LO QUE EL MOTOR HACE HOY, NO LO QUE CREEMOS QUE DEBERIA HACER.
  //
  // El piso esta guardado tras `if(deficit>0)`, asi que con el deficit en cero NO SE ACTIVA NUNCA. Le
  // preguntamos a Gildardo si moverlo fuera de esa condicion (ronda 2026-08-26, pregunta 2). Hasta que
  // responda, el candado describe el comportamiento observado y CITA la pregunta: escribirlo sobre
  // nuestra suposicion convertiria la suposicion en regla, y el verde dejaria de significar "correcto"
  // para significar "coincide con lo que supuse".
  //
  // CUANDO RESPONDA: si dice que el piso debe aplicar siempre, estos dos casos se invierten y se anota
  // su decision al lado. Que se pongan rojos ese dia es la senal de que hay que venir aqui.

  it("con déficit CERO el piso NO se aplica: prescribe 1.172 con un piso de 1.200", () => {
    const r = motorTratNutri(enc(), bis(), { fa_nivel: "sedentario" });
    expect(r.get).toBe(1172);
    expect(r.kcalObjetivo).toBe(1172); // por debajo de su piso de 1.200, sin corregir
  });

  it("y la consecuencia absurda: poner un déficit de 300 le SUBE el objetivo a 1.200", () => {
    // Pedirle que coma 300 menos hace que el sistema le prescriba 28 mas, porque solo al haber deficit
    // aparece el piso que la protege. Es el argumento de la pregunta 2, fijado como caso.
    const sinDeficit = motorTratNutri(enc(), bis(), { fa_nivel: "sedentario" });
    const conDeficit = motorTratNutri(enc(), bis(), { fa_nivel: "sedentario", deficit: 300 });
    expect(sinDeficit.kcalObjetivo).toBe(1172);
    expect(conDeficit.kcalObjetivo).toBe(1200);
    expect(conDeficit.kcalObjetivo).toBeGreaterThan(sinDeficit.kcalObjetivo);
  });
});

describe("motorTratNutri: comportamiento que NO cambia y conviene fijar", () => {
  it("sin factor de actividad resuelto, cae en 'ligera' (1,375), no en sedentario", () => {
    // Importa saberlo: el caso del piso solo se ve si el profesional elige sedentario. Con el default,
    // esa misma paciente sale en 1.343 y el piso no hace falta. Un caso escrito sin esto no reproduce.
    const r = motorTratNutri(enc(), bis(), {});
    expect(r.faNivel).toBe("ligera");
    expect(r.fa).toBe(1.375);
  });

  it("la salvaguarda de TCA AVISA y no bloquea (corrección del 9-ago-2026)", () => {
    // Antes ponia el deficit en cero y forzaba normocalorica; eso arrebataba al profesional una decision
    // que es suya. Ahora levanta la alerta y marca remision, y el deficit sigue siendo del profesional.
    const r = motorTratNutri(enc({ d2_21: ["Me provoco vómito"] }), bis(), {});
    expect(r.alertaTCA).toBe(true);
  });

  it("la ERC manda sobre la proteína alta: 0,7 g/kg aunque haya sarcopenia", () => {
    const r = motorTratNutri(enc({ d5_39: ["Enfermedad renal crónica"] }), bis(), {});
    expect(r.protKg).toBe(0.7);
  });
});
