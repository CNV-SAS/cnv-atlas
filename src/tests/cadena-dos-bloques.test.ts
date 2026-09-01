import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";


// CANDADO DE LA SEPARACION DE LA CADENA CALORICA en sus dos bloques (§8.1, 2026-08-26 Parte 2).
//
// LO QUE FIJA, y es una decision suya que va contra la nuestra: habiamos propuesto FUNDIR el objetivo y la
// cadena en un solo bloque, y dijo que no. Su razon no es estetica, es de ORDEN DE TRABAJO:
//
//   "La formula desarrollada depende de la decision del nutricionista de subir o bajar las calorias.
//    PRIMERO SE DECIDE LA META; DESPUES SE VE LA CADENA QUE LA PRODUCE. Fundirlas invierte el orden y
//    empuja al profesional a mover la calculadora cuando lo que queria era fijar un objetivo."
//
// Por eso el candado no mira "que haya dos secciones" y ya: mira que el OBJETIVO se edite en la de la meta
// y NO en la de la formula, que es donde la fusion volveria a colarse sin que se note.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

/** Trozo del panel entre dos marcas, para poder preguntar por CADA bloque y no por el archivo entero. */
function bloque(desde: string, hasta: string): string {
  const i = PANEL.indexOf(desde);
  const j = PANEL.indexOf(hasta, i + 1);
  expect(i, `no encuentro el bloque que empieza en "${desde}"`).toBeGreaterThan(-1);
  expect(j, `no encuentro el fin del bloque "${desde}"`).toBeGreaterThan(i);
  return PANEL.slice(i, j);
}

const META = () => bloque("<h3 className={tituloBloqueCls(\"decision\")}>Objetivo del plan", "BLOQUE 2");
const FORMULA = () => bloque("BLOQUE 2", "Un solo boton para los dos bloques");

