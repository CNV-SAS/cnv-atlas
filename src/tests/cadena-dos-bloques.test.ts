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
// EL DELIMITADOR CAMBIO, NO EL ALCANCE (2026-09-09). Era el comentario del boton de guardar de la cadena
// ("Un solo boton para los dos bloques"), y ese boton se retiro al unificar los siete guardados del panel
// en uno. El bloque de la formula es lo ultimo de la seccion, asi que se delimita con el inicio del panel.
const FORMULA = () => bloque("BLOQUE 2", "export function TreatmentPanel");

describe("el segundo bloque se llama como en su archivo (cotejo 2026-09-05, punto 23)", () => {
  // SIN COMENTARIOS: el comentario que explica el cambio de titulo tiene que nombrar los DOS titulos,
  // asi que sobre el texto crudo el candado se caza a si mismo (misma familia que el conteo de abajo).
  const RENDER = sinComentarios(PANEL);

  it("el TITULO es el suyo, Fórmula sintética", () => {
    // Su archivo lo llama "D — FÓRMULA SINTÉTICA". Santiago pidio adoptarlo, y es el nombre por el que
    // el profesional lo va a buscar cuando lea el archivo de Gildardo al lado de la pantalla.
    expect(RENDER).toContain("Fórmula sintética");
  });

  it("y el nuestro NO se pierde: se queda como RÓTULO, no de corrido", () => {
    // "Cómo se llega a ese objetivo" describe lo que el bloque hace, que el nombre propio no dice.
    // Adoptar el suyo no es motivo para tirar el nuestro: van los dos, cada uno en su nivel.
    //
    // CAMBIO DE SITIO, NO DE ASERCIÓN (2026-09-06, segundo smoke): iba pegado a la explicación en el
    // mismo párrafo, y así no es un subtítulo, es una frase más. Ahora va ENCIMA del título y en
    // versalitas, que es como esta pantalla marca lo que rotula frente a lo que explica. Lo que este
    // caso protege sigue siendo lo mismo: que los dos nombres estén y que se distingan.
    const i = RENDER.indexOf("Fórmula sintética");
    const j = RENDER.indexOf("Cómo se llega a ese objetivo");
    expect(i, "el título está").toBeGreaterThan(-1);
    expect(j, "el rótulo está").toBeGreaterThan(-1);
    // Y no van pegados en el mismo párrafo: entre los dos hay marcado.
    expect(RENDER.slice(Math.min(i, j), Math.max(i, j))).toContain("</p>");
  });
});

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
    //
    // ALCANCE AJUSTADO (2026-09-05), no la aserción: al arreglar el rótulo del cotejo 22.1, las tres
    // procedencias salieron del JSX a una constante, porque decidirlas exige mirar cinco campos y no uno.
    // Lo que este caso garantiza es lo mismo: que la meta DIGA de dónde sale la cifra. Así que se verifica
    // que la meta pinte esa procedencia y que las tres existan, en vez de buscar dos cadenas literales
    // dentro del bloque.
    expect(META(), "la meta ya no dice de dónde sale la cifra").toContain("{procedenciaObjetivo}");
    for (const t of ["fijado por ti", "sugerido por el modelo", "recalculado con tus ajustes"]) {
      expect(PANEL, `falta la procedencia "${t}"`).toContain(t);
    }
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

