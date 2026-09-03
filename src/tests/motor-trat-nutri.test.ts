import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Modulo congelado en JS. `allowJs` lo resuelve, asi que NO lleva ts-expect-error: ponerlo hacia que
// tsc fallara por directiva inutil, que es un rojo que no dice nada.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { funcionDelHtml, HTML_DE_NUESTRO_PORTE } from "./fixtures/html-vigente";

// CANDADO DE motorTratNutri. Dos niveles, como con CAP_REF:
//   1. TRANSCRIPCION: el archivo portado es byte a byte el rango de su archivo. Se coteja, no se cree.
//   2. COMPORTAMIENTO: los casos que fijan las tres correcciones de su Parte 1 (2026-08-26), para que
//      una regresion futura no las deshaga en silencio.


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
  it("el módulo portado contiene su función entera, sin una sola diferencia", () => {
    // POR NOMBRE, NO POR RANGO DE LINEAS, y el cambio tiene motivo: estaba anclado a L15630-15744 del
    // archivo del 28; el del 29 metio 12 lineas de comentario mas arriba y el rango dejo de cubrir la
    // funcion. Un rango es una POSICION y se desincroniza en cuanto el autor inserta algo; el nombre no.
    // Y la ENTREGA tambien se deriva ahora (ver html-vigente-lock.test.ts): este test seguia mirando la
    // del 28, y por eso nadie vio que faltaba portar la correccion del piso calorico.
    // CONTRA LA ENTREGA QUE NUESTRO PORTE REFLEJA, no contra la vigente: su entrega del 3-sep retira de
    // este motor toda la prescripcion de proteina, y no se porta hasta que confirme (ver la razon entera
    // en `HTML_DE_NUESTRO_PORTE`, y la divergencia declarada en `frozen-deriva-vigente`).
    const fuente = funcionDelHtml("motorTratNutri", HTML_DE_NUESTRO_PORTE);
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
    // LA GARANTIA NO CAMBIA, LA FORMULA SI (2026-09-02). Seguia siendo Mifflin sobre el peso meta (977);
    // ahora es HARRIS-BENEDICT sobre el peso meta, que es la formula del PROPIO EQUIPO: su §9.6, medida
    // sobre once mediciones reales, 20 kcal de error medio contra los 71 de Mifflin. Lo que este caso
    // protege es lo mismo de siempre: que el gasto se calcule sobre el peso META y no sobre el actual.
    //
    // Mujer de 60 años, 150 cm, 60 kg: peso ideal 50, IMC 26,7 -> peso meta = 50.
    const r = motorTratNutri(enc(), bis(), {}) as { geb: number };
    const hbSobreLaMeta = Math.round(655.0955 + 9.5634 * 50 + 1.8496 * 150 - 4.6756 * 60);
    const hbSobreElActual = Math.round(655.0955 + 9.5634 * 60 + 1.8496 * 150 - 4.6756 * 60);
    expect(r.geb).toBe(hbSobreLaMeta);
    // Y LA DIFERENCIA ES LA PRUEBA: sobre los 60 kg reales daria casi cien kcal mas.
    expect(r.geb).not.toBe(hbSobreElActual);
    expect(hbSobreElActual - hbSobreLaMeta).toBeGreaterThan(90);
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

describe("motorTratNutri: el piso de 1.500/1.200 (RESPONDIDA, y los dos casos se invirtieron)", () => {
  // ESTE BLOQUE NACIO FIJANDO LO QUE EL MOTOR HACIA, con la nota de que se pondria rojo el dia que
  // Gildardo respondiera. RESPONDIO (2026-08-27, punto 2) y el dia llego: los dos casos estan
  // invertidos y esta es su decision, ya no una observacion nuestra.
  //
  // Textual: "Tienen toda la razon, y encontraron exactamente lo que les pedi que buscaran. Al pasar el
  // deficit a cero no mire de que colgaba el piso, y lo deje sin activarse nunca". Reprodujo nuestro
  // mismo caso y la paradoja del deficit que subia el objetivo. La condicion pasa de `deficit>0` a
  // `!hasCancer && !desnutricion`: el piso protege la via calculada SIEMPRE.
  //
  // POR QUE LA SALVEDAD DE CANCER Y DESNUTRICION NO ES UN OLVIDO: es suya y es explicita. Esa rama usa
  // 27,5 kcal x peso actual y su nota manda iniciar a 10-15 kcal/kg si hay riesgo de realimentacion.
  // Un piso de 1.200-1.500 empujaria por encima de ese protocolo justo al paciente mas fragil.

  it("con déficit CERO el piso se aplica cuando el gasto queda por debajo", () => {
    // LAS CIFRAS SE MOVIERON CON EL CAMBIO DE FORMULA (2026-09-02), la garantía no. Con Mifflin, esta
    // paciente daba un gasto de 1.172 y el piso la subía a 1.200. Con Harris-Benedict —la del propio
    // equipo— su gasto sube a 1.356, así que **ya no necesita el piso**: y eso es información, no un
    // fallo del caso. Lo que el caso prueba sigue siendo lo mismo: el piso NO cuelga del déficit.
    const r = motorTratNutri(enc(), bis(), { fa_nivel: "sedentario" }) as {
      get: number;
      kcalObjetivo: number;
    };
    expect(r.get).toBeGreaterThan(1200);
    expect(r.kcalObjetivo).toBe(r.get); // por encima del piso, el objetivo ES el gasto

    // Y EL CASO QUE SÍ LO EJERCITA, para que el piso no quede sin probar al subir la fórmula: una mujer
    // más pequeña y mayor, cuyo gasto sí queda por debajo de su piso de 1.200.
    const chica = motorTratNutri(enc({ edad: 78 }), bis({ talla: 145, peso: 44, edad: 78 }), {
      fa_nivel: "sedentario",
    }) as { get: number; kcalObjetivo: number };
    expect(chica.get, "el caso dejó de ejercitar el piso").toBeLessThan(1200);
    expect(chica.kcalObjetivo).toBe(1200);
  });

  it("y la consecuencia absurda desaparecio: con y sin déficit da lo mismo, no MAS", () => {
    // Antes, pedirle que comiera 300 menos le prescribia 28 mas. Ahora los dos caminos llegan al piso.
    // Se usa el caso que SÍ toca el piso: con la fórmula nueva, la paciente original ya no lo alcanza.
    const chica = () => ({ e: enc({ edad: 78 }), b: bis({ talla: 145, peso: 44, edad: 78 }) });
    const a = chica();
    const sinDeficit = motorTratNutri(a.e, a.b, { fa_nivel: "sedentario" });
    const conDeficit = motorTratNutri(a.e, a.b, { fa_nivel: "sedentario", deficit: 300 });
    expect(sinDeficit.kcalObjetivo).toBe(1200);
    expect(conDeficit.kcalObjetivo).toBe(1200);
    expect(conDeficit.kcalObjetivo).not.toBeGreaterThan(sinDeficit.kcalObjetivo);
  });

  it("pero la rama de desnutrición queda FUERA del piso, que es la salvedad que él marcó", () => {
    // 27,5 x 38 kg = 1.045 kcal, por debajo del piso femenino de 1.200. Si el piso se le aplicara,
    // este paciente arrancaria por encima de lo que su propio protocolo de realimentacion permite.
    const desnutrida = motorTratNutri(enc(), bis({ peso: 38 }), { fa_nivel: "sedentario" });
    expect(desnutrida.kcalObjetivo).toBe(1045);
    expect(desnutrida.kcalObjetivo).toBeLessThan(1200);
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