describe("la cadena calórica va en DOS bloques, no en uno", () => {
  it("existen los dos, y en el orden que él fijó: primero la meta", () => {
    const meta = PANEL.indexOf("Objetivo del plan");
    const formula = PANEL.indexOf("Cómo se llega a ese objetivo");
    expect(meta).toBeGreaterThan(-1);
    expect(formula).toBeGreaterThan(-1);
    // El orden ES la instrucción: "primero se decide la meta, después se ve la cadena que la produce".
    expect(meta).toBeLessThan(formula);
  });

  it("el peso meta y el objetivo se EDITAN en el bloque de la meta", () => {
    expect(META()).toContain('name="pesoMeta"');
    expect(META()).toContain('name="adjKcalObj"');
  });

  it("y el objetivo NO se edita en el de la fórmula: ahí va en lectura", () => {
    // Es su instrucción literal para el dato que aparece en los dos bloques: "editable en uno solo y en
    // lectura en el otro". Un segundo input aquí es exactamente la fusión volviendo por la puerta de atrás.
    //
    // EL MARCADOR CAMBIÓ, NO LA ASERCIÓN (cotejo 2026-08-31, punto 5): la cadena se dispone ahora como una
    // CUENTA vertical, y el rótulo del objetivo pasó a ser dinámico porque cuando el profesional lo fija a
    // mano hay dos renglones que distinguir (el que da la cuenta y el suyo, que la reemplaza). Lo que se
    // afirma sigue siendo lo mismo: aquí se lee, no se edita, y el tag dice dónde se edita.
    expect(FORMULA()).not.toContain('name="adjKcalObj"');
    expect(FORMULA()).toContain('"Objetivo calórico"');
    expect(FORMULA()).toContain('tag="lo fijas arriba"');
  });

  it("la cuenta se lee como cuenta: operadores y renglones de resultado", () => {
    // Su pantalla dispone la cadena en vertical con el operador a la izquierda. La nuestra decía los mismos
    // números en filas iguales, y eso esconde que unos SALEN de otros: el GET parecía un tercer dato al
    // lado del GEB y del PAL, no su producto.
    const f = FORMULA();
    expect(f).toContain('op="×"');
    expect(f).toContain('op="="');
    expect(f).toContain("resultado");
  });

  it("el renglón final es el RESULTADO de los de arriba, o dice que alguien lo reemplazó", () => {
    // Una cuenta cuyo total no sale de sus términos deja de ser una cuenta y pasa a ser una lista que
    // miente. Hay dos formas de que eso ocurra y las dos están cubiertas: que el profesional fije el
    // objetivo a mano (se muestran los dos renglones, rotulados) y que muerda el piso de 1.000 kcal.
    const f = FORMULA();
    expect(f).toContain("objetivoLoFijoElProfesional");
    expect(f).toContain('label="Objetivo del plan"');
    expect(f).toContain("reemplaza el del modelo");
    expect(PANEL).toContain("const pisoMordio");
    expect(f).toContain("piso de 1.000 kcal");
    // Y el déficit es un eslabón de la cuenta, no un dato suelto: se computa del snapshot SELLADO (la
    // misma fuente que entra al motor), no restando GET menos objetivo, que con un objetivo fijado a mano
    // daría un déficit que el modelo nunca calculó.
    expect(PANEL).toContain("const deficitCadena = adj.deficit ?? snap.estrategia.deficit ?? 0");
    // EL MARCADOR CAMBIÓ, NO LA ASERCIÓN (2026-09-01): el déficit pasó a editable, así que su rótulo dice
    // ahora quién lo fijó ("Déficit del modelo" / "Déficit (lo fijas tú)"). Lo que se afirma sigue siendo
    // que el déficit es un renglón de la cuenta y no un dato suelto.
    expect(f).toContain('"Déficit (lo fijas tú)" : "Déficit del modelo"');
  });

  it("la fórmula lleva GEB, PAL y el cuadre de macros", () => {
    // Los tres beneficios que pedimos y él concedió SIN fundir: el cuadre de macros va en el bloque de la
    // fórmula, no en el de la meta.
    //
    // EL MARCADOR DEL PAL CAMBIÓ, NO LA ASERCIÓN (cotejo 2026-09-01, punto a): el PAL ahora se edita en
    // LOS DOS bloques (arriba, entre los cuatro campos que su pantalla agrupa; abajo, dentro de la cuenta,
    // donde es el factor que multiplica), con un solo estado detrás. El `name` lo lleva la copia de
    // arriba, así que aquí el marcador es el componente, no el atributo.
    for (const marca of ['name="adjGeb"', "<PalSelect value={pal}", 'name="adjProtGkg"', 'name="adjFatPct"']) {
      expect(FORMULA()).toContain(marca);
    }
    expect(FORMULA()).toContain("Reparto de macronutrientes");
    expect(FORMULA()).toContain("Carbohidratos");
    // Y el cuadre en sí: la suma de los tres contra el objetivo.
    expect(FORMULA()).toContain("Suma de los tres");
  });

  it("la distinción entre CALCULADO y AJUSTADO está visible en la meta", () => {
    // El otro beneficio concedido. Sin esto el profesional no sabe si el número que ve lo puso él o el
    // modelo, que es justo lo que le hace falta para decidir si moverlo.
    expect(META()).toContain("fijado por ti");
    expect(META()).toContain("sugerido por el modelo");
  });
});