describe("se partió la PRESENTACIÓN, y ahora tampoco hay guardado propio", () => {
  it("la cadena NO tiene su propio guardado: publica, y lo guarda el botón único", () => {
    // ALCANCE REESCRITO, LA REGLA NO (2026-09-09). Este caso exigia UN formulario y UN boton, y protegia
    // esto: los seis ajustes son una columna cada uno pero UNA unidad clinica, asi que partir el guardado
    // dejaria que la cadena de un profesional pisara la meta de otro.
    //
    // Al unificar los siete guardados del panel en uno (peticion de Santiago), esa garantia se cumple mas
    // fuerte: no hay UN formulario para la cadena, hay CERO, y las siete secciones viajan en una sola
    // transaccion con sus siete firmas validadas antes de escribir ninguna. Lo que este caso vigila ahora
    // es que a nadie se le ocurra devolverle a la cadena un guardado propio.
    const seccion = sinComentarios(
      bloque("function CadenaCaloricaSection", "export function TreatmentPanel"),
    );
    expect((seccion.match(/<form /g) ?? []).length, "volvió un formulario propio a la cadena").toBe(0);
    expect((seccion.match(/type="submit"/g) ?? []).length, "volvió un botón de guardar a la cadena").toBe(0);
    expect((seccion.match(/name="baseSignature"/g) ?? []).length, "volvió una firma propia").toBe(0);
    // Y lo que SÍ tiene que haber: la publicación del borrador hacia el panel.
    expect(seccion, "la cadena dejó de publicar su borrador").toMatch(/usePublicar\(\s*"ajustes"/);
  });

  it("y el guardado del panel es UNO, y PEGAJOSO", () => {
    // LOS DOS DISPARADORES SE RETIRARON. Había dos botones de guardar en la cadena porque en móvil el de
    // abajo caía fuera de pantalla y había que bajar para guardar cuatro campos que estaban arriba. El
    // problema era la POSICIÓN, no el número: una barra pegajosa se ve desde cualquier punto del scroll,
    // así que un solo botón basta y además resuelve lo mismo para las otras seis secciones.
    expect(PANEL, "el guardado dejó de ser pegajoso").toContain("sticky bottom-0");
    expect(PANEL).toContain("Guardar cambios");
    // UNO, no dos: tres disparadores del mismo acto en una pantalla es ruido.
    const panel = sinComentarios(bloque("export function TreatmentPanel", "const ROTULO_SECCION"));
    expect((panel.match(/type="submit"/g) ?? []).length, "hay más de un botón de guardar").toBe(1);
  });

  it("los seis ajustes siguen viajando juntos, ahora en el borrador", () => {
    // Los `name` se conservan aunque ya no haya FormData por seccion: son lo que hace que cada campo
    // aparezca UNA sola vez (el espejo del PAL y el del deficit no lo llevan), y ese hazard sigue vivo.
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

describe("de dónde sale el objetivo: el rótulo mira la CASCADA, no un solo campo (cotejo 22.1/22.2)", () => {
  // EL DEFECTO QUE CIERRA, del cotejo final de Santiago. La pantalla mostraba "2408 kcal · sugerido por
  // el modelo" y dos bloques mas abajo el campo decia "modelo: 2377". LAS DOS CIFRAS ESTABAN BIEN:
  // 1729 x 1,375 = 2377 es la cadena sobre el peso CALCULADO y 1751 x 1,375 = 2408 la MISMA cadena sobre
  // el peso META que fijo el profesional. Lo que mentia era el rotulo, que decidia mirando solo
  // `adj.kcalObj` cuando el objetivo se mueve con cinco cosas.
  //
  // Es la familia de "dos cifras del mismo concepto en la misma pantalla", con una vuelta: aqui las dos
  // eran correctas. Por eso el arreglo no es unificarlas, es DECIR CUAL ES CUAL.

  it("el rótulo del objetivo cuenta las cinco entradas que lo mueven", () => {
    expect(PANEL, "el peso meta arrastra al GEB y con él al objetivo").toContain("adj.pesoMeta != null");
    for (const campo of ["adj.geb != null", "adj.pal != null", "adj.deficit != null"]) {
      expect(PANEL, `falta ${campo} en la procedencia del objetivo`).toContain(campo);
    }
    expect(PANEL).toContain("recalculado con tus ajustes");
    // Y el control: que ya NO decida con el campo solo, que era el defecto exacto.
    expect(
      PANEL,
      'el rótulo volvió a decidirse con adj.kcalObj a secas: con el peso meta fijado vuelve a decir "sugerido por el modelo" sobre una cifra que el modelo no sugirió',
    ).not.toContain('adj.kcalObj != null ? "fijado por ti" : "sugerido por el modelo"');
  });

  it("EL PLACEHOLDER DICE LO QUE PASA SI SE DEJA VACÍO, no lo que se selló", () => {
    // ESTE ES EL FONDO DEL 22.1, y el primer arreglo lo TAPÓ en vez de cerrarlo. El campo del objetivo
    // estaba vacío con placeholder `modelo: 2377`, y dejándolo vacío salía 2408: un placeholder que
    // promete una cifra y entrega otra. Un placeholder en un campo vacío significa "esto es lo que se usa
    // si no escribes nada", y eso era falso en cuanto el profesional movía el peso meta.
    //
    // Con esto la pantalla vuelve a tener UNA cifra por concepto, como su archivo, sin perder la
    // distinción calculado/ajustado (DIV-12), que vive en el rótulo y no en un segundo número.
    expect(PANEL, "el objetivo volvió al valor sellado").not.toContain("modelo: ${d0(base.kcalObj)}");
    expect(PANEL, "el GEB volvió al valor sellado").not.toContain("modelo: ${d0(base.geb)}");
    expect(PANEL, "el objetivo no ofrece el valor que de verdad se usa").toContain(
      "modelo: ${d0(objetivoDelModelo)}",
    );
    // `gebAuto` ES el GEB que corre cuando nadie fija el campo: la salida de la cadena lo expone aparte
    // justo para esto.
    expect(PANEL, "el GEB no ofrece el valor que de verdad se usa").toContain("modelo: ${d0(cal.gebAuto)}");
    // Y el control: no vuelve la segunda cifra, que era el parche.
    expect(PANEL, "volvió la segunda cifra en vez del placeholder correcto").not.toContain(
      "el modelo sugirió",
    );
  });

  it("y NINGÚN campo de la cadena ofrece el valor SELLADO como placeholder", () => {
    // BARRIDO DE LA MISMA FORMA (2026-09-05). Al encontrarla en el objetivo se revisaron los seis campos
    // de la cadena, porque un defecto que vive en un placeholder puede vivir en los otros. Aparecieron dos
    // más, latentes: la proteína y la grasa leían `base.*`, y en los snapshots anteriores al 2026-09-03
    // (los que no traen `mtn`) la cadena resuelve la proteína con el motor de HOY, así que el placeholder
    // podía prometer una cifra y correr otra.
    //
    // LA REGLA, que es lo que este caso fija: un placeholder SOLO se ve con el campo vacío, y con el campo
    // vacío lo que corre es `cal.*`. Así que el placeholder de un campo de la cadena se deriva de `cal`,
    // nunca de `base`. Los dos que leen `snap` (el déficit) son correctos: ese valor no lo recalcula la
    // cadena.
    // Se extraen por LINEA y no con una regex sobre el template: la plantilla anida llaves y comillas
    // invertidas, y una regex que las persiga se rompe al primer cambio de formato. La línea entera basta.
    const placeholders = PANEL.split("\n").filter((l) => l.includes("placeholder={`"));
    expect(placeholders.length, "el extractor no encontró los placeholders").toBeGreaterThan(4);
    for (const linea of placeholders) {
      expect(
        linea.includes("base."),
        `este placeholder ofrece el valor SELLADO, y con el campo vacío corre el de la cadena: ${linea.trim()}`,
      ).toBe(false);
    }
  });

  it("y la vista previa no llama «del modelo» a una cifra que lleva los ajustes", () => {
    // `objetivoDelModelo` sale de `cal.get`, que ya trae el peso meta y el PAL del profesional. El rótulo
    // decía "Objetivo del modelo" y es el mismo rótulo falso, un piso más abajo.
    expect(PANEL).toContain('"Objetivo de la cadena"');
    expect(PANEL, "volvió el rótulo que llamaba del modelo a la cadena efectiva").not.toContain(
      '"Objetivo del modelo"',
    );
  });
});
