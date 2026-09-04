import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Modulo congelado en JS. `allowJs` lo resuelve, asi que NO lleva ts-expect-error: ponerlo hacia que
// tsc fallara por directiva inutil, que es un rojo que no dice nada.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { funcionDelHtml, HTML_VIGENTE } from "./fixtures/html-vigente";

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
    // en `HTML_VIGENTE`, y la divergencia declarada en `frozen-deriva-vigente`).
    const fuente = funcionDelHtml("motorTratNutri", HTML_VIGENTE);
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
    // LA GARANTIA NO CAMBIA, LA FORMULA SI, Y VA POR LA TERCERA EN CUATRO DIAS. La secuencia:
    // `500 + 22 x FFM` mal rotulado Cunningham -> Mifflin -> Harris-Benedict (su §9.6 del 2-sep) ->
    // MIFFLIN otra vez (su entrega del 3, confirmada el 4). Lo que este caso protege es lo mismo desde el
    // principio: que el gasto se calcule sobre el peso META y no sobre el actual.
    //
    // Y POR ESO EL CASO SE ESCRIBE CONTRA LA GARANTIA Y NO CONTRA LA CIFRA: con tres formulas en cuatro
    // dias, un caso que pinchara el numero seria un caso que hay que reescribir cada vez.
    //
    // Mujer de 60 años, 150 cm, 60 kg: peso ideal 50, IMC 26,7 -> peso meta = 50.
    const r = motorTratNutri(enc(), bis(), {}) as { geb: number };
    const mifflin = (peso: number) => Math.round(10 * peso + 6.25 * 150 - 5 * 60 - 161);
    expect(r.geb).toBe(mifflin(50));
    // Y LA DIFERENCIA ES LA PRUEBA: sobre los 60 kg reales daria cien kcal mas.
    expect(r.geb).not.toBe(mifflin(60));
    expect(mifflin(60) - mifflin(50)).toBe(100);
  });

  it("3 · la separación de proteína YA NO APLICA: el motor no propone gramos", () => {
    // ESTA CORRECCION QUEDO SUPERADA por su entrega del 3-sep (confirmada el 4): el motor no propone
    // proteina, sale 0,8 para todos y el profesional la mueve. Lo que las dos ramas conservan es el
    // ATRIBUTO y las notas, que es donde vive lo que las distingue.
    //
    // NO SE BORRA EL CASO: se le da vuelta. Que las dos den la misma cifra es justamente lo que hay que
    // vigilar ahora, porque si una rama volviera a imponer un gramaje seria una regresion a lo retirado.
    const desnutrida = motorTratNutri(enc(), bis({ FFMI: 14 }), {});
    const conCancer = motorTratNutri(enc({ d5_39: ["Cáncer"] }), bis(), {});
    expect(desnutrida.protKg).toBe(0.8);
    expect(conCancer.protKg).toBe(0.8);
    // Y siguen siendo distinguibles por lo que SI conservan.
    expect(desnutrida.attrs).toContain("Densidad energética alta, fraccionada");
    expect(conCancer.attrs).toContain("Densidad energética alta");
  });

  it("3b · la nota de realimentación viaja SOLO con desnutrición, no con cáncer", () => {
    // Es lo que protege al paciente mas fragil de los dos, y el pidio expresamente vigilar que no se
    // perdiera al separar la rama.
    // LA DESNUTRICION AHORA SALE DEL FFMI, no del IMC (su entrega del 3): antes bastaba `peso: 38`
    // para IMC 16,9; ahora hace falta FFMI por debajo de 15 en mujer (ESPEN 2015 / GLIM 2019). El caso
    // sigue probando lo mismo, con el insumo que la condicion usa hoy.
    const desnutrida = motorTratNutri(enc(), bis({ FFMI: 14 }), {});
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
    // ESTE CASO DIO LA VUELTA ENTERA, y por eso queda escrito: con Mifflin esta paciente daba 1.172 y el
    // piso la subía a 1.200; con Harris-Benedict (2026-09-02) subía a 1.356 y dejaba de necesitarlo; y
    // con Mifflin otra vez (su entrega del 3, confirmada el 4) vuelve a 1.172 y el piso vuelve a actuar.
    //
    // Tres formulas en cuatro dias sobre la misma paciente. La GARANTIA no se movio en ninguna de las
    // tres, y es la unica razon por la que este caso sigue sirviendo: el piso NO cuelga del deficit.
    const r = motorTratNutri(enc(), bis(), { fa_nivel: "sedentario" }) as {
      get: number;
      kcalObjetivo: number;
    };
    expect(r.get).toBeLessThan(1200);
    expect(r.kcalObjetivo).toBe(1200); // por debajo del piso, el piso manda
    expect(r.kcalObjetivo).toBeGreaterThan(r.get);

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

  it("y desde el 3-sep el piso aplica a TODOS, también a la desnutrición", () => {
    // ESTA SALVEDAD SE RETIRO en su entrega del 3 (confirmada el 4), junto con la formula por patologia
    // (27,5 kcal x peso actual) de la que colgaba. Ahora hay UNA sola via: el objetivo sale del gasto
    // sobre el peso meta menos la restriccion, y el piso lo protege por debajo en todos los casos.
    //
    // SE DEJA ESCRITO QUE LA TENSION SIGUE AHI, porque es clinica y no desaparece con el codigo: su
    // propia nota de realimentacion pide iniciar a 10-15 kcal/kg en quien tiene riesgo, y el piso de
    // 1.200 puede quedar por encima de eso. Hoy la resuelve el profesional, que es a quien esta entrega
    // le devolvio la decision. Si algun dia vuelve a excluirse, este caso se pondra rojo y estara bien.
    const desnutrida = motorTratNutri(enc(), bis({ FFMI: 14 }), { fa_nivel: "sedentario" }) as {
      kcalObjetivo: number;
    };
    expect(desnutrida.kcalObjetivo).toBeGreaterThanOrEqual(1200);
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

  it("la ERC conserva su NOTA y su atributo, pero ya no impone 0,7", () => {
    // La distincion que el marco al retirar las cifras: la nota se queda porque ADVIERTE DE UN DAÑO; el
    // gramaje y el atributo "Proteína controlada 0,6-0,8" salen. El rango sigue existiendo, pero ahora
    // se le MUESTRA al profesional en el panel de referencia en vez de imponerselo.
    const r = motorTratNutri(enc({ d5_39: ["Enfermedad renal crónica"] }), bis(), {});
    expect(r.protKg).toBe(0.8);
    expect(r.attrs).toContain("Nefroprotectora");
    expect(r.attrs).not.toContain("Proteína controlada 0,6-0,8 g/kg");
    expect(r.notas.join(" ")).toContain("bajo guía de nefrología");
  });
});
