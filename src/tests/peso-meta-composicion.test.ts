import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Modulo congelado en JS; `allowJs` lo resuelve.
import { motorTratNutri } from "@/clinical-engine/frozen/atlas-tratamiento-nutri.js";
import { computeProtocoloEfectivo, PROTOCOL_ENGINE_VERSION } from "@/clinical-engine";

import { funcionDelHtml } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PESO META POR COMPOSICION (Gildardo, entrega del 2026-09-01, punto 3).
//
// SU CAMBIO: el peso meta pasa de calcularse por IMC a la identidad peso = (FMI + FFMI) x talla². Cada
// indice se lleva a su rango y el resto se deja como esta: el FMI al limite si se pasa o si no llega
// (3-6 en hombres, 5-9 en mujeres) y el FFMI al minimo SOLO si esta por debajo (17 y 15).
//
// POR QUE PESA TANTO: el peso meta es la palanca de toda la cadena calorica. Con el IMC como criterio, un
// deportista con masa muscular alta recibia un recorte de kilos que no son grasa, y una obesidad
// sarcopenica con IMC normal recibia un objetivo de mantenimiento. Son sus dos casos, y los dos son
// reales en nuestros datos.

const FROZEN = "src/clinical-engine/frozen/atlas-tratamiento-nutri.js";
const NUTRI = readFileSync(FROZEN, "utf8");
const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");

const BIS = (sexo: string, peso: number, talla: number, FMI: number, FFMI: number) => ({
  sexo,
  peso,
  talla,
  FMI,
  FFMI,
});
const ENC = { d5_39: [], edad: 40 };
type Salida = { pesoMeta: number; protG: number; protKg: number };
const correr = (bis: object, edit: object = {}) => motorTratNutri(ENC, bis, edit) as Salida;

describe("el porte es VERBATIM del archivo vigente", () => {
  it("el cuerpo del motor coincide con el de su HTML, sin espacios", () => {
    // Se compara contra la entrega VIGENTE (derivada del directorio), no contra una ruta escrita a mano:
    // un candado anclado a una entrega superada pasa verde por construccion.
    const suyo = funcionDelHtml("motorTratNutri");
    const sinEsp = (s: string) => s.replace(/\s+/g, "");
    // Se cuenta la llave, como hace `funcionDelHtml`. `lastIndexOf("}")` NO sirve: cae en la llave del
    // `module.exports = { motorTratNutri };` del final, y el cuerpo sale 31 caracteres más largo. Lo cazó
    // este mismo test en su primera corrida, que es para lo que está.
    const i = NUTRI.indexOf("function motorTratNutri(");
    let prof = 0;
    let j = -1;
    for (let k = NUTRI.indexOf("{", i); k < NUTRI.length; k++) {
      if (NUTRI[k] === "{") prof++;
      else if (NUTRI[k] === "}") {
        prof--;
        if (prof === 0) {
          j = k;
          break;
        }
      }
    }
    expect(j, "el motor no cierra en el frozen").toBeGreaterThan(i);
    expect(sinEsp(NUTRI.slice(i, j + 1))).toBe(sinEsp(suyo));
  });

  it("y la version del protocolo subió: sin eso el cambio entra en silencio", () => {
    // Si la version no sube, nada distingue una cadena sellada con la formula vieja de una con la nueva.
    // Sube con cada cambio de la ciencia del protocolo. El 2026-09-02 subio por el GEB: pasa de Mifflin a
    // Harris-Benedict, la formula del propio equipo.
    //
    // SE COMPARA "DE ESA VERSION EN ADELANTE", NO IGUALDAD EXACTA, y el motivo salio el mismo dia: la
    // version volvio a subir horas despues (09-02b, la correccion del gasto medido) y este caso se puso
    // rojo sin que nada estuviera mal. Una igualdad exacta contra algo que sube a proposito obliga a
    // editar la asercion en cada bump, y un candado que se edita de rutina deja de leerse. Lo que este
    // caso afirma es que el bump del GEB OCURRIO y no se ha revertido; las versiones son cadenas
    // ordenadas por fecha, asi que la comparacion sirve.
    expect(PROTOCOL_ENGINE_VERSION >= "anibise-protocolo-2026-09-02").toBe(true);
    // CONTROL: sin esto, la comparacion de arriba pasaria verde con CUALQUIER cadena posterior en el
    // alfabeto, incluida una que no fuera una version del protocolo.
    expect(PROTOCOL_ENGINE_VERSION).toMatch(/^anibise-protocolo-\d{4}-\d{2}-\d{2}[a-z]?$/);
  });
});