describe("los cuatro campos de la cadena se ven arriba, y son UN dato", () => {
  // SU PANTALLA LOS AGRUPA (cotejo 2026-09-01, punto a): objetivo, PAL, déficit y peso meta van juntos en
  // el bloque del objetivo, no repartidos entre dos bloques. Santiago: "que se repitan los campos, es
  // decir, poner PAL 2 veces, pero si cambio un campo en uno, inmediatamente se cambia en el otro y ambos
  // valores siempre van a ser iguales".
  //
  // "IGUALES" NO SE CONSIGUE SINCRONIZANDO, se consigue no teniendo dos: un solo `useState` leído desde
  // los dos sitios. Dos estados sincronizados es como se crean las discrepancias que esto viene a evitar.

  it("los cuatro están en el bloque de la meta", () => {
    const meta = META();
    for (const marca of ['name="pesoMeta"', 'name="adjKcalObj"', 'name="adjPal"', 'name="adjDeficit"']) {
      expect(meta, `falta ${marca} arriba`).toContain(marca);
    }
  });

  it("y el PAL y el déficit se repiten abajo con el MISMO estado, no con una copia", () => {
    // El espejo de la cuenta lee `pal` y `deficit` (el estado) y escribe con `setPal`/`setDeficit`. Si
    // alguna vez apareciera un segundo useState para lo mismo, aquí es donde se ve.
    const formula = FORMULA();
    expect(formula).toContain("<PalSelect value={pal} onChange={setPal}");
    expect(formula).toContain("value={deficit}");
    expect(formula).toContain("onChange={(e) => setDeficit(e.target.value)}");
    const seccion = bloque("function CadenaCaloricaSection", "export function TreatmentPanel");
    expect((seccion.match(/useState\(numToInput\(protocol\.adjPal\)\)/g) ?? []).length).toBe(1);
    expect((seccion.match(/useState\(numToInput\(protocol\.adjDeficit\)\)/g) ?? []).length).toBe(1);
  });

  it("cada `name` aparece UNA SOLA VEZ en el formulario", () => {
    // EL HAZARD DE REPETIR UN CAMPO, y solo se ve en un navegador real: dos inputs con el mismo `name`
    // mandan DOS valores en el FormData y el servidor se queda con uno cualquiera. El profesional edita
    // el de abajo, se guarda el de arriba, y nada avisa. Por eso el espejo NO lleva `name`.
    const seccion = bloque("function CadenaCaloricaSection", "export function TreatmentPanel");
    for (const n of ["pesoMeta", "adjGeb", "adjPal", "adjKcalObj", "adjProtGkg", "adjFatPct", "adjDeficit"]) {
      const veces = (seccion.match(new RegExp(`name="${n}"`, "g")) ?? []).length;
      expect(veces, `el campo ${n} lleva name ${veces} veces; con más de una el FormData manda dos valores`).toBe(1);
    }
  });

  it("el déficit es editable, y admite negativos porque un déficit negativo es un superávit", () => {
    // Aprobado el 2026-09-01 con su razón: el valor del modelo es 0 para todos desde que Gildardo retiró
    // los cinco por fenotipo, así que abrir el campo NO elige de qué motor sale nada. Sin techo ni piso
    // (2026-08-27 §5). El único límite que lo alcanza es el piso de 1.000 kcal de su propia cadena.
    const val = readFileSync("src/modules/treatment/validations.ts", "utf8");
    const i = val.indexOf("adjDeficit: z.coerce");
    expect(i).toBeGreaterThan(-1);
    expect(
      val.slice(i, val.indexOf("baseSignature", i)),
      "el déficit dejó de admitir negativos",
    ).not.toContain(".min(0");
    expect(PANEL).toContain("Un déficit negativo es un superávit");
  });
});

describe("el desplegable del PAL nunca muestra un nivel que no es", () => {
  // ESTA CLASE DE DEFECTO YA MORDIÓ DOS VECES, y la segunda la introduje arreglando la primera:
  //
  //   1 · Un `select` cuyo `value` no corresponde a ninguna `option` no muestra vacío: muestra LA
  //       PRIMERA. Con el PAL sin elegir, eso pintaba "Sedentario (1.2)" como seleccionado.
  //   2 · Se le puso una `option` de relleno... `disabled`. Y un navegador NO SELECCIONA una opción
  //       deshabilitada: vuelve a caer en la primera elegible. La opción existía pero era inelegible, que
  //       para el navegador es casi lo mismo que no existir. Mismo síntoma, causa nueva.
  //
  // Las dos son mentiras sobre una ENTRADA DE LA FÓRMULA, en la pantalla donde menos se puede mentir, y
  // ninguna de las dos rompe nada: tsc, lint y jsdom pasan verdes. Solo se ven en un navegador real.
  //
  // POR ESO EL CANDADO ES SOBRE LA REGLA, no sobre el síntoma: el valor que se le da al `select` SIEMPRE
  // tiene que corresponder a una `option` ELEGIBLE.

  // Sin comentarios: el comentario del componente CITA la palabra prohibida para explicar por que no esta.
  const PAL = sinComentarios(bloque("function PalSelect", "function AdjInput"));

  it("ninguna opción del PAL va deshabilitada", () => {
    expect(
      PAL,
      "una option deshabilitada no se puede seleccionar: el navegador cae en la primera",
    ).not.toContain("disabled");
  });

  it("sin elegir, el valor es el nivel del MODELO, no la cadena vacía", () => {
    // Así el valor siempre corresponde a una option real de la lista.
    expect(PAL).toContain("const modeloEnEscala = NIVELES_FA.some((n) => Number(n.valor) === modelo)");
    expect(PAL).toContain('const mostrado = value !== "" ? value : modeloEnEscala ? String(modelo) : ""');
    expect(PAL).toContain("value={mostrado}");
  });

  it("y el borde imposible (un factor fuera de su escala) tiene su propia opción, elegible", () => {
    // Preferimos mostrar un número raro a mostrar uno falso: un factor que no esté en sus cinco niveles se
    // ve tal cual, no se disfraza del primero de la lista.
    expect(PAL).toContain('{mostrado === "" ? <option value="">');
  });

  it("lo que se GUARDA sigue distinguiendo 'no lo decidí' de 'elegí ese nivel'", () => {
    // La mitad que no se ve, y es la razón por la que el botón no escribe el valor del modelo: ver el
    // nivel del modelo no es lo mismo que haberlo elegido, y el registro clínico no puede atribuirle al
    // profesional una decisión que no tomó. El estado sigue siendo "" y la columna sigue siendo null.
    expect(PANEL).toContain('onClick={() => setPal("")}');
    expect(PANEL).toContain("recomendada por el modelo");
  });
});

