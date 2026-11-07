import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { edadParaElPaciente } from "@/clinical-engine/edad-para-el-paciente";
import { lecturaSencilla } from "@/clinical-engine/lectura-sencilla-provisional";
import { ALTO_FRANJA } from "@/modules/reports/pdf/marca-de-la-plantilla";
import { styles } from "@/modules/reports/pdf/estilos-del-pdf";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS NUEVE AJUSTES DEL INFORME  ·  2026-11-07
//
// Santiago reviso el informe impreso y mando nueve cambios (a-i). Lo que se puede medir renderizando
// (que el inicial quepa en una hoja, el seguimiento en dos, y que ningun texto se pise) ya lo mide
// `el-informe-maquetado`, que es donde vive el PDF de verdad. Este candado fija lo que ese no ve: los
// TEXTOS exactos que pidio y la forma de la franja.
//
// POR QUE SEPARADO Y NO DENTRO DEL OTRO: aquel mide el documento RENDERIZADO (cuenta hojas, busca
// solapes) y tarda lo que tarda generar varios PDF. Esto son afirmaciones sobre cadenas, que se leen de
// un golpe. Mezclarlos haria que un cambio de texto tuviera que esperar a seis renders.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const MARCA = sinComentarios(readFileSync("src/modules/reports/pdf/marca-de-la-plantilla.tsx", "utf8"));
const ENCABEZADO = readFileSync("src/modules/reports/pdf/encabezado-en-cuadros.tsx", "utf8");
const ESTILOS = readFileSync("src/modules/reports/pdf/estilos-del-pdf.ts", "utf8");

describe("(a) el membrete llena el lado izquierdo y la diagonal queda solo a la derecha", () => {
  it("el primer tramo arranca en x=0 con su cara izquierda VERTICAL", () => {
    // *"La figura #102545 tiene que llenar el lado izquierdo hasta el borde (rectangulo) y conservar la
    // diagonal solo a la derecha. Hoy se ve la punta del trapecio a la izquierda."*
    //
    // Los dos vertices izquierdos del primer poligono caen en x=0: eso es lo que quita la cuña blanca Y
    // la punta inclinada. Se comprueba la FORMA de los puntos, que es lo que el PDF dibuja.
    expect(MARCA).toContain("const izquierdaRecta = i === 0;");
    expect(MARCA).toContain("`0,0 ${b + d},0 ${b - d},${h} 0,${h}`");
  });

  it("y los otros cuatro conservan sus DOS diagonales, que es lo que separa un color del siguiente", () => {
    expect(MARCA).toContain("`${a + d},0 ${b + d},0 ${b - d},${h} ${a - d},${h}`");
  });

  it("CONTROL: la franja sigue teniendo altura, asi que hay algo que dibujar", () => {
    expect(ALTO_FRANJA).toBeGreaterThan(0);
  });
});

describe("(b) la cifra de la edad biologica sale al tamaño del titulo", () => {
  it("las dos leen la MISMA constante, asi que no pueden separarse", () => {
    expect(ESTILOS).toContain("export const CUERPO_DEL_TITULO = 18;");
    expect(ESTILOS, "la cifra dejo de leer la constante del titulo").toContain(
      "cifraGrande: { fontSize: CUERPO_DEL_TITULO,",
    );
    expect(ENCABEZADO, "el titulo dejo de leer la constante").toContain(
      "titulo: { fontSize: CUERPO_DEL_TITULO,",
    );
  });
});