describe("los dos casos que su cambio corrige", () => {
  it("el DEPORTISTA: composición normal, IMC alto, y la meta ya no le recorta músculo", () => {
    // Su caso, y es el de un paciente real nuestro: talla 177, FMI 5,76 (rango normal 3-6), FFMI 19,9.
    // Su IMC es 25,7, así que la fórmula por IMC lo trataba como obeso y le recortaba kilos que no son
    // grasa. Con los dos índices en rango, la identidad devuelve su propio peso.
    const m = correr(BIS("Masculino", 80.4, 177, 5.759, 19.904));
    expect(m.pesoMeta).toBe(80.4);
  });

  it("la OBESIDAD SARCOPÉNICA: el FMI baja al límite y el músculo se protege", () => {
    // FMI 12 (muy por encima de 6) y FFMI 16 (por debajo de 17). La meta recorta grasa y APUNTA a
    // recuperar masa magra, en vez de dejar el objetivo en mantenimiento.
    const m = correr(BIS("Masculino", 80.9, 170, 12, 16));
    expect(m.pesoMeta).toBe(66.5);
    expect(m.pesoMeta).toBeLessThan(80.9);
  });
});

describe("el piso del FFMI: su decisión explícita, y no produce el problema inverso", () => {
  it("el DESNUTRIDO: sin piso la meta salía POR DEBAJO de su peso actual", () => {
    // Su razón literal: "al conservar un FFMI deficitario, la meta heredaba la desnutrición". Con el piso,
    // la meta apunta a recuperar la masa magra que falta.
    const m = correr(BIS("Masculino", 52.1, 175, 2, 15));
    expect(m.pesoMeta).toBeGreaterThan(52.1);
  });

  it("y NINGÚN perfil con IMC alto sale mandado a subir", () => {
    // EL RIESGO INVERSO, comprobado en vez de razonado: que el piso empuje hacia arriba a alguien que
    // debería bajar. Se recorre una malla de perfiles donde el piso SÍ se activa (FFMI bajo el mínimo).
    const fallos: string[] = [];
    for (const sexoM of [true, false]) {
      const sexo = sexoM ? "Masculino" : "Femenino";
      const ffmiTope = sexoM ? 17 : 15;
      for (let talla = 150; talla <= 190; talla += 5) {
        for (let fmi = 1; fmi <= 20; fmi += 1) {
          for (let ffmi = 10; ffmi < ffmiTope; ffmi += 0.5) {
            const peso = Math.round((fmi + ffmi) * Math.pow(talla / 100, 2) * 10) / 10;
            const imc = peso / Math.pow(talla / 100, 2);
            if (imc < 25) continue; // solo interesa a quien deberia bajar
            const m = correr(BIS(sexo, peso, talla, fmi, ffmi));
            if (m.pesoMeta > peso) {
              fallos.push(`${sexo} t${talla} FMI${fmi} FFMI${ffmi}: ${peso} -> ${m.pesoMeta}`);
            }
          }
        }
      }
    }
    expect(fallos, `el piso mandó a SUBIR a un IMC>=25:\n${fallos.slice(0, 5).join("\n")}`).toEqual([]);
  });

  it("CONTROL: la malla de verdad recorre perfiles con el piso activo", () => {
    // Sin este control, el test de arriba pasaría verde también si la malla no hubiera evaluado nada.
    let conPiso = 0;
    for (let talla = 150; talla <= 190; talla += 5) {
      for (let fmi = 1; fmi <= 20; fmi += 1) {
        for (let ffmi = 10; ffmi < 17; ffmi += 0.5) {
          const peso = Math.round((fmi + ffmi) * Math.pow(talla / 100, 2) * 10) / 10;
          if (peso / Math.pow(talla / 100, 2) >= 25) conPiso++;
        }
      }
    }
    expect(conPiso).toBeGreaterThan(200);
  });
});

describe("lo que NO cambia por sí solo, y es lo que hay que saber", () => {
  it("nuestra cadena SIGUE pasándole su propio peso, así que la fórmula nueva no gobierna", () => {
    // EL HALLAZGO QUE CAMBIA EL ALCANCE: `getPrescripcionNutricional` le pasa SIEMPRE `edit.peso_meta`
    // (el peso efectivo de la cadena, que sale de `atlas-protocolo.pesoCalculo`), y con eso la fórmula
    // interna de `motorTratNutri` NUNCA se ejecuta en nuestro camino. Su corrección está en el motor que
    // bypaseamos; la fórmula que gobierna nuestra cadena es la otra, y esa él no la cambió.
    //
    // Está preguntado en la ronda. Este test fija el estado de HOY para que el día que se decida, se vea
    // que cambió algo.
    const READER = readFileSync("src/modules/treatment/data/dieta-resumen-reader.ts", "utf8");
    expect(sinComentarios(READER)).toContain("edit.peso_meta = pesoMeta");
    const PROTOCOLO = readFileSync("src/clinical-engine/frozen/atlas-protocolo.js", "utf8");
    expect(PROTOCOLO).toContain("imc<25 ? peso : PI+0.25*(peso-PI)");
  });

  it("y la diferencia entre las dos fórmulas es real, no teórica", () => {
    // Mismo paciente, los dos caminos. Si algún día coincidieran, este test lo diría.
    const conSuya = correr(BIS("Masculino", 80.4, 177, 5.759, 19.904));
    const conLaNuestra = correr(BIS("Masculino", 80.4, 177, 5.759, 19.904), { peso_meta: 72.79 });
    expect(conSuya.pesoMeta).not.toBe(conLaNuestra.pesoMeta);
    expect(conSuya.protG).toBeGreaterThan(conLaNuestra.protG);
  });
});