describe("se partió la PRESENTACIÓN, no el guardado", () => {
  it("hay UN solo formulario y UN solo botón para los dos bloques", () => {
    // Los seis ajustes son una columna cada uno pero UNA unidad clínica: `saveAdjustments` las escribe de
    // golpe y `adjustmentSignature` cubre las seis. Partir el guardado obligaría a dos firmas sobre las
    // mismas columnas, y un guardado parcial dejaría que la cadena de un profesional pisara la meta de
    // otro. Si alguien parte el form, esto truena antes de que ese defecto llegue a un paciente.
    const seccion = bloque("function CadenaCaloricaSection", "export function TreatmentPanel");
    expect((seccion.match(/<form /g) ?? []).length).toBe(1);
    expect((seccion.match(/type="submit"/g) ?? []).length).toBe(1);
    expect((seccion.match(/name="baseSignature"/g) ?? []).length).toBe(1);
  });

  it("los seis ajustes siguen viajando juntos en ese único formulario", () => {
    const seccion = bloque("function CadenaCaloricaSection", "export function TreatmentPanel");
    for (const n of ["pesoMeta", "adjGeb", "adjPal", "adjKcalObj", "adjProtGkg", "adjFatPct"]) {
      expect(seccion, `falta ${n} en el formulario de la cadena`).toContain(`name="${n}"`);
    }
  });
});

describe("el desliz del doble nombre del factor de actividad", () => {
  it("Atlas dice PAL en los dos sitios; nunca 'Actividad prescrita (FA)'", () => {
    // §8.1: "«Actividad prescrita (FA)» y «Factor actividad (PAL)» son el mismo factor con dos nombres.
    // Unifíquenlo en el suyo." El desliz es de SU archivo, no del nuestro: Atlas siempre dijo PAL, y él nos
    // manda conservarlo. El candado impide que el doble nombre entre al portar otra pieza suya.
    // EL MARCADOR CAMBIÓ, NO LA ASERCIÓN (2026-08-31): el PAL pasó de `AdjInput` a un `<select>` con sus
    // cinco niveles (su instrumento; un campo libre dejaba escribir 3, que no existe). Lo que se afirma
    // sigue siendo lo mismo, y este candado acaba de ganarse el sueldo: al portar su desplegable estuve a
    // punto de traerme también su rótulo "Actividad prescrita (FA)", que es exactamente el desliz que él
    // mandó no copiar. Se mira el CÓDIGO sin comentarios, porque el comentario cita la frase prohibida
    // para explicar por qué lo está.
    const codigo = sinComentarios(PANEL);
    expect(codigo).not.toContain("Actividad prescrita");
    expect(codigo).not.toContain("(FA)");
    expect(codigo).toContain(">PAL (factor)<");
    expect(codigo).toContain("Nivel de actividad física (PAL)");
  });
});