describe("(c) y (d) la frase de la edad, tal como la escribio", () => {
  // ═══ RE-ANCLADO EL 2026-11-07, SEGUNDA VUELTA, Y LA RAZON SE ESCRIBE ═══
  //
  // Por la manana la frase era *"Tu cuerpo se comporta como el de una persona 12,4 años mayor: ..."*.
  // Al ver el cuadro impreso Santiago la cambio a *"12,4 años más de lo esperado para tu edad:
  // envejecimiento acelerado estimado."*, con la seguridad fuera, en letra pequeña.
  //
  // NO ES UN AJUSTE DE GUSTO: la frase vieja afirmaba algo sobre el CUERPO del paciente y la nueva dice
  // lo que el modelo calcula, que es la distancia contra el valor esperado de su grupo (la v7 estima
  // `Sesp` por sexo, edad y FMI, y el IAE es esa resta). Se re-ancla porque cambio la FUENTE, no porque
  // el candado estorbara.
  it("la variante MAYOR es exactamente la que mando", () => {
    expect(edadParaElPaciente(76.4, 12.4)?.frase).toBe(
      "12,4 años más de lo esperado para tu edad: envejecimiento acelerado estimado.",
    );
  });

  it("la variante MENOR dice menos y usa la banda de desacelerado", () => {
    expect(edadParaElPaciente(45.6, -12.4)?.frase).toBe(
      "12,4 años menos de lo esperado para tu edad: envejecimiento desacelerado estimado.",
    );
  });

  it("y la variante ACORDE compone la distancia con SU banda, sin recortar ninguna de las dos", () => {
    // "mas de lo esperado" NO quiere decir "acelerado": su banda es acorde entre -5 y +5. Un IAE de +2,1
    // es a la vez una distancia de 2,1 años y un veredicto de acorde, y las dos cosas son suyas. El error
    // facil aqui es "arreglar" la frase para que concuerde, que seria cambiarle el corte a su banda.
    expect(edadParaElPaciente(60, 2.1)?.frase).toBe(
      "2,1 años más de lo esperado para tu edad: acorde con sus pares.",
    );
  });

  it("el cero no se cuenta como una diferencia de cero años", () => {
    const r = edadParaElPaciente(60, 0);
    expect(r?.frase).toBe("Lo esperado para tu edad: acorde con sus pares.");
    expect(r?.frase).not.toContain("0,0 años");
  });

  it("y las cuatro variantes llevan SIEMPRE la media linea de seguridad, con su origen", () => {
    // Ahora va en su propio campo, asi que lo que se vigila es que NINGUNA variante salga sin ella: es
    // la frase que evita que un paciente lea "envejecimiento acelerado" como una enfermedad que tiene.
    for (const iae of [12.4, -12.4, 2.1, 0, -2.1]) {
      expect(edadParaElPaciente(60 + iae, iae)?.seguridad).toBe(
        "Es una estimación a partir de tu medición; no es una enfermedad ni un pronóstico.",
      );
    }
  });

  it("y la seguridad SALE de la frase: al mismo cuerpo, la advertencia se lee como diagnostico", () => {
    for (const iae of [12.4, -12.4, 0]) {
      const r = edadParaElPaciente(60 + iae, iae);
      expect(r?.frase, "la seguridad volvio a viajar dentro del veredicto").not.toContain(
        "Es una estimación",
      );
      // Su punto d: en Atlas la estima el MODELO, no el aparato.
      expect(r?.frase).not.toContain("equipo");
      expect(r?.seguridad).not.toContain("equipo");
    }
  });
});

describe("(e) el cuadro del paciente se ve en el papel", () => {
  it("el filete es mas grueso y el gris mas oscuro que el gris 300 de antes", () => {
    // EL COLOR SE MUDO a `estilos-del-pdf` el 2026-11-07, cuando el cuadro de la edad adopto el mismo
    // filete: lo que se vigila es que siga habiendo UNA sola definicion y que el encabezado la lea.
    expect(ESTILOS).toContain('export const BORDE_DEL_CUADRO = "#9ca3af";');
    expect(ENCABEZADO).toContain("export const BORDE_DEL_ENCABEZADO = BORDE_DEL_CUADRO;");
    expect(ENCABEZADO, "el encabezado volvio a tener su propia copia del color").not.toMatch(
      /BORDE_DEL_ENCABEZADO = "#/,
    );
    expect(ENCABEZADO).toContain("borderWidth: 1.1");
    expect(ENCABEZADO).toContain("borderLeftWidth: 1.1");
  });
});

describe("(f) las cinco areas dejan de ir pegadas", () => {
  it("el bloque de dominio separa cuatro puntos, no medio", () => {
    // Las cinco barras de color se leian como una sola barra rayada, que es lo contrario de lo que cada
    // barra existe para hacer. Y el mismo estilo lo usa la hoja de seguimiento, asi que entra en las dos.
    expect(ESTILOS).toContain("dominio: { marginTop: 4,");
    expect(ESTILOS).not.toContain("dominio: { marginTop: 0.5,");
  });
});