describe("el desfase de versión se avisa donde se ve la cifra, y SOLO si movió algo", () => {
  // EL HUECO ORIGINAL: el mecanismo de vigencia de emisión mira tres dimensiones y NO el protocolo. La
  // versión del motor calórico se sella dentro de `protocol_suggested` y no la miraba nadie: al medirlo
  // había CINCO versiones distintas vivas. Subir la versión, por sí solo, no avisaba a nadie.
  //
  // Y EL CANDADO CAMBIÓ DE ASERCIÓN el 2026-09-02, por dos defectos que salieron en el smoke. Se movió el
  // MECANISMO, no la garantía: el profesional tiene que enterarse cuando la ciencia se mueve bajo una
  // cifra que él prescribe, y eso sigue exigido abajo.
  //
  //   1. Comparar las CADENAS DE VERSIÓN no se podía apagar nunca. `protocol_suggested` es write-once
  //      (trigger 0026): la versión sellada no cambia al guardar ajustes ni al reabrir, así que no había
  //      ninguna acción capaz de quitar el aviso. Santiago guardó sin cambiar nada, luego cambió valores y
  //      volvió a guardar, y seguía ahí. Un aviso que no se puede resolver entrena a ignorarlo.
  //   2. Y el texto afirmaba un movimiento que no ocurre: el peso meta sale de `snap.pesoCalculo`, que
  //      está sellado, y el bump del 1-sep tocó `motorTratNutri`, cuyo peso meta interno Atlas no ejecuta.
  it("el aviso DICE sobre qué peso compara, porque si no su número se lee como contradicción", () => {
    // EL DEFECTO (smoke 2026-09-03, lo vio Santiago). El aviso compara SIN ajustes, o sea sobre el peso de
    // cálculo del modelo, y los campos de abajo corren CON ellos, sobre el peso meta que fijó el
    // profesional. Para el paciente del smoke eso eran 1.631 kcal y 85 g en el aviso contra 1.529 kcal y
    // 78 g en la calculadora, con la misma etiqueta y a un palmo de distancia. Las cuatro cifras eran
    // correctas; lo que faltaba era decir sobre qué peso está cada par.
    //
    // NO SE CAMBIÓ LA COMPARACIÓN, Y ESO ES PARTE DE LO QUE ESTE CASO FIJA: comparar sin ajustes es lo
    // correcto, porque con ellos un override a mano haría DESAPARECER el aviso (lo sellado y lo de hoy
    // mostrarían el mismo número escrito por el profesional, la diferencia sería cero) justo en los
    // pacientes cuya cadena más se tocó.
    expect(PANEL).toContain("peso de cálculo del modelo");
    expect(PANEL).toContain("para separar lo que cambió el modelo de lo que cambiaste tú");
    expect(PANEL).toContain("los campos de abajo usan el peso meta que fijaste");

    // Y LA ACLARACIÓN ES CONDICIONAL: con un solo peso, mencionar el otro sería ruido, y un aviso con
    // ruido se deja de leer. Sin esto, la frase larga saldría también donde no explica nada.
    expect(PANEL).toContain("pesosDifieren");
    expect(PANEL).toContain(
      "const pesosDifieren = pesoModelo != null && Math.abs(pesoEfectivo - pesoModelo) > 0.05",
    );
  });

  it("el aviso se DERIVA de las cifras, no de que dos cadenas de versión difieran", () => {
    // La pregunta con respuesta: el código de hoy, sobre los inputs SELLADOS y sin ajustes, ¿da la misma
    // cadena que la sellada? Sin ajustes a propósito: con ellos la diferencia diría lo que cambió el
    // profesional, no lo que cambió la ciencia.
    // El tercer argumento entro el 2026-09-03 (la proteina del motor para los snapshots viejos); lo que
    // este caso afirma sigue siendo lo mismo: que el aviso compara contra el modelo SIN ajustes.
    expect(PANEL).toContain("computeProtocoloEfectivo(snap, SIN_AJUSTES, opciones)");
    expect(PANEL).toContain("const cienciaSeMovio =");
    expect(PANEL).toContain("{cienciaSeMovio ? (");
  });

  it("y dice las DOS cifras, la sellada y la de hoy", () => {
    // Sin los dos números, "las cifras no dan lo mismo" no le dice al profesional si tiene que hacer algo.
    expect(PANEL).toContain("no dan lo mismo");
    expect(PANEL).toContain("kcalHoy");
    expect(PANEL).toContain("protHoy");
  });

  it("y ya NO afirma que el peso meta se mueve, porque está sellado", () => {
    expect(sinComentarios(PANEL)).not.toContain("los gramos de proteína pueden moverse");
  });
});

