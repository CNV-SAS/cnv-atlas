import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { computeProtocoloEfectivo, type ProtocoloAjustes } from "@/clinical-engine";
import type { ProtocoloSnapshot } from "@/clinical-engine/protocolo";

// CANDADO DEL PESO META COMO UN SOLO DATO (Gildardo, 2026-08-28 §2).
//
// SU INSTRUCCION, textual: "el campo va en la entrada, en mod antropometría... no son dos pesos meta, es
// uno. El campo de la entrada y el ajuste del tratamiento son el mismo dato en dos superficies de edición,
// no dos datos que puedan discrepar. SI LOS CONSTRUYEN COMO CAMPOS SEPARADOS, EL DEFECTO LO CREAN USTEDES."
// Y de donde sale: "el peso meta no pertenece al tratamiento, pertenece al paciente. El motor lo calcula
// como punto de partida, el profesional lo fija, y el tratamiento lo LEE. No lo crea."
//
// EL DEFECTO QUE CIERRA: la superficie de la entrada existia desde la migracion 0021
// (`evaluation_bis_intake.weight_goal_kg`), con su input vivo en la captura de condiciones, y NO LA LEIA
// NADIE. Ni la cadena calorica, ni el sellado al aprobar, ni el prompt del menu. El profesional acordaba
// un peso meta con el paciente, lo escribia, y la prescripcion no se movia ni un gramo. Es la misma
// familia que el motor portado y no conectado y que la dinamometria capturada y no cableada: una pieza
// TERMINADA a la que le falta el ultimo cable, que es la que no da error en ninguna parte.
//
// EL CANDADO VA SOBRE LOS SITIOS DE RESOLUCION, no sobre el motor: el motor siempre acepto el peso meta.

const PANEL = readFileSync("src/modules/treatment/components/treatment-panel.tsx", "utf8");
const READER = readFileSync("src/modules/treatment/data/treatment-reader.ts", "utf8");
const MENU = readFileSync("src/modules/treatment/services/generate-menu.ts", "utf8");
const CAPTURA = readFileSync("src/modules/bis-intake/components/bis-conditions-capture.tsx", "utf8");

/** El codigo sin comentarios: los comentarios CITAN lo que el candado prohibe, para explicar por que. */
function quitarComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("el peso meta de la ENTRADA llega a la cadena", () => {
  it("el lector del panel trae `pesoMetaIngreso` de evaluation_bis_intake", () => {
    expect(READER).toContain('.from("evaluation_bis_intake")');
    expect(READER).toContain("weight_goal_kg");
    expect(READER).toContain("pesoMetaIngreso:");
  });

  it("el lector del SELLADO lo resuelve tambien: aprobar no puede usar otro peso que la pantalla", () => {
    // Es la mitad invisible. Si solo lo resolviera el panel, el profesional veria una prescripcion y se
    // sellaria otra, que es peor que no haberlo conectado.
    expect(READER).toContain("pesoMeta: n(t.adj_peso_meta) ?? n(intake?.weight_goal_kg)");
  });

  it("y el prompt del MENU, que arma la comida con esas calorías", () => {
    expect(MENU).toContain("protocol.adjPesoMeta ?? protocol.pesoMetaIngreso");
  });
});

describe("la resolucion vive en UN solo sitio del panel", () => {
  it("existe `pesoMetaFijado` y ningun sitio arma los ajustes con el crudo", () => {
    // El peso meta entra a la cadena ENTERA (GEB, objetivo, gramos de proteina). Un sitio que se olvide
    // de la resolucion no lanza un error: prescribe distinto, en silencio. Por eso se prohibe el crudo.
    const codigo = quitarComentarios(PANEL);
    expect(codigo).toContain("function pesoMetaFijado(");
    expect(
      codigo,
      "un sitio arma ProtocoloAjustes con el peso meta CRUDO y se salta la superficie de la entrada",
    ).not.toContain("pesoMeta: protocol.adjPesoMeta");
    // Y que de verdad se use en los cuatro sitios que computan la cadena.
    expect((codigo.match(/pesoMeta: pesoMetaFijado\(protocol\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("la seccion se REMONTA cuando cambia el peso del ingreso, pero la FIRMA no lo incluye", () => {
    // Las dos mitades, y la distincion es la que nos costo un defecto antes: la firma es el candado de
    // concurrencia que el servidor recomputa sobre las columnas adj_* que ESTE formulario escribe; meterle
    // un dato de otra tabla la haria diverger entre cliente y servidor. La key solo tiene que remontar
    // cuando cambia algo que se MUESTRA, y el peso del ingreso se muestra en tres sitios de la seccion.
    expect(PANEL).toContain('`§ingreso:${protocol.pesoMetaIngreso ?? ""}`');
    const firma = readFileSync("src/modules/treatment/data/protocol-signature.ts", "utf8");
    expect(firma, "el peso del ingreso entro a la firma y el candado va a diverger").not.toContain(
      "pesoMetaIngreso",
    );
  });
});

describe("las dos superficies dicen que son el mismo dato", () => {
  it("la de la entrada dice a donde va el numero", () => {
    // Un campo que no dice que hace es como se quedo cuatro meses sin que nadie notara que no hacia nada.
    expect(CAPTURA).toContain("Es la base del cálculo");
    expect(CAPTURA).toContain("es el mismo dato, no otro");
  });

  it("la del panel distingue TRES procedencias, no dos", () => {
    // Decir "peso meta sin registrar" cuando esta registrado en la entrada es la contradiccion entre
    // superficies de siempre: dos partes de la pantalla leyendo fuentes distintas.
    expect(PANEL).toContain('const origenPeso: "panel" | "ingreso" | "calculado"');
    expect(PANEL).toContain("Peso meta fijado en la entrada");
    expect(PANEL).toContain("Peso meta fijado por ti aquí");
    expect(PANEL).toContain("Peso meta sin registrar");
  });

  it("y el boton de limpiar promete a donde vuelve DE VERDAD", () => {
    // Con peso de ingreso, vaciar el campo NO vuelve al calculado: vuelve al del ingreso. Prometer el
    // calculado seria el mismo desajuste que este bloque cierra.
    expect(PANEL).toContain("Usar el del ingreso (");
    expect(PANEL).toContain("Usar el calculado (");
  });
});

// CONTROL. Sin esto, todo lo de arriba pasaria verde tambien si el peso meta hubiera dejado de mover la
// prescripcion: se estaria cableando un dato inerte y el candado no lo notaria.
describe("CONTROL: el peso meta MUEVE la prescripción", () => {
  const SNAP: ProtocoloSnapshot = {
    pesoCalculo: 92,
    pesoCalculoLabel: "Peso actual",
    caloricoInputs: { ffm: 62, pesoN: 92, talla: 171, edad: 50, sexoM: true },
    estrategia: { label: "Mantenimiento", perfil: null, deficit: 0 },
    protMin: 1,
    restricciones: [],
  } as unknown as ProtocoloSnapshot;

  const sinAjustes: ProtocoloAjustes = {
    geb: null,
    pal: null,
    kcalObj: null,
    protGkg: null,
    fatPct: null,
    pesoMeta: null,
  };

  it("un peso meta distinto da gramos de proteína distintos", () => {
    const conCalculado = computeProtocoloEfectivo(SNAP, sinAjustes);
    const conMeta = computeProtocoloEfectivo(SNAP, { ...sinAjustes, pesoMeta: 78 });
    expect(conCalculado.pesoEfectivo).toBe(92);
    expect(conMeta.pesoEfectivo).toBe(78);
    expect(conMeta.calorico.protG).not.toBe(conCalculado.calorico.protG);
  });
});