describe("(g) el cuerpo envejece, no se desgasta", () => {
  it("las cuatro lecturas del dominio 3 dicen envejecer", () => {
    // La primera es la que Santiago escribio literal.
    expect(lecturaSencilla("d3", 0)).toBe(
      "Tu cuerpo envejece al ritmo esperado para tu edad, o más despacio.",
    );
    for (const sev of [0, 1, 2, 3]) {
      const t = lecturaSencilla("d3", sev);
      expect(t, `sev ${sev} sin texto`).toBeTruthy();
      expect(t, `sev ${sev} sigue hablando de desgaste`).not.toMatch(/desgast/i);
    }
  });

  it("y ninguna de las veinte lecturas sencillas habla de desgaste", () => {
    for (const d of ["d1", "d2", "d3", "d4", "d5"]) {
      for (const sev of [0, 1, 2, 3]) {
        const t = lecturaSencilla(d, sev);
        if (t) expect(t, `${d} sev ${sev}`).not.toMatch(/desgast/i);
      }
    }
  });
});

describe("(h) quien atendio y cuando van en UNA linea con separador", () => {
  it("las piezas se juntan con el punto medio y se filtran las ausentes", () => {
    // Un dato que falta tiene que desaparecer CON su separador: concatenado a mano deja un separador
    // huerfano al principio o al final, que es la clase de detalle que solo se ve impreso.
    expect(ENCABEZADO).toContain('.join(" · ")');
    expect(ENCABEZADO).toContain(".filter((x): x is string => Boolean(x && x.trim()))");
    // Y SE QUITA EL `space-between`, que era lo que mandaba la fecha al otro extremo de la hoja.
    expect(ENCABEZADO).toContain('pie: { flexDirection: "row", marginTop: 4, marginBottom: 5 },');
  });
});