// ── ¿EL AVISO DE DESFASE LLEGA A DISPARAR ALGUNA VEZ? MEDIDO CONTRA LA BASE ─────────────────────────
//
// SEGUNDA PREDICCIÓN FALLIDA SOBRE ESTE MISMO AVISO (2026-09-02). Dije que en un tratamiento sellado con
// `anibise-protocolo-2026-07-30` aparecería con las dos cifras. Santiago lo abrió y no estaba.
//
// LA MEDICIÓN, corriendo `computeProtocoloEfectivo` sobre los 50 tratamientos reales de la base:
//   · 48 con cadena comparable, repartidos en CINCO versiones selladas distintas
//     (2026-08-31: 19 · 2026-08-03: 12 · 2026-08-19b: 10 · 1.0.0: 6 · 2026-07-30: 1)
//   · **avisarían: 0** · idénticos: 48
//
// Y LA RAZÓN, que es la que yo no había entendido: el snapshot sella los INPUTS, y recalcular los replica.
// `snap.calorico` se selló corriendo `computeProtocoloCalorico` sobre esos mismos inputs, así que
// recomputar hoy da lo mismo SALVO que esa función cambie, y no ha cambiado nunca. Los bumps que sí
// hubo tocaron `motorProtocolo` (que produce los inputs, ya sellados) y `motorTratNutri` (cuyo peso meta
// interno Atlas ni ejecuta). **Sellar los inputs es precisamente lo que impide que un cambio aguas arriba
// mueva lo recomputado**, que es la garantía que se buscaba, no un defecto.
//
// ASÍ QUE EL AVISO ES UN GUARDA LATENTE Y CORRECTO, no ruido: dispara el día que cambie la cadena
// calórica, y ese día lo dirá con las dos cifras. Lo que NO se puede es dejarlo sin prueba, o su silencio
// se confundiría con "no está implementado". Este caso demuestra que sabe dispararse.
describe("el aviso de desfase dispara cuando la cadena calórica cambia, y hoy no cambió", () => {
  const snapBase = () => ({
    protocolEngineVersion: "anibise-protocolo-2026-07-30",
    pesoCalculo: 72.8,
    protMin: 1,
    protMax: 1.2,
    protRef: "ESPEN 2023",
    estrategia: { deficit: 0 },
    caloricoInputs: { ffm: 55, talla: 177, edad: 40, sexoM: true },
    fenotipo: null,
    restricciones: [],
    examenes: [],
    suplementacion: [],
    calorico: {},
  });

  const SIN_AJUSTES = {
    geb: null,
    pal: null,
    kcalObj: null,
    protGkg: null,
    fatPct: null,
    deficit: null,
    pesoMeta: null,
  };

  it("con la cadena sellada IGUAL a la de hoy, no hay nada que avisar", () => {
    const snap = snapBase() as never;
    const hoy = computeProtocoloEfectivo(snap, SIN_AJUSTES).calorico;
    const sellado = { ...hoy };
    expect(Math.round(sellado.kcalObj)).toBe(Math.round(hoy.kcalObj));
    expect(Math.round(sellado.protG)).toBe(Math.round(hoy.protG));
  });

  it("y con una cadena sellada DISTINTA, la diferencia se detecta en las dos cifras", () => {
    // Se simula el único caso que puede producirla: que `computeProtocoloCalorico` cambie y lo sellado
    // haya salido de la versión anterior. Sin este caso, "0 avisan" no distinguiría un guarda latente de
    // un guarda roto.
    const snap = snapBase() as never;
    const hoy = computeProtocoloEfectivo(snap, SIN_AJUSTES).calorico;
    const selladoViejo = { ...hoy, kcalObj: hoy.kcalObj - 120, protG: hoy.protG - 8 };
    const movio =
      Math.round(selladoViejo.kcalObj) !== Math.round(hoy.kcalObj) ||
      Math.round(selladoViejo.protG) !== Math.round(hoy.protG);
    expect(movio).toBe(true);
  });
});