describe("(i) el mensaje para el paciente es el unico texto de la profesional que va al informe", () => {
  const LECTOR = sinComentarios(readFileSync("src/modules/reports/data/freno-de-trayectoria.ts", "utf8"));
  const ENVIO = sinComentarios(readFileSync("src/modules/reports/services/send-report.ts", "utf8"));
  const INFORME = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");

  it("el informe lee el MENSAJE y ya no la nota clinica", () => {
    expect(LECTOR).toContain("n.mensaje_para_el_paciente as mensaje");
    expect(LECTOR, "volvio a leer la nota clinica para el informe").not.toContain("select n.note");
  });

  it("y toma la ultima fila QUE TENGA mensaje, no el mensaje de la ultima fila", () => {
    // `treatment_notes` es append-only y el mensaje es opcional: si se leyera el mensaje de la ultima
    // nota, escribir una nota clinica mas (sin mensaje) BORRARIA del informe el mensaje que ya se le
    // habia dejado al paciente, sin que nadie lo pidiera y sin que nada falle.
    expect(LECTOR).toContain("and n.mensaje_para_el_paciente is not null");
    expect(LECTOR).toContain("btrim(n.mensaje_para_el_paciente) <> ''");
  });

  it("el correo tambien: lo que acompaña la entrega es el mensaje, no la nota", () => {
    expect(ENVIO).toContain("ultimoMensajeParaElPaciente(dispatch.evaluationId)");
    expect(ENVIO).toContain("const modo: SendMode = mensajeParaElPaciente ?");
  });

  it("y el rotulo del informe dice MENSAJE, no observaciones", () => {
    // Llamarlo observacion haria creer que lo que el paciente lee es la nota clinica completa.
    expect(INFORME).toContain("Mensaje de tu profesional: ");
    expect(INFORME).not.toContain("Observaciones de tu profesional: ");
  });

  it("la columna vive en el schema con su tope, y la migracion es la 0237", () => {
    const SCHEMA = readFileSync("src/db/schema/treatments.ts", "utf8");
    expect(SCHEMA).toContain('mensajeParaElPaciente: varchar("mensaje_para_el_paciente", { length: 200 })');
    const SQL = readFileSync("drizzle/0237_el_mensaje_para_el_paciente.sql", "utf8");
    expect(SQL).toContain('ADD COLUMN "mensaje_para_el_paciente" varchar(200)');
    // SIN DEFAULT Y SIN NOT NULL: es opcional por diseño, y copiarles la nota clinica a las filas viejas
    // seria mandarle al paciente un texto que no se escribio para el.
    expect(SQL).not.toMatch(/mensaje_para_el_paciente[^;]*not null/i);
    expect(SQL).not.toMatch(/mensaje_para_el_paciente[^;]*default/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS TRES AJUSTES DE LA SEGUNDA VUELTA  ·  Santiago, 2026-11-07, tarde
//
// Reviso el informe ya con los nueve cambios puestos y mando tres mas. Van en este mismo archivo y no en
// uno nuevo: son del mismo documento y del mismo dia, y repartir los candados de una superficie por fecha
// es como se acaba con tres archivos que miden lo mismo sin saberlo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("(j) PACIENTE, DOCUMENTO y FECHA DE MEDICION, en negrita", () => {
  it("el rotulo de las tres cajas lleva negrita, y es UN estilo para las tres", () => {
    // Un `fontWeight` por caja serian tres sitios donde se puede olvidar uno, y el que se olvide es el
    // que se lee como caja de otra clase.
    expect(ENCABEZADO).toContain("  rotulo: {\n    fontSize: 7,\n    fontWeight: \"bold\",");
  });

  it("y los tres rotulos salen de la MISMA lista, asi que ninguno se puede quedar fuera", () => {
    expect(ENCABEZADO).toContain('{ rotulo: "Paciente", valor:');
    expect(ENCABEZADO).toContain('{ rotulo: "Documento", valor:');
    // La tercera entra como dato porque no es la misma fecha en los tres documentos (el informe se fecha
    // por la MEDICION; la hoja del plan y la HC, por la consulta).
    expect(ENCABEZADO).toContain("datos.tercera,");
    expect(ENCABEZADO).toContain("<Text style={estilos.rotulo}>{c.rotulo}</Text>");
  });
});

describe("(k) el cuadro de la edad biologica: un cuadro, y alineado a la izquierda", () => {
  const INFORME = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");

  it("tiene filete, y es EL MISMO de la caja de identidad", () => {
    // *"hoy esta centrado, en negrita, mezcla gris y azul, y no cuadra."* No cuadraba porque no habia
    // cuadro: eran cuatro lineas centradas flotando entre el encabezado y lo que sigue.
    expect(ESTILOS).toContain("cifraBloque: {\n    borderWidth: 1.1,\n    borderColor: BORDE_DEL_CUADRO,");
  });

  it("y YA NO va centrado: ni el bloque ni el veredicto", () => {
    const limpio = sinComentarios(ESTILOS);
    expect(limpio, "el bloque volvio a centrar su contenido").not.toContain(
      'cifraBloque: { alignItems: "center"',
    );
    const delta = limpio.slice(limpio.indexOf("cifraDelta:"), limpio.indexOf("cifraSeguridad:"));
    expect(delta, "el veredicto volvio a ir centrado dentro de un cuadro alineado").not.toContain(
      "textAlign",
    );
  });

  it("lleva las cinco piezas que pidio, en su orden", () => {
    const i = (s: string) => INFORME.indexOf(s);
    expect(i("styles.cifraRotulo")).toBeGreaterThan(-1);
    expect(i("styles.cifraRotulo")).toBeLessThan(i("styles.cifraGrande"));
    expect(i("styles.cifraGrande")).toBeLessThan(i("styles.cifraEdadReal"));
    expect(i("styles.cifraEdadReal")).toBeLessThan(i("styles.cifraDelta"));
    expect(i("styles.cifraDelta")).toBeLessThan(i("styles.cifraSeguridad"));
  });

  it("y la seguridad va en letra PEQUEÑA, mas chica que el veredicto", () => {
    // Si pesaran lo mismo, la advertencia sobre como leer la cifra se leeria como parte del veredicto.
    expect(styles.cifraSeguridad.fontSize as number).toBeLessThan(
      styles.cifraDelta.fontSize as number,
    );
  });
});

describe("(l) el derecho a la historia clinica cierra con punto", () => {
  const INFORME = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");

  it("la frase lleva su punto final en los DOS cierres, el del inicial y el del seguimiento", () => {
    // NO HUBO QUE CAMBIAR NADA: el punto estaba en el codigo, en el PDF renderizado y en todo el
    // historial de la frase (verificado contra `git log -S` el 2026-11-07). Se deja el candado porque la
    // frase es de las que se copian de una hoja a la otra, y un punto es lo que primero se pierde al
    // copiar; y porque sin el, "ya estaba" es una afirmacion que envejece.
    const cierres = INFORME.match(
      /Puedes solicitar tu historia clínica completa a tu profesional tratante\./g,
    );
    expect(cierres, "la frase cambio de forma o perdio su punto").toHaveLength(2);
    expect(INFORME).not.toMatch(/profesional tratante\s*\n\s*<\/Text>/);
  });
});
